/** Vercel Cron — страховка USDT-подтверждений (ленивая проверка также идёт при поллинге статуса). */
import { all } from "@/core/db";
import { checkIncomingPayments } from "@/core/payments/usdt";
import { provisionOrder, getOrder } from "@/core/orders";
import { sendEsimToTelegram, notifyAdmin } from "@/core/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  // Vercel Cron присылает Authorization: Bearer $CRON_SECRET, если переменная задана
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let confirmed = 0;
  try {
    confirmed = await checkIncomingPayments();
  } catch (e) {
    console.warn("cron usdt check failed:", e);
  }

  // Выдаём eSIM для недавно оплаченных USDT-заказов
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  let provisioned = 0;
  try {
    const toProvision = await all<{ id: string; number: string }>(
      `SELECT id, number FROM orders
       WHERE status='PAID' AND payment_method='usdt' AND paid_at > ?`,
      cutoff
    );
    for (const o of toProvision) {
      const res = await provisionOrder(o.id);
      const fresh = await getOrder(o.id);
      if (!fresh) continue;
      if (res.ok) {
        provisioned += 1;
        if (fresh.telegram_id) await sendEsimToTelegram(fresh.telegram_id, fresh);
      } else {
        await notifyAdmin(`⚠️ Ошибка выдачи ${o.number}: ${res.message}`);
      }
    }
  } catch (e) {
    console.warn("cron provision failed:", e);
  }

  return Response.json({ ok: true, confirmed, provisioned });
}
