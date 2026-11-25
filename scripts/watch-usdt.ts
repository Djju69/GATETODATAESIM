/**
 * Фоновый наблюдатель USDT-платежей: опрашивает TronGrid и подтверждает заказы.
 * На Vercel не нужен (подтверждение происходит лениво при поллинге статуса),
 * для VPS — запуск: npm run watch:usdt
 */
import { db, all } from "../src/core/db";
import { checkIncomingPayments } from "../src/core/payments/usdt";
import { provisionOrder, getOrderByNumber } from "../src/core/orders";
import { notifyOrderDelivered, notifyAdmin } from "../src/core/telegram";

async function tick() {
  const n = await checkIncomingPayments();
  if (n > 0) {
    console.log(`[${new Date().toISOString()}] Подтверждено USDT-платежей: ${n}`);
    // Выдаём eSIM для недавно оплаченных USDT-заказов
    const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    const recent = await all<{ id: string; number: string }>(
      `SELECT id, number FROM orders
       WHERE status='PAID' AND payment_method='usdt' AND paid_at > ?`,
      cutoff
    );
    for (const o of recent) {
      console.log(`⚙️ Выдаём eSIM для ${o.number}…`);
      const res = await provisionOrder(o.id);
      if (res.ok) {
        const order = await getOrderByNumber(o.number);
        if (order) {
          await notifyOrderDelivered(order);
          console.log(`✅ ${o.number} выдан`);
        }
      } else {
        await notifyAdmin(`⚠️ Ошибка выдачи ${o.number}: ${res.message}`);
        console.error(`❌ ${o.number}: ${res.message}`);
      }
    }
  }
}

async function main() {
  db();
  console.log("👀 USDT watcher запущен (проверка каждые 60 сек). Ctrl+C для остановки.");
  await tick();
  setInterval(() => tick().catch((e) => console.warn("tick error:", e)), 60_000);
}

main();
