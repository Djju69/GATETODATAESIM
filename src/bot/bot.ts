/**
 * GATETODATA eSIM — Telegram-бот (grammY).
 * Один и тот же экземпляр работает и в long polling (локально), и в webhook-режиме (Vercel).
 * Сессии хранятся в БД — состояние диалогов переживает cold start в serverless.
 * Меню: 🌍 Купить eSIM · 🔎 Найти страну · 🔥 Популярные · 📦 Мои eSIM · 🧾 Заказы ·
 *       🎟️ Промокоды · 👤 Профиль · ℹ️ Как установить · 💬 Поддержка
 */
import { Bot, InlineKeyboard, Context, session, SessionFlavor, type StorageAdapter } from "grammy";
import { config } from "../core/config";
import { get, run, nowIso } from "../core/db";
import { ensureBotUser, userByTelegramId, attachTelegramToOrders, sendEsimToTelegram, statusLabel, notifyAdmin, notifyOrderDelivered, notifyOrderPaid } from "../core/telegram";
import { createOrder, getOrder, getOrderByDeliveryToken, confirmPayment, listOrders, applyPromoToOrder, OrderRow, cancelOrder } from "../core/orders";
import { createStarsInvoiceLink, parseSuccessfulPayment } from "../core/payments/stars";
import { createUsdtInvoice, checkIncomingPayments, verifyUsdtTxByHash } from "../core/payments/usdt";
import { listCountries, getPlan, popularCountries, popularPlans, listPlansForCountry, listPlansForRegion, listRegions, listGlobalPlans, CountrySummary, PlanRow, catalogIsEmpty } from "../core/catalog";
import { formatUsd, dataLabel, validityLabel } from "../core/money";
import { flagEmoji } from "../core/countries";
import { provisionOrder } from "../core/orders";
import { all } from "../core/db";

interface SessionData {
  awaiting?: "promo" | "support" | "search" | "txhash";
  promoOrderId?: string;
  txOrderId?: string;
}
type MyCtx = Context & SessionFlavor<SessionData>;

/** Сессии диалогов — в Postgres (переживают перезапуски и serverless cold start). */
const dbStorage: StorageAdapter<SessionData> = {
  async read(key: string) {
    try {
      const row = await get<{ value: string }>("SELECT value FROM bot_sessions WHERE key = ?", key);
      if (!row) return undefined;
      return JSON.parse(row.value);
    } catch (e) {
      console.warn("bot session read failed:", e);
      return undefined;
    }
  },
  async write(key: string, value: unknown) {
    await run(
      "INSERT INTO bot_sessions(key, value, updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      key, JSON.stringify(value), nowIso()
    );
  },
  async delete(key: string) {
    await run("DELETE FROM bot_sessions WHERE key = ?", key);
  },
};

const bot = new Bot<MyCtx>(config.telegram.botToken ?? "no-token");
bot.use(session({ initial: (): SessionData => ({}), storage: dbStorage }));

const MAIN_MENU = new InlineKeyboard()
  .text("🌍 Купить eSIM", "menu:buy").text("🔎 Найти страну", "menu:search").row()
  .text("🔥 Популярные", "menu:popular").text("🌎 Регионы", "menu:regions").row()
  .text("🌐 Весь мир", "menu:global").row()
  .text("📦 Мои eSIM", "menu:myesim").text("🧾 Заказы", "menu:orders").row()
  .text("🎟️ Промокоды", "menu:promo").text("👤 Профиль", "menu:profile").row()
  .text("ℹ️ Как установить", "menu:howto").text("💬 Поддержка", "menu:support");

function backMenu(): InlineKeyboard {
  return new InlineKeyboard().text("🏠 В меню", "menu:home");
}

/* ================= ГЛАВНОЕ МЕНЮ ================= */

