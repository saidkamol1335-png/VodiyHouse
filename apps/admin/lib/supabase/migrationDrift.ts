// Применённую миграцию правили в файле (2.9б: 20261024100000 дописывали после db push — облако
// жило со старыми функциями, а «все миграции применены» говорили и db push, и cloud:check).
// Облако хранит текст каждой применённой миграции — supabase_migrations.schema_migrations.statements,
// по оператору; сверяем без пробелов и «;». Без импортов: файл подключают scripts/cloud-check.mjs
// и tests/db/remote.ts.

export type AppliedMigration = { version: string; statements?: string[] | null };

const fingerprint = (sql: string) => sql.replace(/\s+/g, "").replace(/;/g, "");

/** Версии, чей файл отличается от применённого текста; нет файла или текста — не сверяем. */
export function editedMigrations(
  applied: readonly AppliedMigration[],
  files: ReadonlyMap<string, string>,
): string[] {
  return applied
    .filter(({ version, statements }) => {
      const file = files.get(version);
      if (file === undefined || !statements) return false;
      return fingerprint(statements.join("")) !== fingerprint(file);
    })
    .map(({ version }) => version);
}
