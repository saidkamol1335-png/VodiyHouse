// Тесты базы против облака (решение фазы 1, в. 1): заглушка Supabase в PGlite могла
// разойтись с настоящим Supabase — этот прогон ловит расхождение до приёмки.
// Каждый тестовый файл работает в одной транзакции и в конце откатывает её: в облаке ничего
// не остаётся. Внутри транзакции контент облака временно убирается, чтобы подсчёты были как
// на чистой базе (справочники — как в миграциях).

import pg from "pg";
import { claimsOf, migrationFiles, PG_ROLE, type Actor, type Db, type TestDb } from "./harness";

const SANDBOX_CLEANUP = `
  delete from public.complexes;
  delete from public.developers;
  delete from public.settings;
  delete from public.hints;
  delete from public.profiles;
  delete from public.audit_log;
`;

export async function createRemoteTestDb(): Promise<TestDb> {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Нет SUPABASE_DB_URL в .env.local — см. .env.example.");

  const client = new pg.Client({ connectionString });
  await client.connect();
  await assertMigrationsApplied(client);
  await client.query("begin");
  await client.query(SANDBOX_CLEANUP);

  const admin: Db = {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], affectedRows: result.rowCount ?? 0 };
    },
    exec: (sql: string) => {
      // Фиксация транзакции оставила бы тестовые строки в облаке — такие запросы запрещены.
      if (/\bcommit\b/i.test(sql)) throw new Error("В облачном прогоне commit запрещён");
      return client.query(sql);
    },
  };

  // Каждая служебная команда — отдельным запросом: медленнее, но откат после ошибки проходит
  // наверняка, иначе транзакция файла остаётся прерванной и следующие тесты падают не по своей вине.
  let savepoints = 0;
  const as = async <T>(actor: Actor, run: (db: Db) => Promise<T>): Promise<T> => {
    const savepoint = `as_${(savepoints += 1)}`;
    await client.query(`savepoint ${savepoint}`);
    try {
      await client.query("select set_config('request.jwt.claims', $1, true)", [claimsOf(actor)]);
      await client.query(`set local role ${PG_ROLE[actor.kind]}`);
      const result = await run(admin);
      await client.query("reset role");
      await client.query("select set_config('request.jwt.claims', '', true)");
      await client.query(`release savepoint ${savepoint}`);
      return result;
    } catch (error) {
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

async function assertMigrationsApplied(client: pg.Client): Promise<void> {
  const local = (await migrationFiles()).map((file) => file.split("_")[0]!);
  const { rows } = await client.query<{ version: string }>(
    "select version from supabase_migrations.schema_migrations",
  );
  const applied = new Set(rows.map((row) => row.version));
  const missing = local.filter((version) => !applied.has(version));
  if (missing.length > 0) {
    throw new Error(`В облаке нет миграций ${missing.join(", ")} — выполни npm run db:push.`);
  }
}