async function renderHome(ctx: MyCtx, edit = false) {
  const empty = await catalogIsEmpty();
  const text = empty
    ? [
        `👋 <b>Добро пожаловать в GATETODATA eSIM</b>`,
        ``,
        `Интернет в поездках без роуминга: eSIM на 200+ стран.`,
        ``,
        `⚠️ Каталог сейчас синхронизируется — загляните через пару минут.`,
      ].join("\n")
    : [
        `👋 <b>Добро пожаловать в GATETODATA eSIM</b>`,
        ``,
        `Интернет в поездках без роуминга:`,
        `• 200+ стран, активация за пару минут`,
        `• без физических SIM-карт и контрактов`,
        `• QR-код приходит сразу после оплаты`,
        ``,
        `Выберите раздел: 👇`,
      ].join("\n");
  if (edit) await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: MAIN_MENU });
  else await ctx.reply(text, { parse_mode: "HTML", reply_markup: MAIN_MENU });
}

bot.command("start", async (ctx) => {
  await ensureBotUser(ctx.from!.id, ctx.from!.username, [ctx.from!.first_name, ctx.from!.last_name].filter(Boolean).join(" "));
  const payload = ctx.match as string;
  if (payload.startsWith("esim_")) {
    const token = payload.replace("esim_", "");
    const order = await getOrderByDeliveryToken(token);
    if (order) {
      await attachTelegramToOrders(ctx.from!.id, order.email ?? "");
      if (order.status === "DELIVERED") return sendEsimToTelegram(ctx.from!.id, order);
      return ctx.reply(`Заказ ${order.number}: ${statusLabel(order.status)}`);
    }
  }
  if (payload.startsWith("order_")) {
    const orderId = payload.replace("order_", "");
    const order = await getOrder(orderId);
    if (order && (order.telegram_id === ctx.from!.id || order.email)) {
      return renderOrderStatus(ctx, order);
    }
  }
  await renderHome(ctx);
});

bot.callbackQuery("menu:home", async (ctx) => renderHome(ctx, true));
bot.callbackQuery("menu:buy", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showTopCountries(ctx, "Выберите страну или регион: 👇");
});
bot.callbackQuery("menu:search", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.awaiting = "search";
  await ctx.editMessageText(
    `🔎 <b>Найти страну</b>\n\nНапишите название страны или её код (напр. «Турция», «TR»):`,
    { parse_mode: "HTML", reply_markup: backMenu() }
  );
});
bot.callbackQuery("menu:popular", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPopular(ctx);
});
bot.callbackQuery("menu:regions", async (ctx) => showRegions(ctx));
bot.callbackQuery("menu:global", async (ctx) => showGlobal(ctx));
bot.callbackQuery("menu:myesim", async (ctx) => showMyEsim(ctx));
bot.callbackQuery("menu:orders", async (ctx) => showOrders(ctx));
bot.callbackQuery("menu:promo", async (ctx) => showPromos(ctx));
bot.callbackQuery("menu:profile", async (ctx) => showProfile(ctx));
bot.callbackQuery("menu:howto", async (ctx) => showHowto(ctx));
bot.callbackQuery("menu:support", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.awaiting = "support";
  await ctx.editMessageText(
    `💬 <b>Поддержка GATETODATA</b>\n\nОпишите проблему — ответим как можно быстрее.\n\nОбычно отвечаем в течение 15–30 минут.`,
    { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🏠 В меню", "menu:home") }
  );
});

/* ================= КАТАЛОГ ================= */

function countryRowKeyboard(items: CountrySummary[], page: number, prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = page * 8; i < items.length && i < (page + 1) * 8; i++) {
    kb.text(`${flagEmoji(items[i].code)} ${items[i].name_ru}`, `${prefix}${items[i].code}`);
    if ((i - page * 8) % 2 === 1) kb.row();
  }
  if (items.length > 8) {
    const nav: InlineKeyboard = new InlineKeyboard();
    if (page > 0) nav.text("◀️", `${prefix}page:${page - 1}`);
    nav.text(`${page + 1}/${Math.ceil(items.length / 8)}`, "noop");
    if ((page + 1) * 8 < items.length) nav.text("▶️", `${prefix}page:${page + 1}`);
    kb.row().append(nav);
  }
  return kb;
}

async function showTopCountries(ctx: MyCtx, title: string, page = 0) {
  const countries = await popularCountries(40);
  const kb = countryRowKeyboard(countries, page, "country:");
  kb.row().text("🌎 Все регионы", "menu:regions").text("🌐 Весь мир", "menu:global");
  kb.row().text("🔎 Поиск по названию", "menu:search").text("🏠 В меню", "menu:home");
  const text = [title, "", "Оплата Stars или USDT · выдача мгновенно · поддержка 24/7"].join("\n");
  try {
    await ctx.editMessageText(text, { reply_markup: kb });
  } catch {
    await ctx.reply(text, { reply_markup: kb });
  }
}

