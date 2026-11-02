// Тесты базы против облака (решение фазы 1, в. 1): заглушка Supabase в PGlite могла
// разойтись с настоящим Supabase — этот прогон ловит расхождение до приёмки.
// Каждый тестовый файл работает в одной транзакции и в конце откатывает её: в облаке ничего
// не остаётся. Внутри транзакции контент облака временно убирается, чтобы подсчёты были как
// на чистой базе (справочники — как в миграциях).

import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { editedMigrations, type AppliedMigration } from "../../lib/supabase/migrationDrift";
import {
  claimsOf,
  migrationFiles,
  MIGRATIONS_DIR,
  PG_ROLE,
  type Actor,
  type Db,
  type TestDb,
} from "./harness";

const SANDBOX_CLEANUP = `
  delete from public.complexes;
  delete from public.developers;
  delete from public.settings;
  delete from public.hints;
  delete from public.profiles;
  delete from public.audit_log;
`;
// Имя сессии в pg_stat_activity: так видно, что замки держит тестовый прогон.
const APPLICATION_NAME = "vh-test-db-remote";
const LOCK_NOT_AVAILABLE = "55P03";

export async function createRemoteTestDb(): Promise<TestDb> {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Нет SUPABASE_DB_URL в .env.local — см. .env.example.");

  const client = new pg.Client({
    ...dbClientConfig(connectionString),
    types: { getTypeParser },
    application_name: APPLICATION_NAME,
  });
  await client.connect();
  const { ownTimeout, timeouts } = await openSandbox(client);

  // Тесты ждут и ошибок владельца (check, unique): без точки сохранения такая ошибка прервала бы
  // транзакцию всего файла, как и у as() ниже.
  let adminSavepoints = 0;
  // Запросы одного соединения идут по очереди, и точки сохранения двух одновременных вызовов
  // перемешались бы: release первой снимает и вторую, транзакция файла прерывается — и падают
  // все следующие тесты. В PGlite этого не видно, поэтому параллельный вызов — сразу ошибка.
  let queryBusy = false;
  let asBusy = false;
  // Запрос, отказанный стражем, не останавливает соседний: as() дожидается его до отката.
  let inFlight: Promise<unknown> = Promise.resolve();
  const exclusive = (busy: boolean) => {
    if (busy)
      throw new Error("В облачном прогоне запросы к базе — только по одному (без Promise.all)");
  };
  const savepointQuery = async <T>(sql: string, params?: unknown[]) => {
    const savepoint = `admin_${(adminSavepoints += 1)}`;
    try {
      await client.query(`savepoint ${savepoint}`);
      try {
        const result = await client.query(sql, params);
        await client.query(`release savepoint ${savepoint}`);
        return { rows: result.rows as T[], affectedRows: result.rowCount ?? 0 };
      } catch (error) {
        await client.query(`rollback to savepoint ${savepoint}`);
        throw error;
      }
    } finally {
      queryBusy = false;
    }
  };
  const ownQuery = <T>(sql: string, params?: unknown[]) => {
    exclusive(queryBusy);
    queryBusy = true;
    const work = savepointQuery<T>(sql, params);
    inFlight = work.catch(() => undefined);
    return work;
  };
  const exec = (sql: string) => {
    // Фиксация транзакции оставила бы тестовые строки в облаке — такие запросы запрещены.
    if (/\bcommit\b/i.test(sql)) throw new Error("В облачном прогоне commit запрещён");
    return client.query(sql);
  };
  // Владелец не вклинивается в as(): его запрос пошёл бы от роли теста (в PGlite — взаимная блокировка).
  const admin: Db = {
    query: async <T>(sql: string, params?: unknown[]) => {
      exclusive(asBusy);
      return ownQuery<T>(sql, params);
    },
    exec,
  };
  const scoped: Db = {
    query: <T>(sql: string, params?: unknown[]) => ownQuery<T>(sql, params),
    exec,
  };

  // Каждая служебная команда — отдельным запросом: медленнее, но откат после ошибки проходит
  // наверняка, иначе транзакция файла остаётся прерванной и следующие тесты падают не по своей вине.
  let savepoints = 0;
  const as = async <T>(actor: Actor, run: (db: Db) => Promise<T>): Promise<T> => {
    exclusive(asBusy || queryBusy);
    asBusy = true;
    try {
      return await asActor(actor, run);
    } finally {
      asBusy = false;
    }
  };
  const asActor = async <T>(actor: Actor, run: (db: Db) => Promise<T>): Promise<T> => {
    const savepoint = `as_${(savepoints += 1)}`;
    await client.query(`savepoint ${savepoint}`);
    try {
      await client.query("select set_config('request.jwt.claims', $1, true)", [claimsOf(actor)]);
      await client.query(`set local role ${PG_ROLE[actor.kind]}`);
      const timeout = timeouts.get(PG_ROLE[actor.kind]);
      if (timeout)
        await client.query("select set_config('statement_timeout', $1, true)", [timeout]);
      const result = await run(scoped);
      await client.query("reset role");
      await client.query("select set_config('statement_timeout', $1, true)", [ownTimeout]);
      await client.query("select set_config('request.jwt.claims', '', true)");
      // В PGlite каждый as() — своя транзакция, и настройки теста гаснут на commit; здесь они
      // пережили бы release savepoint. Флаг сводки квартир не сбрасываем: его утечку прогон ловит.
      await client.query(
        "select set_config('vodiy.skip_audit', '', true), set_config('storage.allow_delete_query', '', true)",
      );
      await client.query(`release savepoint ${savepoint}`);
      return result;
    } catch (error) {
      await inFlight;
      await client.query(`rollback to savepoint ${savepoint}`);
      await client.query("reset role");
      throw error;
    }
  };

  return {
    admin,
    as,
    close: async () => {
      await client.query("rollback");
      await client.end();
    },
  };
}

