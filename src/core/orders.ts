/**
 * Заказы — state machine.
 * DRAFT → AWAITING_PAYMENT → PAID → PROVISIONING → DELIVERED
 *                        ↘ FAILED (провайдер) / CANCELLED / EXPIRED
 * Выдача eSIM только из PAID, идемпотентно.
 */
import { all, get, run, uuid, nowIso, tx, logProviderError, audit } from "./db";
import { getPlan, PlanRow } from "./catalog";
import { checkPromo, recordRedemption, userKeyFor } from "./promos";
import { getProvider } from "./providers/telmo";

export type OrderStatus =
  | "AWAITING_PAYMENT" | "PAID" | "PROVISIONING" | "DELIVERED"
  | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";

export interface OrderRow {
  id: string;
  number: string;
  user_id: string | null;
  email: string | null;
  telegram_id: number | null;
  plan_id: string;
  plan_snapshot: string;
  status: OrderStatus;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  promo_code: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  usdt_amount: string | null;
  usdt_tx: string | null;
  paid_at: string | null;
  provider_order_id: string | null;
  provider_status: string | null;
  esim_iccid: string | null;
  esim_lpa: string | null;
  esim_qr_data: string | null;
  esim_activation_url: string | null;
  esim_expires_at: string | null;
  esim_state: string | null;
  delivery_token: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface PlanSnapshot {
  planId: string;
  title: string;
  countryNameRu: string | null;
  regionName: string | null;
  kind: string;
  dataMb: number;
  validityDays: number;
  operators: string | null;
  networks: string | null;
  wholesaleCents: number;
  retailCents: number;
}

export function snapshotOf(plan: PlanRow): PlanSnapshot {
  return {
    planId: plan.id,
    title: plan.title,
    countryNameRu: plan.country_name_ru,
    regionName: plan.region_name,
    kind: plan.kind,
    dataMb: plan.data_mb,
    validityDays: plan.validity_days,
    operators: plan.operators,
    networks: plan.networks,
    wholesaleCents: plan.wholesale_cents,
    retailCents: plan.retail_cents,
  };
}

function genNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `GD-${ymd}-${rnd}`;
}

export async function getOrder(id: string): Promise<OrderRow | undefined> {
  return get<OrderRow>("SELECT * FROM orders WHERE id = ?", id);
}

export async function getOrderByNumber(number: string): Promise<OrderRow | undefined> {
  return get<OrderRow>("SELECT * FROM orders WHERE number = ?", number);
}

export async function getOrderByDeliveryToken(token: string): Promise<OrderRow | undefined> {
  return get<OrderRow>("SELECT * FROM orders WHERE delivery_token = ?", token);
}

export async function orderEvents(orderId: string) {
  return all<{ id: string; type: string; payload: string | null; created_at: string }>(
    "SELECT id, type, payload, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC",
    orderId
  );
}

async function logEvent(orderId: string, type: string, payload?: unknown) {
  await run("INSERT INTO order_events(id, order_id, type, payload, created_at) VALUES(?,?,?,?,?)",
    uuid(), orderId, type, payload ? JSON.stringify(payload) : null, nowIso());
}

export async function ensureUserByEmail(email: string, telegramId?: number, name?: string): Promise<string> {
  const norm = email.toLowerCase().trim();
  const existing = await get<{ id: string }>("SELECT id FROM users WHERE email = ?", norm);
  if (existing) {
    if (telegramId) await run("UPDATE users SET telegram_id = COALESCE(telegram_id, ?) WHERE id = ?", telegramId, existing.id);
    return existing.id;
  }
  const id = uuid();
  await run("INSERT INTO users(id, email, telegram_id, name, created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING",
    id, norm, telegramId ?? null, name ?? null, nowIso());
  const row = await get<{ id: string }>("SELECT id FROM users WHERE email = ?", norm);
  return row!.id;
}

/* ---------------- Создание заказа ---------------- */

export interface CreateOrderInput {
  planId: string;
  email?: string;
  telegramId?: number;
  promoCode?: string;
  source?: "web" | "bot" | "miniapp" | "admin";
}

