import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUsdtTxByHash } from "@/core/payments/usdt";
import { provisionOrder } from "@/core/orders";
import { getOrder } from "@/core/orders";
import { notifyOrderDelivered } from "@/core/telegram";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ txId: z.string().min(10).max(128) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Введите хеш транзакции (TxID)" }, { status: 400 });
  }

  const res = await verifyUsdtTxByHash(id, parsed.data.txId);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  // Платёж подтверждён — выдаём eSIM (идемпотентно)
  const prov = await provisionOrder(id);
  const order = await getOrder(id);
  if (prov.ok && order?.status === "DELIVERED") {
    await notifyOrderDelivered(order);
    return NextResponse.json({ ok: true, deliveryToken: order.delivery_token });
  }
  if (!prov.ok) {
    return NextResponse.json({ ok: true, error: prov.message, status: order?.status });
  }
  return NextResponse.json({ ok: true, status: order?.status, deliveryToken: order?.status === "DELIVERED" ? order.delivery_token : undefined });
}