/** bigint (int8) — числом, как в PGlite; pg по умолчанию отдаёт строку, и toEqual с числом падал бы. */
function getTypeParser(oid: number, format?: "text" | "binary") {
  if (oid !== pg.types.builtins.INT8) return pg.types.getTypeParser(oid, format);
  return (value: string) => {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : BigInt(value);
  };
}

/** statement_timeout из настроек ролей API (ALTER ROLE … SET), как их видит PostgREST. */
async function roleTimeouts(client: pg.Client): Promise<Map<string, string>> {
  const { rows } = await client.query<{ role: string; value: string }>(
    `select r.rolname as role, split_part(c.setting, '=', 2) as value
     from pg_roles r cross join lateral unnest(r.rolconfig) as c (setting)
     where r.rolname = any ($1) and c.setting like 'statement_timeout=%'`,
    [Object.values(PG_ROLE)],
  );
  return new Map(rows.map((row) => [row.role, row.value]));
}

/**
 * Транзакция файла и очистка песочницы. При сбое соединение закрывается: иначе прерванная
 * транзакция пережила бы файл и держала замки удалённых строк, а следующие файлы ждали бы их до
 * statement_timeout владельца (2 мин) и падали сами (2.9б: пять файлов подряд).
 */
async function openSandbox(
  client: pg.Client,
): Promise<{ ownTimeout: string; timeouts: Map<string, string> }> {
  try {
    await assertMigrationsApplied(client);
    // SET ROLE не применяет statement_timeout роли (у authenticated в Supabase — 8 с), а PostgREST
    // применяет на каждом запросе: без этого тест 5000 квартир прошёл бы там, где кабинет упадёт.
    const ownTimeout = (
      await client.query<{ value: string }>("select current_setting('statement_timeout') as value")
    ).rows[0]!.value;
    const timeouts = await roleTimeouts(client);
    await client.query("begin");
    await cleanSandbox(client);
    return { ownTimeout, timeouts };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    await client.end().catch(() => undefined);
    throw error;
  }
}

/** Замки очистка ждёт не дольше 30 с и называет, чья транзакция их держит. */
async function cleanSandbox(client: pg.Client): Promise<void> {
  const previous = (
    await client.query<{ value: string }>("select current_setting('lock_timeout') as value")
  ).rows[0]!.value;
  await client.query("select set_config('lock_timeout', '30s', true)");
  try {
    await client.query(SANDBOX_CLEANUP);
  } catch (error) {
    if ((error as { code?: string }).code !== LOCK_NOT_AVAILABLE) throw error;
    await client.query("rollback");
    throw new Error(`Очистку облака держит другая транзакция: ${await lockHolders(client)}`, {
      cause: error,
    });
  }
  await client.query("select set_config('lock_timeout', $1, true)", [previous]);
}

async function lockHolders(client: pg.Client): Promise<string> {
  const { rows } = await client.query<{ pid: number; app: string; state: string; since: string }>(
    `select pid, application_name as app, state, to_char(xact_start, 'DD.MM HH24:MI:SS') as since
     from pg_stat_activity
     where datname = current_database() and pid <> pg_backend_pid() and xact_start is not null`,
  );
  if (rows.length === 0) return "её уже нет — запустите прогон заново.";
  const list = rows.map(
    (row) => `pid ${row.pid} (${row.app || "без имени"}, ${row.state}, с ${row.since})`,
  );
  return `${list.join("; ")}. Оборванный прогон отпустит замки сам, когда сервер закроет его соединение.`;
}

async function assertMigrationsApplied(client: pg.Client): Promise<void> {
  const files = new Map<string, string>();
  for (const file of await migrationFiles()) {
    files.set(file.split("_")[0]!, await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  const { rows } = await client.query<AppliedMigration>(
    "select version, statements from supabase_migrations.schema_migrations",
  );
  const applied = new Set(rows.map((row) => row.version));
  const missing = [...files.keys()].filter((version) => !applied.has(version));
  if (missing.length > 0) {
    throw new Error(`В облаке нет миграций ${missing.join(", ")} — выполни npm run db:push.`);
  }
  // Применённую миграцию правили: облако живёт со старой версией, и тесты проверяли бы не то.
  const edited = editedMigrations(rows, files);
  if (edited.length > 0) {
    throw new Error(
      `Миграции ${edited.join(", ")} изменены после применения в облаке — исправление новым файлом миграции.`,
    );
  }
}