export async function createOrder(input: CreateOrderInput): Promise<{ ok: true; order: OrderRow } | { ok: false; error: string }> {
  const plan = await getPlan(input.planId);
  if (!plan) return { ok: false, error: "Тариф не найден или недоступен" };
  if (!input.email && !input.telegramId) return { ok: false, error: "Укажите email для получения eSIM" };

  const email = input.email?.toLowerCase().trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { ok: false, error: "Некорректный email" };

  const userId = input.telegramId
    ? await ensureUserByEmail(email || `tg-${input.telegramId}@gatetodata.local`, input.telegramId)
    : await ensureUserByEmail(email!);

  const subtotal = plan.retail_cents;
  const userKey = userKeyFor(email, input.telegramId);

  let discount = 0;
  let promoCode: string | null = null;
  if (input.promoCode) {
    const check = await checkPromo(input.promoCode, subtotal, userKey);
    if (!check.ok) return { ok: false, error: check.reason ?? "Промокод не применён" };
    discount = check.discountCents ?? 0;
    promoCode = check.promo!.code;
  }

  const id = uuid();
  const tokenStr = Math.random().toString(36).slice(2) + uuid().replace(/-/g, "");
  const snapshot = snapshotOf(plan);

  await tx(async () => {
    await run(
      `INSERT INTO orders(id, number, user_id, email, telegram_id, plan_id, plan_snapshot, status,
        currency, subtotal_cents, discount_cents, total_cents, promo_code, delivery_token, source, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,'AWAITING_PAYMENT','USD',?,?,?,?,?,?,?,?)`,
      id, genNumber(), userId, email ?? null, input.telegramId ?? null, plan.id, JSON.stringify(snapshot),
      subtotal, discount, subtotal - discount, promoCode, tokenStr, input.source ?? "web", nowIso(), nowIso()
    );
    await logEvent(id, "created", { planId: plan.id, promoCode, discount });
  });

  return { ok: true, order: (await getOrder(id))! };
}

/** Пересчитать заказ с промокодом (до оплаты). */
export async function applyPromoToOrder(orderId: string, code: string): Promise<{ ok: true; order: OrderRow } | { ok: false; error: string }> {
  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.status !== "AWAITING_PAYMENT") return { ok: false, error: "Заказ уже оплачен — промокод нельзя изменить" };
  const userKey = userKeyFor(order.email, order.telegram_id);
  const check = await checkPromo(code, order.subtotal_cents, userKey);
  if (!check.ok) return { ok: false, error: check.reason ?? "Промокод не применён" };
  await run("UPDATE orders SET promo_code = ?, discount_cents = ?, total_cents = ?, updated_at = ? WHERE id = ?",
    check.promo!.code, check.discountCents ?? 0, order.subtotal_cents - (check.discountCents ?? 0), nowIso(), orderId);
  await logEvent(orderId, "promo_applied", { code: check.promo!.code, discount: check.discountCents });
  return { ok: true, order: (await getOrder(orderId))! };
}

export async function cancelOrder(orderId: string, actor: string) {
  await tx(async () => {
    const r = await run(
      "UPDATE orders SET status='CANCELLED', updated_at=? WHERE id=? AND status='AWAITING_PAYMENT'",
      nowIso(), orderId
    );
    if (r.changes > 0) await logEvent(orderId, "cancelled", { actor });
  });
  await audit(actor, "order.cancel", "order", orderId);
}

/* ---------------- Оплата ---------------- */

/** Подтверждение платежа. Идемпотентно: повторный вызов не создаёт второго платежа. */
export async function confirmPayment(params: {
  orderId: string;
  provider: "stars" | "usdt" | "manual";
  externalId: string;
  amountCents: number;
  raw?: unknown;
}): Promise<{ ok: boolean; status: OrderStatus; alreadyPaid: boolean; error?: string }> {
  const order = await getOrder(params.orderId);
  if (!order) return { ok: false, alreadyPaid: false, status: "CANCELLED", error: "Заказ не найден" };

  if (["PAID", "PROVISIONING", "DELIVERED"].includes(order.status)) {
    return { ok: true, alreadyPaid: true, status: order.status };
  }
  if (order.status !== "AWAITING_PAYMENT") {
    return { ok: false, alreadyPaid: false, status: order.status, error: `Заказ в статусе ${order.status}` };
  }
  if (params.amountCents < order.total_cents) {
    return { ok: false, alreadyPaid: false, status: order.status, error: "Сумма платежа меньше суммы заказа" };
  }

  const payId = uuid();
  await tx(async () => {
    await run(
      `INSERT INTO payments(id, order_id, provider, external_id, amount_cents, currency, status, raw, created_at, updated_at)
       VALUES(?,?,?,?,?,?, 'confirmed', ?, ?, ?)
       ON CONFLICT(provider, external_id) DO NOTHING`,
      payId, params.orderId, params.provider, params.externalId, params.amountCents, order.currency,
      params.raw ? JSON.stringify(params.raw) : null, nowIso(), nowIso()
    );
    const r = await run(
      `UPDATE orders SET status='PAID', payment_method=?, paid_at=?, updated_at=? WHERE id=? AND status='AWAITING_PAYMENT'`,
      params.provider, nowIso(), nowIso(), params.orderId
    );
    if (r.changes > 0) {
      await logEvent(params.orderId, "payment_confirmed", { provider: params.provider, externalId: params.externalId });
      if (order.promo_code) await recordRedemption(order.promo_code, order.id, userKeyFor(order.email, order.telegram_id));
    }
  });
  return { ok: true, alreadyPaid: false, status: "PAID" };
}

/* ---------------- Выдача eSIM ---------------- */

/**
 * Покупка у поставщика и выдача eSIM. Вызывается после confirmPayment,
 * из webhook-а или ретрая из админки. Атомарно через статус PROVISIONING.
 */
