// Netlify Scheduled Function (решение фазы 3): раз в 5 минут — повтор доставки заявок и тревога,
// раз в час — очистка кодов «Написать в Telegram» и старых событий сайта. Сама работа — на сайте (/api/cron/<работа>),
// здесь только вызов с секретом. URL — адрес сайта Netlify.

async function run(site: string, secret: string, job: string): Promise<void> {
  const response = await fetch(`${site}/api/cron/${job}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!response.ok) console.error(`[cron] /api/cron/${job} ответил`, response.status);
}

export default async function cron(): Promise<void> {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return;
  await run(site, secret, "leads");
  if (new Date().getUTCMinutes() < 5) {
    await run(site, secret, "tg-starts");
    await run(site, secret, "events");
  }
}

// Тип Config из @netlify/functions не ставим ради одной строки: Netlify читает объект как есть.
export const config = { schedule: "*/5 * * * *" };