bot.callbackQuery(/^country:page:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showTopCountries(ctx, "Выберите страну или регион: 👇", Number(ctx.match[1]));
});

bot.callbackQuery(/^country:([A-Z]{2})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlans(ctx, ctx.match[1]);
});

async function showPlans(ctx: MyCtx, code: string, page = 0) {
  const plans = await listPlansForCountry(code);
  if (!plans.length) {
    return ctx.editMessageText(`Пока нет тарифов для этой страны. Посмотрите популярные:`, {
      reply_markup: new InlineKeyboard().text("🔥 Популярные", "menu:popular").row().text("🏠 В меню", "menu:home"),
    });
  }
  const name = plans[0].country_name_ru ?? plans[0].country_name ?? code;
  const perPage = 5;
  const slice = plans.slice(page * perPage, (page + 1) * perPage);
  const kb = new InlineKeyboard();
  for (const p of slice) {
    kb.text(`${dataLabel(p.data_mb)} · ${p.validity_days}д · ${formatUsd(p.retail_cents)}`, `plan:${p.id}`);
    kb.row();
  }
  if (plans.length > perPage) {
    if (page > 0) kb.text("◀️", `plans:${code}:${page - 1}`);
    kb.text(`${page + 1}/${Math.ceil(plans.length / perPage)}`, "noop");
    if ((page + 1) * perPage < plans.length) kb.text("▶️", `plans:${code}:${page + 1}`);
    kb.row();
  }
  kb.row().text("◀️ К странам", "menu:buy").text("🏠 В меню", "menu:home");
  await ctx.editMessageText(
    `${flagEmoji(code)} <b>${name}</b>\n\nТарифы (${plans.length}) — нажмите для деталей: 👇`,
    { parse_mode: "HTML", reply_markup: kb }
  );
}

bot.callbackQuery(/^plans:([A-Z]{2}):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlans(ctx, ctx.match[1], Number(ctx.match[2]));
});

bot.callbackQuery("noop", (ctx) => ctx.answerCallbackQuery());

bot.callbackQuery(/^plan:([a-z0-9-]+)$/i, async (ctx) => {
  await ctx.answerCallbackQuery();
  const plan = await getPlan(ctx.match[1]);
  if (!plan) return ctx.editMessageText("Тариф недоступен.", { reply_markup: backMenu() });
  await showPlanDetail(ctx, plan);
});

function planKb(plan: PlanRow): InlineKeyboard {
  return new InlineKeyboard()
    .text(`💳 Купить — ${formatUsd(plan.retail_cents)}`, `buy:${plan.id}`)
    .row()
    .text("🎟️ Промокод на заказ", "menu:promo")
    .text("🏠 В меню", "menu:home");
}

