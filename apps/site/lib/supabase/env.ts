// Ключи Supabase — только из окружения (PLAN §0.13). У сайта — только публичные, с префиксом
// NEXT_PUBLIC_: секретного ключа у сайта нет (PLAN §10), записи — подписанными функциями.

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


// Проверка без исключения: `npm run build` проходит и с пустым .env.local. Обращение к process.env — буквальное,
// чтобы Next.js подставил NEXT_PUBLIC_ при сборке.

/** Есть адрес и публичный ключ — сайт читает облако. */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

