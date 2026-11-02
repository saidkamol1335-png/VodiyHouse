import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrationFiles, MIGRATIONS_DIR, user } from "./harness";

// Облачный харнесс (remote.ts) без облака: поддельный pg.Client выполняет запросы строго по очереди,
// как настоящий, а точки сохранения ведёт как Postgres — release снимает и все более поздние.
// Так видно, прервали бы одновременные вызовы транзакцию файла или нет.

const fake = vi.hoisted(() => {
  class FakeClient {
    static last: FakeClient;
    log: string[] = [];
    stack: string[] = [];
    aborted = false;
    ended = false;
    private queue: Promise<unknown> = Promise.resolve();
    constructor() {
      FakeClient.last = this;
    }
    async connect() {}
    async end() {
      this.ended = true;
    }
    query(sql: string) {
      const run = this.queue.then(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        this.log.push(sql);
        return this.execute(sql);
      });
      this.queue = run.catch(() => undefined);
      return run;
    }
    private async execute(sql: string) {
      const savepoint = /^(savepoint|release savepoint|rollback to savepoint) (\w+)$/.exec(sql);
      if (savepoint) this.moveSavepoints(savepoint[1]!, savepoint[2]!);
      if (sql.includes("delete from public.complexes") && fake.cleanupError)
        throw fake.cleanupError;
      if (sql.includes("pg_stat_activity")) return { rows: [fake.holder] };
      if (sql.includes("schema_migrations")) return { rows: await fake.versions() };
      if (sql.includes("current_setting")) return { rows: [{ value: "0" }] };
      if (sql.includes("fail")) throw new Error("ожидаемая ошибка запроса");
      return { rows: [], rowCount: 0 };
    }
    private moveSavepoints(kind: string, name: string) {
      if (kind === "savepoint") return void this.stack.push(name);
      const at = this.stack.lastIndexOf(name);
      if (at < 0) {
        this.aborted = true;
        throw new Error(`savepoint "${name}" does not exist`);
      }
      this.stack.length = kind === "release savepoint" ? at : at + 1;
    }
  }
  return {
    FakeClient,
    versions: async () => [] as { version: string; statements: string[] }[],
    cleanupError: null as (Error & { code?: string }) | null,
    holder: {
      pid: 42,
      app: "vh-test-db-remote",
      state: "idle in transaction",
      since: "24.10 22:10:00",
    },
  };
});

vi.mock("pg", () => ({ default: { Client: fake.FakeClient } }));

const { createRemoteTestDb } = await import("./remote");
const GUARD = /только по одному/;

/** Все миграции «применены в облаке» с текстом файлов; у первой можно подменить текст. */
const appliedMigrations = async (firstText?: string) =>
  Promise.all(
    (await migrationFiles()).map(async (file, at) => ({
      version: file.split("_")[0]!,
      statements: [
        at === 0 && firstText !== undefined
          ? firstText
          : await readFile(path.join(MIGRATIONS_DIR, file), "utf8"),
      ],
    })),
  );

describe("облачный харнесс: запросы к базе — по одному", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_DB_URL", "postgresql://postgres.test:pw@localhost:5432/postgres");
    fake.versions = () => appliedMigrations();
    fake.cleanupError = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("Promise.all по db.admin — второй вызов отказан, транзакция файла цела", async () => {
    const db = await createRemoteTestDb();
    const [first, second] = await Promise.allSettled([
      db.admin.query("select 1"),
      db.admin.query("select 2"),
    ]);
    expect(first.status).toBe("fulfilled");
    expect(second).toMatchObject({
      status: "rejected",
      reason: { message: expect.stringMatching(GUARD) },
    });
    await db.admin.query("select 3");
    expect(fake.FakeClient.last.aborted).toBe(false);
  });

  it("Promise.all внутри as() — откат роли только после соседнего запроса", async () => {
    const db = await createRemoteTestDb();
    await expect(
      db.as(user("u1"), (tx) => Promise.all([tx.query("select 'A'"), tx.query("select 'B'")])),
    ).rejects.toThrow(GUARD);
    const log = fake.FakeClient.last.log;
    expect(log.indexOf("rollback to savepoint as_1")).toBeGreaterThan(log.indexOf("select 'A'"));
    await db.admin.query("select 'после'");
    expect(fake.FakeClient.last.aborted).toBe(false);
    expect(log.at(-2)).toBe("select 'после'");
  });

  it("владелец не вклинивается в as(); ошибка внутри as() откатывает только его", async () => {
    const db = await createRemoteTestDb();
    const [, owner] = await Promise.allSettled([
      db.as(user("u1"), (tx) => tx.query("select 'роль'")),
      db.admin.query("select 'владелец'"),
    ]);
    expect(owner).toMatchObject({
      status: "rejected",
      reason: { message: expect.stringMatching(GUARD) },
    });
    await expect(db.as(user("u1"), (tx) => tx.query("select fail"))).rejects.toThrow("ожидаемая");
    await db.admin.query("select 'после'");
    expect(fake.FakeClient.last.aborted).toBe(false);
  });
});

// 2.9б: сбой подготовки не оставляет соединение с прерванной транзакцией (оно держало бы замки
// удалённых строк, и следующие файлы падали бы по statement_timeout); правка применённой
// миграции — отказ до транзакции файла.
describe("облачный харнесс: подготовка файла", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_DB_URL", "postgresql://postgres.test:pw@localhost:5432/postgres");
    fake.versions = () => appliedMigrations();
    fake.cleanupError = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("применённую миграцию изменили — отказ до begin, соединение закрыто", async () => {
    fake.versions = () => appliedMigrations("select 1");
    await expect(createRemoteTestDb()).rejects.toThrow(/изменены после применения/);
    expect(fake.FakeClient.last.log).not.toContain("begin");
    expect(fake.FakeClient.last.ended).toBe(true);
  });

  it("замок держит другая транзакция — она названа, откат, соединение закрыто", async () => {
    fake.cleanupError = Object.assign(new Error("lock timeout"), { code: "55P03" });
    await expect(createRemoteTestDb()).rejects.toThrow(
      /держит другая транзакция: pid 42 \(vh-test-db-remote, idle in transaction/,
    );
    expect(fake.FakeClient.last.log).toContain("rollback");
    expect(fake.FakeClient.last.ended).toBe(true);
  });

  it("другой сбой очистки (statement_timeout) — та же ошибка, откат, соединение закрыто", async () => {
    fake.cleanupError = Object.assign(new Error("canceling statement due to statement timeout"), {
      code: "57014",
    });
    await expect(createRemoteTestDb()).rejects.toThrow(/statement timeout/);
    expect(fake.FakeClient.last.log).toContain("rollback");
    expect(fake.FakeClient.last.ended).toBe(true);
  });
});