async function showPlanDetail(ctx: MyCtx, plan: PlanRow) {
  const kb = planKb(plan);
  const emoji = plan.country_code ? flagEmoji(plan.country_code) : "🌍";
  const lines = [
    `${emoji} <b>${plan.title}</b>`,
    ``,
    `📶 Интернет: ${plan.unlimited ? "Безлимит" : dataLabel(plan.data_mb)}`,
    `⏳ Срок: ${validityLabel(plan.validity_days)}`,
    plan.operators ? `📡 Операторы: ${plan.operators}` : "",
    plan.networks ? `🛰 Сети: ${plan.networks}` : "",
    plan.speed ? `⚡️ Скорость: ${plan.speed}` : "",
    `🔥 Хотспот: ${plan.hotspot ? "разрешён" : "уточняйте"}`,
    ``,
    `💰 <b>${formatUsd(plan.retail_cents)}</b>`,
    ``,
    `✅ Активация: отсканируйте QR после оплаты`,
    `✅ Совместимость: iPhone XS+, большинство Android (проверьте в /help)`,
  ].filter(Boolean);
  await ctx.editMessageText(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

/* ================= ПОКУПКА ================= */

bot.callbackQuery(/^buy:([a-z0-9-]+)$/i, async (ctx) => {
  await ctx.answerCallbackQuery();
  const plan = await getPlan(ctx.match[1]);
  if (!plan) return ctx.editMessageText("Тариф недоступен.", { reply_markup: backMenu() });

  const res = await createOrder({
    planId: plan.id,
    telegramId: ctx.from!.id,
    source: "bot",
  });
  if (!res.ok) return ctx.reply(`⚠️ ${res.error}`);
  ctx.session.promoOrderId = res.order.id;
  await renderOrderStatus(ctx, res.order);
});

function orderKb(order: OrderRow): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (order.status === "AWAITING_PAYMENT") {
    if (config.starsEnabled) kb.text("⭐️ Оплатить Stars", `pay:stars:${order.id}`).row();
    if (config.usdt.wallet) kb.text("₮ Оплатить USDT", `pay:usdt:${order.id}`).row();
    kb.text("🎟️ Ввести промокод", `promo:${order.id}`).row();
    kb.text("✖️ Отменить заказ", `cancel:${order.id}`).row();
  } else if (order.status === "DELIVERED") {
    kb.text("📲 Открыть eSIM", `esim:${order.delivery_token}`).row();
  } else if (order.status === "FAILED") {
    kb.text("💬 Написать в поддержку", "menu:support").row();
  }
  kb.text("🏠 В меню", "menu:home");
  return kb;
}

async function renderOrderStatus(ctx: MyCtx, order: OrderRow) {
  const s = JSON.parse(order.plan_snapshot) as { title: string; dataMb: number; validityDays: number };
  let text = [
    `🧾 Заказ <b>${order.number}</b>`,
    `📦 ${s.title}`,
    `📶 ${dataLabel(s.dataMb)} · ⏳ ${validityLabel(s.validityDays)}`,
    ``,
    `💰 К оплате: <b>${formatUsd(order.total_cents)}</b>`,
    order.promo_code ? `🎟️ Промокод ${order.promo_code}: −${formatUsd(order.discount_cents)}` : "",
    ``,
    `🔎 Статус: ${statusLabel(order.status)}`,
  ].filter(Boolean).join("\n");
  if (order.status === "AWAITING_PAYMENT") text += `\n\nВыберите способ оплаты 👇`;
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: orderKb(order) });
  } catch {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: orderKb(order) });
  }
}

bot.callbackQuery(/^pay:stars:([a-z0-9-]+)$/i, async (ctx) => {
  await ctx.answerCallbackQuery();
  const order = await getOrder(ctx.match[1]);
  if (!order || order.telegram_id !== ctx.from!.id) return;
  if (order.status !== "AWAITING_PAYMENT") return renderOrderStatus(ctx, order);
  try {
    const title = `eSIM · ${order.number}`;
    const description = `GATETODATA eSIM · ${(JSON.parse(order.plan_snapshot) as { title: string }).title}`;
    const payload = `order:${order.id}`;
    const stars = Math.max(1, Math.ceil((order.total_cents / 100) * 50));
    await ctx.replyWithInvoice(title, description, payload, "XTR", [{ label: "eSIM", amount: stars }], {
      provider_token: "",
    });
    await ctx.api.sendMessage(ctx.chat!.id, `Счёт создан. Оплатите его выше ⬆️`, {
      reply_markup: new InlineKeyboard().text("🔄 Статус заказа", `status:${order.id}`),
    });
  } catch (e) {
    await ctx.reply(`⚠️ Не удалось создать счёт: ${e instanceof Error ? e.message : e}`);
  }
});

