/** Telegram-помощники: уведомления клиенту и админу, доставка eSIM в бот. */
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { config } from "./config";
import { get, run, nowIso } from "./db";
import type { OrderRow } from "./orders";
import { dataLabel, validityLabel, formatUsd } from "./money";
void fs; void path;

const API = (method: string) => `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;

async function tg<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  if (!config.telegram.botToken) return null;
  try {
    const res = await fetch(API(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!body.ok) {
      console.warn(`Telegram ${method} failed:`, body.description);
      return null;
    }
    return body.result ?? null;
  } catch (e) {
    console.warn(`Telegram ${method} error:`, e);
    return null;
  }
}

export async function userByTelegramId(telegramId: number) {
  return get<{ id: string; email: string | null; name: string | null }>(
    "SELECT id, email, name FROM users WHERE telegram_id = ?",
    telegramId
  );
}

export async function attachTelegramToOrders(telegramId: number, email: string) {
  await run(
    `UPDATE orders SET telegram_id = ?, updated_at = ? WHERE LOWER(email) = ? AND telegram_id IS NULL`,
    telegramId, nowIso(), email.toLowerCase().trim()
  );
}

export async function ensureBotUser(telegramId: number, username?: string, name?: string, email?: string) {
  const existing = await userByTelegramId(telegramId);
  if (existing) {
    if (email && !existing.email) await run("UPDATE users SET email = ? WHERE id = ?", email.toLowerCase(), existing.id);
    return existing;
  }
  await run(
    "INSERT INTO users(id, email, telegram_id, telegram_username, name, created_at) VALUES(?,?,?,?,?,?)",
    crypto.randomUUID(),
    email?.toLowerCase() ?? null,
    telegramId,
    username ?? null,
    name ?? null,
    nowIso()
  );
  return userByTelegramId(telegramId)!;
}

/* ---------------- Уведомления ---------------- */

export async function notifyAdmin(text: string) {
  if (!config.telegram.adminTelegramId) return;
  await tg("sendMessage", {
    chat_id: config.telegram.adminTelegramId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export function orderCardText(order: OrderRow): string {
  const s = JSON.parse(order.plan_snapshot) as { title: string; dataMb: number; validityDays: number };
  return [
    `🧾 Заказ <b>${order.number}</b>`,
    `📦 ${s.title}`,
    `💰 ${formatUsd(order.total_cents)}`,
    `🔎 Статус: ${statusLabel(order.status)}`,
  ].join("\n");
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    AWAITING_PAYMENT: "⏳ Ожидает оплаты",
    PAID: "✅ Оплачен",
    PROVISIONING: "⚙️ Выдаётся",
    DELIVERED: "📨 Выдан",
    FAILED: "⚠️ Ошибка выдачи",
    CANCELLED: "✖️ Отменён",
    EXPIRED: "⌛ Истёк",
    REFUNDED: "↩️ Возврат",
  };
  return map[status] ?? status;
}

/** Отправляет готовую eSIM пользователю: QR-картинка + LPA + инструкция. */
export async function sendEsimToTelegram(telegramId: number, order: OrderRow) {
  const s = JSON.parse(order.plan_snapshot) as { title: string; dataMb: number; validityDays: number };
  const caption = [
    `🎉 <b>Ваша eSIM готова!</b>`,
    ``,
    `📦 <b>${s.title}</b>`,
    `📶 ${dataLabel(s.dataMb)} · ⏳ ${validityLabel(s.validityDays)}`,
    order.esim_iccid ? `🔐 ICCID: <code>${order.esim_iccid}</code>` : "",
    ``,
    `📲 Установка: откройте камеру или Настройки → «Добавить eSIM» и отсканируйте QR.`,
    order.esim_lpa ? `Код для ручной установки:\n<code>${order.esim_lpa}</code>` : "",
    ``,
    `🌐 Повторно открыть: ${config.baseUrl}/esim/${order.delivery_token}`,
  ].filter(Boolean).join("\n");

  let qrBuffer: Buffer | null = null;
  try {
    if (order.esim_lpa) {
      qrBuffer = await QRCode.toBuffer(order.esim_lpa, { margin: 1, width: 512 });
    } else if (order.esim_qr_data?.startsWith("http")) {
      const res = await fetch(order.esim_qr_data);
      if (res.ok) qrBuffer = Buffer.from(await res.arrayBuffer());
    }
  } catch {
    qrBuffer = null;
  }

  if (qrBuffer) {
    await tg("sendPhoto", {
      chat_id: telegramId,
      photo: { filename: "esim-qr.png", source: qrBuffer },
      caption,
      parse_mode: "HTML",
    });
  } else {
    await tg("sendMessage", { chat_id: telegramId, text: caption, parse_mode: "HTML" });
  }
}

export async function notifyOrderPaid(order: OrderRow) {
  const s = JSON.parse(order.plan_snapshot) as { title: string };
  if (order.telegram_id) {
    await tg("sendMessage", {
      chat_id: order.telegram_id,
      text: `✅ Оплата заказа <b>${order.number}</b> подтверждена (${formatUsd(order.total_cents)}).\n📦 ${s.title}\n⚙️ Выдаём eSIM…`,
      parse_mode: "HTML",
    });
  }
  await notifyAdmin(`💰 Оплачен заказ ${order.number} — ${formatUsd(order.total_cents)}\n📦 ${s.title}`);
}

export async function notifyOrderDelivered(order: OrderRow) {
  if (order.telegram_id) await sendEsimToTelegram(order.telegram_id, order);
  if (order.email && !order.telegram_id) {
    await notifyAdmin(`📨 Заказ ${order.number} выдан (email: ${order.email}). Письмо-уведомление: TODO SMTP`);
  }
}

export async function sendInvoiceMessage(telegramId: number, order: OrderRow, invoiceLink: string) {
  await tg("sendMessage", {
    chat_id: telegramId,
    text: [
      `🧾 Заказ <b>${order.number}</b>`,
      `Оплатите в Telegram — нажмите кнопку ниже.`,
      `⏳ Счёт действует 30 минут.`,
    ].join("\n"),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "⭐️ Оплатить Stars", url: invoiceLink }]] },
  });
}
