import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/core/admin-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await login(parsed.data.password);
  return NextResponse.json({ ok });
}
