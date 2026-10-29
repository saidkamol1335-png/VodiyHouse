// Источники посетителей (фаза 6, панель «Источники» мокапа CabStats): в базе — utm_source первого
// захода или домен, откуда пришли (events.source); здесь — канал для подписи. Решение: подписи
// в коде, не в базе — новый канал добавляется без миграции.

export const STATS_CHANNELS = [
  "instagram",
  "telegram",
  "google",
  "facebook",
  "yandex",
  "youtube",
  "direct",
  "other",
] as const;
export type StatsChannel = (typeof STATS_CHANNELS)[number];

const RULES: readonly [StatsChannel, RegExp][] = [
  ["instagram", /^(ig|insta|instagram)$|(^|\.)instagram\.com$/],
  ["telegram", /^(tg|telegram)$|(^|\.)(t\.me|telegram\.(org|me))$/],
  [
    "google",
    /^(google|googleads|adwords|gads)$|(^|\.)google(\.[a-z]{2,3}){1,2}$|(^|\.)googleadservices\.com$/,
  ],
  ["facebook", /^(fb|facebook|meta)$|(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  ["yandex", /^(yandex|ya)$|(^|\.)(yandex(\.[a-z]{2,3}){1,2}|ya\.ru)$/],
  ["youtube", /^(yt|youtube)$|(^|\.)(youtube\.com|youtu\.be)$/],
];

/** «instagram», «l.instagram.com», «IG» → instagram; пусто — прямой заход; незнакомое — «Другие». */
export function statsChannel(source: string | null): StatsChannel {
  const value = source?.trim().toLowerCase();
  if (!value) return "direct";
  return RULES.find(([, rule]) => rule.test(value))?.[0] ?? "other";
}

/** Строки базы по сырому источнику → посетители по каналам (у посетителя один источник — суммы честные). */
export function visitorsByChannel(
  rows: readonly { source: string | null; visitors: number }[],
): { key: StatsChannel; value: number }[] {
  const sums = new Map<StatsChannel, number>();
  for (const row of rows) {
    const channel = statsChannel(row.source);
    sums.set(channel, (sums.get(channel) ?? 0) + row.visitors);
  }
  return [...sums].map(([key, value]) => ({ key, value }));
}
