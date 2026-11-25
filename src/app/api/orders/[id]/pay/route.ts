import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrder } from "@/core/orders";
import { createStarsInvoiceLink } from "@/core/payments/stars";
import { createUsdtInvoice } from "@/core/payments/usdt";
import { run, nowIso } from "@/core/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ method: z.enum(["stars", "usdt"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Неизвестный способ оплаты" }, { status: 400 });

  const order = await getOrder(id);
  if (!order) return NextResponse.json({ ok: false, error: "Заказ не найден" }, { status: 404 });
  if (order.status !== "AWAITING_PAYMENT") {
    return NextResponse.json({ ok: false, error: "Заказ уже оплачен или отменён" }, { status: 400 });
  }

  try {
    if (parsed.data.method === "stars") {
      const payUrl = await createStarsInvoiceLink(order);
      await run("UPDATE orders SET payment_method = 'stars', payment_ref = ?, updated_at = ? WHERE id = ?", payUrl, nowIso(), id);
      return NextResponse.json({ ok: true, payUrl });
    }
    if (parsed.data.method === "usdt") {
      const inv = createUsdtInvoice(order);
      await run("UPDATE orders SET payment_method = 'usdt' WHERE id = ?", id);
      return NextResponse.json({ ok: true, invoice: inv });
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ошибка платёжного провайдера" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: false, error: "Способ оплаты недоступен" }, { status: 400 });
}