bot.callbackQuery(/^pay:usdt:([a-z0-9-]+)$/i, async (ctx) => {
  await ctx.answerCallbackQuery();
  const order = await getOrder(ctx.match[1]);
  if (!order || order.telegram_id !== ctx.from!.id) return;
  if (order.status !== "AWAITING_PAYMENT") return renderOrderStatus(ctx, order);
  const inv = createUsdtInvoice(order);
  await run(`UPDATE orders SET payment_method='usdt' WHERE id = ?`, order.id);
  ctx.session.txOrderId = order.id;
  ctx.session.awaiting = "txhash";
  await ctx.editMessageText(
    [
      `₮ <b>Оплата USDT (TRC-20)</b>`,
      ``,
      `Сумма: <b>${inv.amount} USDT</b>`,
      `Кошелёк: <code>${inv.address}</code>`,
      `Сеть: TRC-20 (TRON)`,
      `⏳ Оплатите в течение ${Math.round((new Date(inv.expiresAt).getTime() - Date.now()) / 60000)} мин.`,
      ``,
      `⚠️ Сумма должна совпасть точно (включая центы) — по ней мы находим ваш платёж.`,
      `⚡️ После оплаты отправьте сюда <b>хеш транзакции (TxID)</b> — проверю и выдам eSIM мгновенно.`,
    ].join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("🔄 Проверить оплату", `status:${order.id}`)
        .row()
        .text("✖️ Отменить заказ", `cancel:${order.id}`)
        .row()
        .text("🏠 В меню", "menu:home"),
    }
  );
});

bot.callbackQuery(/^status:([a-z0-9-]+)$/i, async (ctx) => {
  await ctx.answerCallbackQuery("Проверяем…");
  // Ручная быстрая проверка USDT
  try { await checkIncomingPayments(); } catch {}
  const order = await getOrder(ctx.match[1]);
  if (!order) return;
  if (order.status === "PAID") {
    const res = await provisionOrder(order.id);
    if (!res.ok && order.telegram_id) {
      await ctx.reply(`⚠️ Ошибка выдачи: ${res.message}. Поддержка уже уведомлена.`);
    }
    return renderOrderStatus(ctx, (await getOrder(order.id))!);
  }
  return renderOrderStatus(ctx, order);
});

bot.callbackQuery(/^cancel:([a-z0-9-]+)$/i, async (ctx) => {
  await ctx.answerCallbackQuery();
  await cancelOrder(ctx.match[1], `tg:${ctx.from!.id}`);
  const order = await getOrder(ctx.match[1]);
  if (order) await renderOrderStatus(ctx, order);
});

bot.callbackQuery(/^promo:([a-z0-9-]+)$/i, async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.awaiting = "promo";
  ctx.session.promoOrderId = ctx.match[1];
  await ctx.reply(`🎟️ Введите промокод:`, {
    reply_markup: new InlineKeyboard().text("Отмена", `status:${ctx.match[1]}`),
  });
});

