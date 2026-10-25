// Netlify Scheduled Function (решение фазы 3): раз в 5 минут — повтор доставки заявок и тревога.
// Сама работа — на сайте (/api/cron/leads), здесь только вызов с секретом. URL — адрес сайта Netlify.

export default async function cron(): Promise<void> {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return;
  const response = await fetch(`${site}/api/cron/leads`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!response.ok) console.error("[cron] /api/cron/leads ответил", response.status);
}

// Тип Config из @netlify/functions не ставим ради одной строки: Netlify читает объект как есть.
export const config = { schedule: "*/5 * * * *" };
