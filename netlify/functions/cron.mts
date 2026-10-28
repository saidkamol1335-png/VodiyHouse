// Netlify Scheduled Function (решение фазы 3): раз в 5 минут — повтор доставки заявок и тревога,
// раз в час — очистка кодов «Написать в Telegram» и старых событий сайта, раз в сутки — архив и курс ЦБ.
// Сама работа — на сайте (/api/cron/<работа>), здесь только вызов с секретом. URL — адрес сайта Netlify.

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
  const now = new Date();
  if (now.getUTCMinutes() < 5) {
    await run(site, secret, "tg-starts");
    await run(site, secret, "events");
    // Раз в сутки, в 03:00 по Ташкенту (22:00 UTC): архив — ночью, когда сайтом не пользуются;
    // курс ЦБ — уже на наступивший день (ЦБ публикует его накануне).
    if (now.getUTCHours() === 22) {
      await run(site, secret, "archive");
      await run(site, secret, "rate");
    }
  }
}

// Тип Config из @netlify/functions не ставим ради одной строки: Netlify читает объект как есть.
export const config = { schedule: "*/5 * * * *" };