bot.callbackQuery(/^esim:([a-zA-Z0-9_-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const order = await getOrderByDeliveryToken(ctx.match[1]);
  if (!order) return;
  await sendEsimToTelegram(ctx.from!.id, order);
});

/* ================= МОЙ КАБИНЕТ ================= */

async function showMyEsim(ctx: MyCtx) {
  const orders = (await listOrders({ telegramId: ctx.from!.id, limit: 50 })).filter((o) => o.status === "DELIVERED");
  if (!orders.length) {
    return ctx.editMessageText(
      `📦 У вас пока нет eSIM.\n\nКупите первую — активация занимает пару минут!`,
      { reply_markup: new InlineKeyboard().text("🌍 Купить eSIM", "menu:buy").row().text("🏠 В меню", "menu:home") }
    );
  }
  const kb = new InlineKeyboard();
  for (const o of orders) {
    const s = JSON.parse(o.plan_snapshot) as { title: string };
    kb.text(`${s.title} · ${o.number}`, `esim:${o.delivery_token}`);
    kb.row();
  }
  kb.text("🏠 В меню", "menu:home");
  await ctx.editMessageText(`📦 <b>Мои eSIM (${orders.length})</b>\n\nНажмите, чтобы открыть QR и код установки:`, {
    parse_mode: "HTML", reply_markup: kb,
  });
}

async function showOrders(ctx: MyCtx) {
  const orders = await listOrders({ telegramId: ctx.from!.id, limit: 10 });
  if (!orders.length) {
    return ctx.editMessageText(`🧾 Заказов пока нет.`, {
      reply_markup: new InlineKeyboard().text("🌍 Купить eSIM", "menu:buy").row().text("🏠 В меню", "menu:home"),
    });
  }
  const kb = new InlineKeyboard();
  for (const o of orders) {
    const s = JSON.parse(o.plan_snapshot) as { title: string };
    kb.text(`${s.title} · ${formatUsd(o.total_cents)} · ${statusLabel(o.status)}`, `status:${o.id}`);
    kb.row();
  }
  kb.text("🏠 В меню", "menu:home");
  await ctx.editMessageText(`🧾 <b>Последние заказы</b>:`, { parse_mode: "HTML", reply_markup: kb });
}

async function showPromos(ctx: MyCtx) {
  const rows = await all<{ code: string; description: string | null; kind: string; value: number; min_order_cents: number }>(
    "SELECT * FROM promo_codes WHERE active = 1 AND (ends_at IS NULL OR ends_at > ?) LIMIT 10",
    nowIso()
  );
  const lines = rows.map((r) => {
    const value = r.kind === "percent" ? `${r.value}%` : formatUsd(r.value);
    const min = r.min_order_cents ? ` (от ${formatUsd(r.min_order_cents)})` : "";
    return `🎟️ <code>${r.code}</code> — ${value}${min}\n   ${r.description ?? ""}`;
  });
  await ctx.editMessageText(
    [`🎟️ <b>Активные промокоды</b>`, ``, ...(lines.length ? lines : ["Активных промокодов сейчас нет — следите за акциями!"]), ``, `Введите код при оформлении заказа.`].join("\n"),
    { parse_mode: "HTML", reply_markup: backMenu() }
  );
}

async function showProfile(ctx: MyCtx) {
  const user = await userByTelegramId(ctx.from!.id);
  const orders = await listOrders({ telegramId: ctx.from!.id, limit: 100 });
  const delivered = orders.filter((o) => o.status === "DELIVERED").length;
  const spent = orders.filter((o) => ["PAID", "PROVISIONING", "DELIVERED"].includes(o.status)).reduce((sum, o) => sum + o.total_cents, 0);
  await ctx.editMessageText(
    [
      `👤 <b>Профиль</b>`,
      ``,
      `🆔 ID: <code>${ctx.from!.id}</code>`,
      `📧 Email: ${user?.email ? `<code>${user.email}</code>` : "не указан"}`,
      `📦 eSIM куплено: ${delivered}`,
      `💰 Всего: ${formatUsd(spent)}`,
      ``,
      `Сайт и бот связаны: заказы, сделанные на ${config.baseUrl}, появятся здесь автоматически, если совпадёт email.`,
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: backMenu() }
  );
}

async function showHowto(ctx: MyCtx) {
  await ctx.editMessageText(
    [
      `ℹ️ <b>Как установить eSIM</b>`,
      ``,
      `📱 <b>iPhone (XS и новее)</b>`,
      `1. Настройки → Сотовая связь → Добавить eSIM`,
      `2. Отсканируйте QR-код`,
      `3. Включите «Данные сотовой сети» для eSIM`,
      ``,
      `🤖 <b>Android (Pixel, Samsung S20+ и др.)</b>`,
      `1. Настройки → Сеть и интернет → SIM-карты → Добавить eSIM`,
      `2. Сканируйте QR или введите код вручную`,
      ``,
      `⚠️ Важно:`,
      `• Устанавливайте eSIM при устойчивом Wi-Fi`,
      `• Не удаляйте установленный профиль`,
      `• Телефон должен быть не привязан к оператору (unlocked)`,
      ``,
      `Проверка совместимости: Настройки → о телефоне → есть ли «Добавить eSIM».`,
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: backMenu() }
  );
}

/* ================= РЕГИОНЫ / ГЛОБАЛ / ПОПУЛЯРНОЕ ================= */

async function showRegions(ctx: MyCtx) {
  await ctx.answerCallbackQuery();
  const regions = await listRegions();
  const kb = new InlineKeyboard();
  const ru: Record<string, string> = {
    europe: "🇪🇺 Европа", asia: "🌏 Азия", "north-america": "🌎 Северная Америка",
    "south-america": "🌎 Южная Америка", africa: "🌍 Африка", oceania: "🌏 Океания",
    "middle-east": "🕌 Ближний Восток", cis: "🏠 СНГ",
  };
  for (const r of regions) {
    kb.text(`${ru[r.slug] ?? r.name_ru} · от ${formatUsd(r.min_price_cents)}`, `region:${r.slug}`);
    kb.row();
  }
  kb.text("🏠 В меню", "menu:home");
  await ctx.editMessageText(`🌎 <b>Региональные тарифы</b>\n\nОдин пакет — много стран:`, {
    parse_mode: "HTML", reply_markup: kb,
  });
}

bot.callbackQuery(/^region:([a-z-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const plans = await listPlansForRegion(ctx.match[1]);
  if (!plans.length) return ctx.editMessageText("Пока нет тарифов для этого региона.", { reply_markup: backMenu() });
  const kb = new InlineKeyboard();
  for (const p of plans.slice(0, 8)) {
    kb.text(`${dataLabel(p.data_mb)} · ${p.validity_days}д · ${formatUsd(p.retail_cents)}`, `plan:${p.id}`);
    kb.row();
  }
  kb.row().text("◀️ К регионам", "menu:regions").text("🏠 В меню", "menu:home");
  await ctx.editMessageText(`🌍 <b>${plans[0].region_name ?? ctx.match[1]}</b>\n\nТарифы:`, { parse_mode: "HTML", reply_markup: kb });
});

async function showGlobal(ctx: MyCtx) {
  await ctx.answerCallbackQuery();
  const plans = await listGlobalPlans();
  if (!plans.length) {
    return ctx.editMessageText("Глобальные пакеты появятся soon. Посмотрите регионы:", {
      reply_markup: new InlineKeyboard().text("🌎 Регионы", "menu:regions").row().text("🏠 В меню", "menu:home"),
    });
  }
  const kb = new InlineKeyboard();
  for (const p of plans.slice(0, 8)) {
    kb.text(`${dataLabel(p.data_mb)} · ${p.validity_days}д · ${formatUsd(p.retail_cents)}`, `plan:${p.id}`);
    kb.row();
  }
  kb.row().text("🏠 В меню", "menu:home");
  await ctx.editMessageText(`🌐 <b>Весь мир</b>\n\nПакеты, работающие в 100+ странах:`, { parse_mode: "HTML", reply_markup: kb });
}

async function showPopular(ctx: MyCtx) {
  await ctx.answerCallbackQuery();
  const plans = await popularPlans(8);
  if (!plans.length) {
    return ctx.editMessageText("Каталог синхронизируется, попробуйте через пару минут.", { reply_markup: backMenu() });
  }
  const kb = new InlineKeyboard();
  for (const p of plans) {
    const emoji = p.country_code ? flagEmoji(p.country_code) : "🌍";
    kb.text(`${emoji} ${dataLabel(p.data_mb)} · ${p.validity_days}д · ${formatUsd(p.retail_cents)}`, `plan:${p.id}`);
    kb.row();
  }
  kb.row().text("🏠 В меню", "menu:home");
  await ctx.editMessageText(`🔥 <b>Популярные направления</b>:`, { parse_mode: "HTML", reply_markup: kb });
}

/* ================= ТЕКСТОВЫЕ СООБЩЕНИЯ ================= */

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();

  if (ctx.session.awaiting === "search") {
    ctx.session.awaiting = undefined;
    const q = text;
    const countries = (await listCountries(q)).slice(0, 8);
    if (!countries.length) {
      return ctx.reply(`🤷 Не нашли страну «${text}». Попробуйте другое название или выберите из списка.`, {
        reply_markup: new InlineKeyboard().text("🔎 Искать снова", "menu:search").row().text("🏠 В меню", "menu:home"),
      });
    }
    const kb = new InlineKeyboard();
    for (const c of countries) {
      kb.text(`${flagEmoji(c.code)} ${c.name_ru} · от ${formatUsd(c.min_price_cents)}`, `country:${c.code}`);
      kb.row();
    }
    kb.text("🏠 В меню", "menu:home");
    return ctx.reply(`🔎 Результаты по «${text}»:`, { reply_markup: kb });
  }

  if (ctx.session.awaiting === "promo") {
    ctx.session.awaiting = undefined;
    const orderId = ctx.session.promoOrderId;
    if (!orderId) return;
    const res = await applyPromoToOrder(orderId, text);
    if (!res.ok) {
      return ctx.reply(`⚠️ ${res.error}`, { reply_markup: new InlineKeyboard().text("🔄 Статус заказа", `status:${orderId}`) });
    }
    ctx.session.promoOrderId = undefined;
    const order = (await getOrder(orderId))!;
    return renderOrderStatus(ctx, order);
  }

  if (ctx.session.awaiting === "txhash") {
    ctx.session.awaiting = undefined;
    const orderId = ctx.session.txOrderId;
    ctx.session.txOrderId = undefined;
    if (!orderId) return;
    const check = await verifyUsdtTxByHash(orderId, text);
    if (!check.ok) {
      // Оставляем режим проверки активным — можно вставить хеш повторно
      ctx.session.awaiting = "txhash";
      ctx.session.txOrderId = orderId;
      return ctx.reply(`⚠️ ${check.error}\n\nВставьте корректный TxID ещё раз или дождитесь авто-подтверждения (1–3 мин).`, {
        reply_markup: new InlineKeyboard().text("🔄 Статус заказа", `status:${orderId}`).row().text("🏠 В меню", "menu:home"),
      });
    }
    const order = await getOrder(orderId);
    if (!order) return;
    if (!check.alreadyPaid) {
      await notifyOrderPaid(order);
    }
    await ctx.reply(`✅ Платёж подтверждён. Выдаём eSIM…`);
    await provisionOrder(orderId);
    const fresh = await getOrder(orderId);
    if (fresh?.status === "DELIVERED") {
      return sendEsimToTelegram(ctx.from!.id, fresh);
    }
    return ctx.reply(`⚠️ Ошибка выдачи: поддержка уведомлена.`, {
      reply_markup: new InlineKeyboard().text("🔄 Статус заказа", `status:${orderId}`),
    });
  }

  if (ctx.session.awaiting === "support") {
    ctx.session.awaiting = undefined;
    await notifyAdmin(`💬 Вопрос в поддержку от <a href="tg://user?id=${ctx.from!.id}">${ctx.from!.first_name}</a> (ID <code>${ctx.from!.id}</code>):\n\n${text}`);
    return ctx.reply(`✅ Сообщение отправлено в поддержку. Ответим в этом чате.`, {
      reply_markup: new InlineKeyboard().text("🏠 В меню", "menu:home"),
    });
  }

  await renderHome(ctx);
});

