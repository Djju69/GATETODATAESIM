/** Оплата Telegram Stars (XTR): инвойс-ссылки для бота и сайта. */
import { config } from "../config";
import type { OrderRow } from "../orders";

const API = (method: string) => `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;

async function tg<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(API(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!body.ok) throw new Error(`Telegram ${method}: ${body.description ?? "error"}`);
  return body.result as T;
}

/**
 * Создаёт инвойс-ссылку (t.me) на оплату заказа Stars.
 * Цены в XTR: 1 Star ≈ $0.013 при выводе, поэтому конвертация с коэффициентом.
 */
export async function createStarsInvoiceLink(order: OrderRow): Promise<string> {
  if (!config.telegram.botToken) throw new Error("TELEGRAM_BOT_TOKEN не настроен");
  // Stars продаются дороже, чем выплачиваются: ~$0.013 за звезду при выводе.
  // Берём запасной коэффициент, чтобы не продавать в убыток.
  const STARS_PER_USD = 50; // 1$ заказа ≈ 50 Stars к получению
  const stars = Math.max(1, Math.ceil((order.total_cents / 100) * STARS_PER_USD));
  const snapshot = JSON.parse(order.plan_snapshot) as { title: string; dataMb: number; validityDays: number };
  const gb = snapshot.dataMb >= 1024 ? `${(snapshot.dataMb / 1024).toFixed(snapshot.dataMb % 1024 ? 1 : 0)} ГБ` : `${snapshot.dataMb} МБ`;
  const link = await tg<string>("createInvoiceLink", {
    title: `GATETODATA eSIM · ${gb} · ${snapshot.validityDays} дн`,
    description: `${snapshot.title}. Заказ ${order.number}. После оплаты eSIM будет выдана автоматически.`,
    payload: `order:${order.id}`,
    currency: "XTR",
    prices: [{ label: "eSIM", amount: stars }],
    provider_token: "", // обязателен пустой для XTR
  });
  return link;
}

/** Разбор successful_payment из апдейта бота. */
export function parseSuccessfulPayment(update: Record<string, unknown>): { payload: string; chargeId: string; total: number; currency: string } | null {
  const msg = (update.message ?? update.channel_post) as Record<string, unknown> | undefined;
  const sp = msg?.successful_payment as Record<string, unknown> | undefined;
  if (!sp) return null;
  return {
    payload: String(sp.invoice_payload ?? ""),
    chargeId: String(sp.telegram_payment_charge_id ?? ""),
    total: Number(sp.total_amount ?? 0),
    currency: String(sp.currency ?? "XTR"),
  };
}
