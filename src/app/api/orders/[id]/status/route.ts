import { NextRequest, NextResponse } from "next/server";
import { getOrder, provisionOrder } from "@/core/orders";
import { checkIncomingPayments } from "@/core/payments/usdt";
import { notifyOrderDelivered } from "@/core/telegram";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ ok: false, error: "Заказ не найден" }, { status: 404 });

  // Попутная быстрая проверка USDT при ожидании оплаты
  if (order.status === "AWAITING_PAYMENT" && order.payment_method === "usdt") {
    try {
      await checkIncomingPayments();
    } catch { /* не критично */ }
  }

  // Если платёж уже подтверждён — выдаём eSIM (идемпотентно)
  let fresh = (await getOrder(id))!;
  if (fresh.status === "PAID") {
    await provisionOrder(id);
    fresh = (await getOrder(id))!;
    if (fresh.status === "DELIVERED") {
      await notifyOrderDelivered(fresh);
    }
  }

  return NextResponse.json({
    ok: true,
    status: fresh.status,
    deliveryToken: fresh.status === "DELIVERED" ? fresh.delivery_token : undefined,
  });
}
