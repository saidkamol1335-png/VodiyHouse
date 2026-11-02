// Адрес кабинета для абсолютных ссылок (Telegram, письма сотрудникам) — PLAN §10: кабинет живёт на
// своём домене. ADMIN_URL — если задан (боевой admin.vodiyhouse.uz); на Netlify — URL основного
// адреса сайта Netlify админки; иначе — боевой домен. Ссылки на публичные страницы — siteOrigin().
const PRODUCTION_ADMIN_ORIGIN = "https://admin.vodiyhouse.uz";

type Env = Record<string, string | undefined>;

export function adminOrigin(env: Env = process.env): string {
  // || , а не ??: пустая переменная окружения — как не заданная.
  return (env.ADMIN_URL || env.URL || PRODUCTION_ADMIN_ORIGIN).replace(/\/+$/, "");
}
