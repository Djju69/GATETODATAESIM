/**
 * Оплата USDT (TRC-20): инвойс на адрес кошелька + сверка поступлений через TronGrid (free).
 * Модель на старте: один кошелёк, уникальная сумма инвойса (±центы) с TTL,
 * подтверждение по точному совпадению суммы. При росте объёмов — HD-адреса / платёжный агрегатор.
 */
import { all, get, run, uuid, nowIso, logProviderError } from "../db";
import { config } from "../config";
import { confirmPayment, type OrderRow } from "../orders";

export interface UsdtInvoice {
  address: string;
  amount: string;       // строка USDT, напр. "12.97"
  amountCents: number;  // в центах USD (1 USDT = 1$)
  network: string;
  expiresAt: string;
}

/** Уникальная сумма: базовая + случайный цент-офсет 1..99, чтобы отличать заказы. */
export function createUsdtInvoice(order: OrderRow): UsdtInvoice {
  if (!config.usdt.wallet) throw new Error("USDT_WALLET_ADDRESS не настроен");
  const existing = order.usdt_amount;
  const expiresAt = new Date(Date.now() + config.usdt.ttlMinutes * 60_000).toISOString();
  let amountCents: number;
  if (existing) {
    amountCents = Math.round(parseFloat(existing) * 100);
  } else {
    const offset = 1 + Math.floor(Math.random() * 99); // 1..99 центов
    amountCents = order.total_cents + offset;
    void run("UPDATE orders SET usdt_amount = ?, updated_at = ? WHERE id = ?",
      (amountCents / 100).toFixed(2), nowIso(), order.id);
  }
  return {
    address: config.usdt.wallet,
    amount: (amountCents / 100).toFixed(2),
    amountCents,
    network: "TRC-20",
    expiresAt,
  };
}

/** Активные инвойсы, ожидающие оплаты. */
export async function pendingUsdtOrders(): Promise<OrderRow[]> {
  const cutoff = new Date(Date.now() - config.usdt.ttlMinutes * 60_000).toISOString();
  return all<OrderRow>(
    `SELECT * FROM orders
     WHERE status='AWAITING_PAYMENT' AND payment_method='usdt' AND usdt_amount IS NOT NULL
       AND updated_at > ?`,
    cutoff
  );
}

interface TronTransfer {
  transaction_id: string;
  from: string;
  to: string;
  value: string; // в минимальных единицах (6 знаков для USDT)
  block_timestamp: number;
  token_info?: { address?: string; decimals?: number; symbol?: string };
}

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/* ---------------- Проверка по хешу транзакции (TxID) ---------------- */

/**
 * Клиент прислал хеш после перевода — сверяем его через TronGrid:
 * событие Transfer USDT → на наш адрес → сумма ≥ суммы инвойса.
 * При успехе подтверждает заказ (идемпотентно по external_id = txId).
 */
