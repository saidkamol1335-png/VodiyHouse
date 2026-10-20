// Ключи Supabase — только из окружения (PLAN §0.13). Публичные — с префиксом NEXT_PUBLIC_.
// Подходят и новые ключи (sb_publishable_… / sb_secret_…), и старые (anon / service_role).

export type SupabasePublicEnv = { url: string; publishableKey: string };

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Нет переменной окружения ${name}. Скопируйте .env.example в .env.local и заполните.`);
  }
  return value;
}

export function supabasePublicEnv(): SupabasePublicEnv {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function supabaseSecretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

// Проверки без исключения: кабинет и proxy решают по ним, открывать ли кабинет без входа,
// а `npm run build` проходит и с пустым .env.local. Обращение к process.env — буквальное,
// чтобы Next.js подставил NEXT_PUBLIC_ при сборке.

/** Есть адрес и публичный ключ — можно входить. */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/** Есть и секретный ключ — можно создавать и отключать сотрудников. */
export function hasSupabaseAdminEnv(): boolean {
  return hasSupabaseEnv() && Boolean(process.env.SUPABASE_SECRET_KEY);
}
