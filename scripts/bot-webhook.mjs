// Вебхук бота «Написать в Telegram» (шаг 3.8): npm run bot:webhook — Telegram будет присылать
// сообщения боту на <SITE_URL>/api/telegram с секретом TELEGRAM_WEBHOOK_SECRET в заголовке.
// Токен и секрет — из .env.local, в вывод не попадают. --off — снять вебхук.

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = (process.env.SITE_URL || "").replace(/\/+$/, "");
const off = process.argv.includes("--off");

if (!token) throw new Error("Нет TELEGRAM_BOT_TOKEN в .env.local");
if (!off && (!secret || secret.length < 16)) throw new Error("TELEGRAM_WEBHOOK_SECRET — от 16 знаков (буквы, цифры, _ и -)");
if (!off && !site.startsWith("https://")) throw new Error("SITE_URL — адрес сайта по https (Telegram не шлёт на http и localhost)");

const method = off ? "deleteWebhook" : "setWebhook";
const body = off
  ? {}
  : { url: `${site}/api/telegram`, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true };
const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const result = await response.json();
console.log(result.ok ? `Готово: ${method}${off ? "" : ` → ${site}/api/telegram`}` : `Telegram ответил: ${result.description}`);
if (!result.ok) process.exitCode = 1;