export async function verifyUsdtTxByHash(
  orderId: string,
  txIdRaw: string
): Promise<{ ok: boolean; error?: string; alreadyPaid?: boolean }> {
  const txId = txIdRaw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(txId)) {
    return { ok: false, error: "Хеш транзакции должен быть 64 HEX-символа (TxID из кошелька)" };
  }

  const order = await get<OrderRow>("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (!["AWAITING_PAYMENT", "PAID"].includes(order.status)) {
    return { ok: false, error: `Заказ в статусе ${order.status} — проверка не требуется` };
  }
  if (!config.usdt.wallet) return { ok: false, error: "USDT_WALLET_ADDRESS не настроен" };

  // Сумма инвойса (создаём при необходимости)
  let amount = order.usdt_amount;
  if (!amount) {
    const inv = createUsdtInvoice(order);
    amount = inv.amount;
  }
  const expectedCents = Math.round(parseFloat(amount) * 100);

  // Хеш уже потрачен на другой заказ?
  const used = await get<{ order_id: string }>(
    "SELECT order_id FROM payments WHERE provider='usdt' AND external_id = ?",
    txId
  );
  if (used && used.order_id !== orderId) {
    return { ok: false, error: "Эта транзакция уже привязана к другому заказу" };
  }

  // Запрос событий транзакции у TronGrid
  const headers: Record<string, string> = { "accept": "application/json" };
  if (config.usdt.trongridKey) headers["TRON-PRO-API-KEY"] = config.usdt.trongridKey;

  let valueOk = false;
  let rawEvent: unknown = null;
  let eventsSeen = 0;
  try {
    const res = await fetch(`https://api.trongrid.io/v1/transactions/${txId}/events`, { headers });
    const body = (await res.json()) as {
      success?: boolean;
      data?: Array<{ contract_address?: string; result?: Record<string, string> }>;
    };
    const events = body.data ?? [];
    eventsSeen = events.length;
    for (const ev of events) {
      const to = ev.result?.to ?? "";
      const value = ev.result?.value ?? "0";
      const usdt = Number(value) / 1e6;
      rawEvent = ev;
      if (
        (ev.contract_address ?? "").toUpperCase() === USDT_TRC20 &&
        to.toLowerCase() === config.usdt.wallet.toLowerCase() &&
        usdt + 1e-9 >= parseFloat(amount)
      ) {
        valueOk = true;
        break;
      }
    }
  } catch (e) {
    await logProviderError("trongrid", "tx.events", orderId, { txId }, String(e));
    return { ok: false, error: "Сеть TRON недоступна — попробуйте через минуту" };
  }

  if (eventsSeen === 0) {
    return {
      ok: false,
      error: "Транзакция с таким хешем не найдена в сети TRON. Проверьте TxID; если перевели только что — подождите ~1 минуту.",
    };
  }

  if (!valueOk) {
    await logProviderError("trongrid", "tx.verify_mismatch", orderId, { txId }, rawEvent);
    return {
      ok: false,
      error: "Транзакция найдена, но не совпадает: проверьте сеть (TRC-20), адрес получателя и точную сумму",
    };
  }

  const res = await confirmPayment({
    orderId,
    provider: "usdt",
    externalId: txId,
    amountCents: expectedCents,
    raw: { verified: "hash", value: rawEvent },
  });
  if (!res.ok) return { ok: false, error: res.error };
  if (!order.usdt_tx) {
    await run("UPDATE orders SET usdt_tx = ? WHERE id = ?", txId, orderId);
  }
  return { ok: true, alreadyPaid: res.alreadyPaid };
}

/** Проверяет входящие переводы USDT и подтверждает заказы. Возвращает число подтверждённых. */
export async function checkIncomingPayments(): Promise<number> {
  if (!config.usdt.wallet) return 0;
  const orders = await pendingUsdtOrders();
  if (!orders.length) return 0;

  const headers: Record<string, string> = { "accept": "application/json" };
  if (config.usdt.trongridKey) headers["TRON-PRO-API-KEY"] = config.usdt.trongridKey;

  const url = new URL("https://api.trongrid.io/v1/accounts/" + config.usdt.wallet + "/transactions/trc20");
  url.searchParams.set("limit", "50");
  url.searchParams.set("contract_address", USDT_TRC20);
  url.searchParams.set("only_to", "true");

  let transfers: TronTransfer[] = [];
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return 0;
    const body = (await res.json()) as { data?: TronTransfer[] };
    transfers = body.data ?? [];
  } catch {
    return 0;
  }

  const byAmount = new Map<string, TronTransfer>();
  for (const t of transfers) {
    const decimals = t.token_info?.decimals ?? 6;
    const amount = (Number(t.value) / 10 ** decimals).toFixed(2);
    if (!byAmount.has(amount)) byAmount.set(amount, t);
  }

  let confirmed = 0;
  for (const order of orders) {
    if (!order.usdt_amount) continue;
    const tx = byAmount.get(order.usdt_amount);
    if (!tx) continue;
    // Не используем транзакцию, уже потраченную на другой заказ
    const used = await get("SELECT 1 AS x FROM payments WHERE provider='usdt' AND external_id = ?", tx.transaction_id);
    if (used) continue;
    const res = await confirmUsdt(order.id, tx.transaction_id, order.usdt_amount);
    if (res) confirmed += 1;
  }
  return confirmed;
}

async function confirmUsdt(orderId: string, txId: string, amount: string): Promise<boolean> {
  const amountCents = Math.round(parseFloat(amount) * 100);
  const res = await confirmPayment({ orderId, provider: "usdt", externalId: txId, amountCents, raw: { amount } });
  return res.ok && !res.alreadyPaid;
}

export async function recordPendingPayment(orderId: string, method: string, amountCents: number) {
  await run(
    `INSERT INTO payments(id, order_id, provider, external_id, amount_cents, currency, status, created_at, updated_at)
     VALUES(?,?,?,NULL,?,?, 'pending', ?, ?)
     ON CONFLICT DO NOTHING`,
    uuid(), orderId, method, amountCents, "USD", nowIso(), nowIso()
  );
}
