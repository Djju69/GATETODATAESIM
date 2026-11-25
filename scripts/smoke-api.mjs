/** Разовый smoke-тест API: заказ → промокод → статус. Запуск: node scripts/smoke-api.mjs [port] */
const BASE = `http://localhost:${process.argv[2] ?? 3010}`;

async function j(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const { default: postgres } = await import("postgres");
const { config } = await import("../src/core/config.ts").catch(() => ({ config: null }));
const fs = await import("node:fs");
const env = fs.readFileSync(".env", "utf8");
const url = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))?.split("=").slice(1).join("=").trim();
const sql = postgres(url, { prepare: false, max: 1 });
const plan = (await sql`SELECT id, title, retail_cents FROM plans WHERE active=1 LIMIT 1`)[0];
if (!plan) {
  console.error("Каталог пуст — сначала npm run seed-demo");
  process.exit(1);
}
console.log("План:", plan.title, (plan.retail_cents / 100).toFixed(2) + "$");

const created = await j("POST", "/api/orders", { planId: plan.id, email: "smoke@test.local" });
console.log("createOrder:", created.status, JSON.stringify(created.body));
if (!created.body.ok) process.exit(1);
const orderId = created.body.order.id;

const promo = await j("POST", `/api/orders/${orderId}/promo`, { code: "WELCOME1" });
console.log("applyPromo:", promo.status, JSON.stringify(promo.body));

const status = await j("GET", `/api/orders/${orderId}/status`);
console.log("status:", status.status, JSON.stringify(status.body));

const pay = await j("POST", `/api/orders/${orderId}/pay`, { method: "usdt" });
console.log("pay(usdt):", pay.status, JSON.stringify(pay.body));

// Уборка тестового заказа (сначала события — FK)
await sql`DELETE FROM order_events WHERE order_id = ${orderId}`;
await sql`DELETE FROM payments WHERE order_id = ${orderId}`;
await sql`DELETE FROM orders WHERE id = ${orderId}`;
await sql.end();
console.log("Тестовый заказ удалён. ✅ smoke-api завершён");
