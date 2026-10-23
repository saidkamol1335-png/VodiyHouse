import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrationFiles, user } from "./harness";

// Облачный харнесс (remote.ts) без облака: поддельный pg.Client выполняет запросы строго по очереди,
// как настоящий, а точки сохранения ведёт как Postgres — release снимает и все более поздние.
// Так видно, прервали бы одновременные вызовы транзакцию файла или нет.

const fake = vi.hoisted(() => {
  class FakeClient {
    static last: FakeClient;
    log: string[] = [];
    stack: string[] = [];
    aborted = false;
    private queue: Promise<unknown> = Promise.resolve();
    constructor() {
      FakeClient.last = this;
    }
    async connect() {}
    async end() {}
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
  return { FakeClient, versions: async () => [] as { version: string }[] };
});

vi.mock("pg", () => ({ default: { Client: fake.FakeClient } }));

const { createRemoteTestDb } = await import("./remote");
const GUARD = /только по одному/;

describe("облачный харнесс: запросы к базе — по одному", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_DB_URL", "postgresql://postgres.test:pw@localhost:5432/postgres");
    fake.versions = async () =>
      (await migrationFiles()).map((file) => ({ version: file.split("_")[0]! }));
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
