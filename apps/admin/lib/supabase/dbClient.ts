// Подключение pg к облачной базе по SUPABASE_DB_URL (Session pooler): cloud:check, demo:seed,
// test:db:remote. Без импортов: файл подключают скрипты .mjs (Node 24 читает .ts сам).
//
// Адрес из панели Supabase — без sslmode, и pg с ним идёт открытым текстом (сессия владельца
// postgres через интернет). А `sslmode=require` в pg означает verify-full: сертификат пулера
// выписан собственным CA Supabase, и без sslrootcert такая проверка падает. Поэтому по умолчанию —
// TLS без проверки сертификата (шифрует от прослушки). Полная проверка — в самом адресе:
// `?sslmode=verify-full&sslrootcert=<prod-ca-2021.crt>`; параметры адреса pg ставит выше этих.

export type DbClientConfig = { connectionString: string; ssl: { rejectUnauthorized: boolean } };

export function dbClientConfig(connectionString: string): DbClientConfig {
  return { connectionString, ssl: { rejectUnauthorized: false } };
}
