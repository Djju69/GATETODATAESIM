/**
 * Локальный запуск бота в long polling: npm run bot
 * На Vercel бот работает в webhook-режиме через /api/telegram — этот файл там не нужен.
 */
import { bot } from "./bot";
import { all } from "../core/db";
import { checkIncomingPayments } from "../core/payments/usdt";
import { provisionOrder, getOrder } from "../core/orders";
import { sendEsimToTelegram, notifyAdmin } from "../core/telegram";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN не настроен. Скопируйте .env.example в .env и заполните.");
  process.exit(1);
}

/* Периодическая проверка USDT-платежей (в webhook-режиме её заменяет /api/cron/usdt + lazy-проверка) */
setInterval(() => {
  checkIncomingPayments()
    .then(async (n) => {
      if (n > 0) console.log(`USDT: подтверждено платежей: ${n}`);
      // Выдаём eSIM для недавно оплаченных USDT-заказов
      const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
      const toProvision = await all<{ id: string; number: string }>(
        `SELECT id, number FROM orders
         WHERE status='PAID' AND payment_method='usdt' AND paid_at > ?`,
        cutoff
      );
      for (const o of toProvision) {
        const res = await provisionOrder(o.id);
        const fresh = await getOrder(o.id);
        if (!fresh) continue;
        if (res.ok && fresh.telegram_id) await sendEsimToTelegram(fresh.telegram_id, fresh);
        if (!res.ok) {
          await notifyAdmin(`⚠️ Ошибка выдачи ${o.number}: ${res.message}`);
          console.error(`Provision failed for ${o.number}: ${res.message}`);
        }
      }
    })
    .catch((e) => console.warn("USDT check error:", e));
}, 60_000);

bot.start({
  onStart: (me) => {
    console.log(`✅ Бот @${me.username} запущен (long polling)`);
  },
});
