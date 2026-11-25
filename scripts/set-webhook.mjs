/**
 * Устанавливает Telegram webhook на заданный домен.
 * Запуск после деплоя: node scripts/set-webhook.mjs https://ваш-домен.vercel.app
 * (или задайте BASE_URL в .env и запустите без аргументов)
 */
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const read = (k) => env.split(/\r?\n/).find((l) => l.startsWith(k + "="))?.split("=").slice(1).join("=").trim();

const token = read("TELEGRAM_BOT_TOKEN");
const secret = read("TELEGRAM_WEBHOOK_SECRET");
const baseUrl = (process.argv[2] || read("BASE_URL") || "").replace(/\/$/, "");

if (!token) { console.error("❌ TELEGRAM_BOT_TOKEN не задан"); process.exit(1); }
if (!baseUrl || !baseUrl.startsWith("https://")) {
  console.error("❌ Укажите HTTPS-домен: node scripts/set-webhook.mjs https://project.vercel.app");
  process.exit(1);
}

const url = `${baseUrl}/api/telegram`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret || undefined, drop_pending_updates: true, allowed_updates: ["message", "callback_query", "pre_checkout_query"] }),
});
const body = await res.json();
if (body.ok) {
  console.log(`✅ Webhook установлен: ${url}`);
} else {
  console.error("❌ Ошибка:", body.description);
  process.exit(1);
}
const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
console.log(JSON.stringify(info.result, null, 2));
