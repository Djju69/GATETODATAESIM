import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyPromoToOrder } from "@/core/orders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ code: z.string().min(1).max(40) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Введите промокод" }, { status: 400 });

  const res = await applyPromoToOrder(id, parsed.data.code);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    discountCents: res.order.discount_cents,
    totalCents: res.order.total_cents,
  });
}
