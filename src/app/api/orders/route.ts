import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, getOrder } from "@/core/orders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  planId: z.string().min(1),
  email: z.string().email().optional(),
  telegramId: z.number().int().positive().optional(),
  promoCode: z.string().max(40).optional(),
  orderId: z.string().optional(), // уже созданный заказ (из buy-panel)
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Проверьте данные заказа" }, { status: 400 });
  }
  const { orderId, ...input } = parsed.data;

  // Если заказ уже создан (промокод проверен на странице тарифа) — просто возвращаем
  if (orderId) {
    const order = await getOrder(orderId);
    if (order && order.status === "AWAITING_PAYMENT") {
      return NextResponse.json({ ok: true, order: { id: order.id, number: order.number, totalCents: order.total_cents } });
    }
  }

  const res = await createOrder(input);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    order: { id: res.order.id, number: res.order.number, totalCents: res.order.total_cents },
  });
}