/* ================= ПЛАТЕЖИ ================= */

bot.on("pre_checkout_query", async (ctx) => {
  const payload = ctx.preCheckoutQuery.invoice_payload;
  const orderId = payload.replace("order:", "");
  const order = await getOrder(orderId);
  if (!order || order.status !== "AWAITING_PAYMENT") {
    return ctx.answerPreCheckoutQuery(false, { error_message: "Заказ уже оплачен или отменён" });
  }
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const payment = parseSuccessfulPayment(ctx.update as unknown as Record<string, unknown>);
  if (!payment) return;
  const orderId = payment.payload.replace("order:", "");
  const order = await getOrder(orderId);
  if (!order) return;

  if (payment.currency === "XTR") {
    // Сверка суммы Stars → центы: 1 Star учитываем как эквивалент оплаты заказа
    const res = await confirmPayment({
      orderId, provider: "stars", externalId: payment.chargeId,
      amountCents: order.total_cents, // сумма Stars уже соответствует заказу по курсу создания инвойса
      raw: { stars: payment.total, telegram_charge_id: payment.chargeId },
    });
    if (!res.ok) {
      await ctx.reply(`⚠️ ${res.error}. Напишите в поддержку.`);
      return;
    }
  }

  const fresh = (await getOrder(orderId))!;
  await notifyOrderPaidCtx(ctx, fresh);
  await ctx.reply(`✅ Оплата получена. Выдаём eSIM…`);
  const prov = await provisionOrder(orderId);
  const updated = (await getOrder(orderId))!;
  if (!prov.ok) {
    await ctx.reply(`⚠️ Ошибка выдачи: ${prov.message}. Поддержка уведомлена, мы всё исправим.`);
    return;
  }
  await sendEsimToTelegram(ctx.from!.id, updated);
});

async function notifyOrderPaidCtx(_ctx: MyCtx, order: OrderRow) {
  const { notifyOrderPaid } = await import("../core/telegram");
  await notifyOrderPaid(order);
}

/* ================= ОБРАБОТКА ОШИБОК ================= */

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

export { bot };
