/** Промокоды: валидация и применение. Условия зеркалят кампанию TELMO ($1, min $5, первый заказ). */
import { all, get, run, uuid, nowIso } from "./db";

export interface PromoCode {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_order_cents: number;
  max_uses: number | null;
  used_count: number;
  per_user_limit: number;
  first_order_only: number;
  description: string | null;
  active: number;
  ends_at: string | null;
}

export interface PromoCheck {
  ok: boolean;
  reason?: string;
  discountCents?: number;
  promo?: PromoCode;
}

export function userKeyFor(email?: string | null, telegramId?: number | null): string {
  if (telegramId) return `tg:${telegramId}`;
  return (email ?? "").toLowerCase().trim();
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function checkPromo(
  code: string,
  subtotalCents: number,
  userKey: string
): Promise<PromoCheck> {
  const promo = await get<PromoCode>("SELECT * FROM promo_codes WHERE code = ?", normalizeCode(code));
  if (!promo || !promo.active) return { ok: false, reason: "Промокод не найден или отключён" };
  if (promo.ends_at && new Date(promo.ends_at) < new Date()) return { ok: false, reason: "Срок действия промокода истёк" };
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) return { ok: false, reason: "Лимит использований промокода исчерпан" };
  if (subtotalCents < promo.min_order_cents) {
    return { ok: false, reason: `Промокод действует от $${(promo.min_order_cents / 100).toFixed(0)}` };
  }
  const redemptions = await get<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM promo_redemptions WHERE promo_code = ? AND user_key = ?",
    promo.code, userKey
  );
  if ((redemptions?.c ?? 0) >= promo.per_user_limit) return { ok: false, reason: "Вы уже использовали этот промокод" };
  if (promo.first_order_only) {
    const paid = await get<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM orders
       WHERE (LOWER(email) = ? OR telegram_id = ?) AND status IN ('PAID','PROVISIONING','DELIVERED')`,
      (userKey.startsWith("tg:") ? "" : userKey),
      userKey.startsWith("tg:") ? Number(userKey.slice(3)) : -1
    );
    if ((paid?.c ?? 0) > 0) return { ok: false, reason: "Промокод действует только на первый заказ" };
  }
  const discount =
    promo.kind === "percent"
      ? Math.round((subtotalCents * promo.value) / 100)
      : Math.min(promo.value, subtotalCents);
  return { ok: true, discountCents: discount, promo };
}

/** Фиксирует использование промокода при оплате заказа. */
export async function recordRedemption(promoCode: string, orderId: string, userKey: string) {
  const exists = await get("SELECT 1 AS x FROM promo_redemptions WHERE promo_code = ? AND order_id = ?", promoCode, orderId);
  if (exists) return;
  await run(
    "INSERT INTO promo_redemptions(id, promo_code, order_id, user_key, created_at) VALUES(?,?,?,?,?)",
    uuid(), promoCode, orderId, userKey, nowIso()
  );
  await run("UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?", promoCode);
}

export async function listPromos() {
  return all<PromoCode>("SELECT * FROM promo_codes ORDER BY created_at DESC");
}

export async function upsertPromo(p: {
  code: string; kind: "percent" | "fixed"; value: number;
  min_order_cents?: number; max_uses?: number | null; per_user_limit?: number;
  first_order_only?: boolean; description?: string; ends_at?: string | null;
}) {
  const code = normalizeCode(p.code);
  await run(
    `INSERT INTO promo_codes(code, kind, value, min_order_cents, max_uses, used_count, per_user_limit,
      first_order_only, description, active, ends_at, created_at)
     VALUES(?,?,?,?,?,0,?,?,?,?,1,?)
     ON CONFLICT(code) DO UPDATE SET
       kind=excluded.kind, value=excluded.value, min_order_cents=excluded.min_order_cents,
       max_uses=excluded.max_uses, per_user_limit=excluded.per_user_limit,
       first_order_only=excluded.first_order_only, description=excluded.description,
       active=excluded.active, ends_at=excluded.ends_at`,
    code, p.kind, p.value, p.min_order_cents ?? 0, p.max_uses ?? null, p.per_user_limit ?? 1,
    p.first_order_only ? 1 : 0, p.description ?? null, p.ends_at ?? null, nowIso()
  );
}
