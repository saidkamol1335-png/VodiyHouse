// Netlify Scheduled Function (решение фазы 3): раз в 5 минут — повтор доставки заявок и тревога,
// раз в час — очистка кодов «Написать в Telegram» и старых событий сайта, раз в сутки — архив.
// Сама работа — на сайте (/api/cron/<работа>), здесь только вызов с секретом. URL — адрес сайта Netlify.

async function run(site: string, secret: string, job: string): Promise<void> {
  const response = await fetch(`${site}/api/cron/${job}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 300);
    console.error(`[cron] /api/cron/${job} ответил`, response.status, body);
  }
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
    // Архив — раз в сутки, в 03:00 по Ташкенту (22:00 UTC): ночью, когда сайтом не пользуются.
    // Курса ЦБ здесь нет: cbu.uz закрыт из-за рубежа, с Netlify — тайм-аут. Курс кладёт
    // `npm run rate:update` из Узбекистана (решение исполнителя 28.10.2026, PROGRESS).
    if (now.getUTCHours() === 22) await run(site, secret, "archive");
  }
}

// Тип Config из @netlify/functions не ставим ради одной строки: Netlify читает объект как есть.
export const config = { schedule: "*/5 * * * *" };