export async function provisionOrder(orderId: string): Promise<{ ok: boolean; message?: string }> {
  const order = await getOrder(orderId);
  if (!order) return { ok: false, message: "Заказ не найден" };
  if (order.status === "DELIVERED") return { ok: true };
  if (order.status !== "PAID") return { ok: false, message: `Заказ не оплачен (${order.status})` };

  // Грубая блокировка: переводим в PROVISIONING только если всё ещё PAID
  const r = await run("UPDATE orders SET status='PROVISIONING', updated_at=? WHERE id=? AND status='PAID'", nowIso(), orderId);
  if (r.changes === 0) return { ok: false, message: "Заказ уже обрабатывается" };
  await logEvent(orderId, "provisioning_started");

  const snapshot = JSON.parse(order.plan_snapshot) as PlanSnapshot;
  const plan = await getPlan(order.plan_id);
  const providerPlanId = plan?.provider_plan_id ?? snapshot.planId;
  const provider = getProvider();

  try {
    const result = await provider.createOrder({
      providerPlanId,
      customerEmail: order.email ?? "customer@gatetodata.local",
      customerName: order.email?.split("@")[0],
      reference: order.number,
    });

    const esim = result.esim ?? {};
    let qrData = esim.qrUrl ?? null;
    // Если есть LPA — генерируем собственный QR (не зависим от URL поставщика)
    if (esim.lpa) {
      try {
        const QRCode = (await import("qrcode")).default;
        qrData = await QRCode.toDataURL(esim.lpa, { margin: 1, width: 512, color: { dark: "#0B0F14", light: "#FFFFFF" } });
      } catch { /* оставляем URL поставщика */ }
    }

    await tx(async () => {
      await run(
        `UPDATE orders SET status='DELIVERED', provider_order_id=?, provider_status=?, esim_iccid=?, esim_lpa=?,
         esim_qr_data=?, esim_activation_url=?, esim_expires_at=?, updated_at=? WHERE id=? AND status='PROVISIONING'`,
        result.providerOrderId, result.status, esim.iccid ?? null, esim.lpa ?? null,
        qrData, esim.activationUrl ?? null, esim.expiresAt ?? null, nowIso(), orderId
      );
      await logEvent(orderId, "esim_delivered", { providerOrderId: result.providerOrderId, iccid: esim.iccid });
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logProviderError(provider.id, "orders.create", orderId, { providerPlanId }, msg);
    await tx(async () => {
      await run("UPDATE orders SET status='FAILED', provider_status='error', updated_at=? WHERE id=? AND status='PROVISIONING'", nowIso(), orderId);
      await logEvent(orderId, "provisioning_failed", { error: msg });
    });
    return { ok: false, message: msg };
  }
}

/** Повторная выдача из админки (после устранения ошибки). */
export async function retryProvision(orderId: string, actor: string) {
  await tx(async () => {
    await run("UPDATE orders SET status='PAID', updated_at=? WHERE id=? AND status='FAILED'", nowIso(), orderId);
  });
  await audit(actor, "order.retry_provision", "order", orderId);
  const res = await provisionOrder(orderId);
  await audit(actor, `order.retry_provision_${res.ok ? "ok" : "fail"}`, "order", orderId, { message: res.message });
  return res;
}

export async function listOrders(opts: { status?: string; email?: string; telegramId?: number; limit?: number; offset?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) { where.push("status = ?"); params.push(opts.status); }
  if (opts.email) { where.push("LOWER(email) = ?"); params.push(opts.email.toLowerCase()); }
  if (opts.telegramId) { where.push("telegram_id = ?"); params.push(opts.telegramId); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 50, 200);
  return all<OrderRow & { title?: string }>(
    `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params, limit, opts.offset ?? 0
  );
}

export async function statsSummary() {
  const paid = await get<{ c: number; revenue: number; cost: number }>(
    `SELECT COUNT(*)::int AS c,
            COALESCE(SUM(total_cents),0)::int AS revenue,
            COALESCE(SUM(((plan_snapshot::jsonb)->>'wholesaleCents')::int),0)::int AS cost
     FROM orders WHERE status IN ('PAID','PROVISIONING','DELIVERED')`
  );
  const awaiting = await get<{ c: number }>("SELECT COUNT(*)::int AS c FROM orders WHERE status = 'AWAITING_PAYMENT'");
  const failed = await get<{ c: number }>("SELECT COUNT(*)::int AS c FROM orders WHERE status = 'FAILED'");
  const customers = await get<{ c: number }>("SELECT COUNT(*)::int AS c FROM users");
  return {
    paidOrders: paid?.c ?? 0,
    revenueCents: paid?.revenue ?? 0,
    costCents: paid?.cost ?? 0,
    marginCents: (paid?.revenue ?? 0) - (paid?.cost ?? 0),
    awaiting: awaiting?.c ?? 0,
    failed: failed?.c ?? 0,
    customers: customers?.c ?? 0,
  };
}
