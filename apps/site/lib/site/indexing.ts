// Тестовый деплой (решение фазы 3, Ф2) закрыт от поисковиков целиком: SITE_NOINDEX=1 в окружении
// сборки. Без импортов: файл читает и next.config.ts.

type Env = Record<string, string | undefined>;

export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" } as const;

/** Сайт закрыт от индексации — тестовый деплой; на боевом домене переменной нет. */
export function isIndexingClosed(env: Env = process.env): boolean {
  return env.SITE_NOINDEX === "1";
}
