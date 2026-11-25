import { notFound } from "next/navigation";
import { getOrder, orderEvents, listOrders } from "@/core/orders";
import { statusLabel } from "@/core/telegram";
import { formatUsd, dataLabel, validityLabel } from "@/core/money";
import { run, audit, nowIso } from "@/core/db";
import { retryProvision, provisionOrder, confirmPayment } from "@/core/orders";
import { sendEsimToTelegram, notifyAdmin } from "@/core/telegram";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function retryAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId"));
  await retryProvision(orderId, "admin");
}

async function resendAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId"));
  const order = await getOrder(orderId);
  if (order && order.status === "DELIVERED") {
    if (order.telegram_id) await sendEsimToTelegram(order.telegram_id, order);
    await notifyAdmin(`📨 Данные eSIM повторно отправлены (заказ ${order.number})`);
    await audit("admin", "order.resend", "order", orderId);
  }
}

async function markPaidAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId"));
  const order = await getOrder(orderId);
  if (!order || order.status !== "AWAITING_PAYMENT") return;
  await confirmPayment({
    orderId,
    provider: "manual",
    externalId: `manual-${Date.now()}`,
    amountCents: order.total_cents,
    raw: { note: "Подтверждено администратором" },
  });
  await provisionOrder(orderId);
  await audit("admin", "order.manual_paid", "order", orderId);
}

async function refundNoteAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId"));
  const note = String(formData.get("note") ?? "");
  await run("UPDATE orders SET status='REFUNDED', admin_note=?, updated_at=? WHERE id=?", note, nowIso(), orderId);
  await audit("admin", "order.refunded", "order", orderId, { note });
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const snapshot = JSON.parse(order.plan_snapshot) as { title: string; dataMb: number; validityDays: number; wholesaleCents: number };
  const events = await orderEvents(id);
  const sameUser = await listOrders({
    email: order.email ?? undefined,
    telegramId: order.telegram_id ?? undefined,
    limit: 10,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <Link href="/admin/orders" className="btn-ghost btn-sm -ml-3">← Все заказы</Link>
        <h2 className="h-display mt-3 text-2xl">Заказ {order.number}</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="status-chip bg-raised text-fg">{statusLabel(order.status)}</span>
          <span className="text-xs text-muted">источник: {order.source}</span>
        </div>

        <div className="card mt-5 p-5 text-sm">
          <div className="font-semibold">{snapshot.title}</div>
          <div className="mt-1 text-muted">{dataLabel(snapshot.dataMb)} · {validityLabel(snapshot.validityDays)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {[
              ["Себестоимость", formatUsd(snapshot.wholesaleCents)],
              ["Скидка", formatUsd(order.discount_cents)],
              ["Оплачено клиентом", formatUsd(order.total_cents)],
              ["Маржа", formatUsd(order.total_cents - snapshot.wholesaleCents)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-line bg-raised p-3">
                <div className="text-muted">{l}</div>
                <div className="mt-0.5 font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* eSIM данные */}
        {order.esim_iccid && (
          <div className="card mt-4 p-5 text-sm">
            <div className="font-semibold">Выданная eSIM</div>
            <div className="mt-3 space-y-2 font-mono text-xs">
              <div>ICCID: {order.esim_iccid}</div>
              {order.esim_lpa && <div className="break-all">LPA: {order.esim_lpa}</div>}
              {order.provider_order_id && <div>Provider order: {order.provider_order_id}</div>}
            </div>
            {order.delivery_token && (
              <Link href={`/esim/${order.delivery_token}`} className="btn-secondary btn-sm mt-3">
                Открыть страницу клиента
              </Link>
            )}
          </div>
        )}

        {/* События */}
        <div className="card mt-4 p-5">
          <div className="text-sm font-semibold">Журнал событий</div>
          <ul className="mt-3 space-y-2 text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="shrink-0 text-muted">{new Date(e.created_at).toLocaleString("ru-RU")}</span>
                <span className="font-medium">{e.type}</span>
                {e.payload && <span className="truncate text-muted">{e.payload}</span>}
              </li>
            ))}
            {events.length === 0 && <li className="text-muted">Событий нет</li>}
          </ul>
        </div>

        {/* Заказы этого клиента */}
        {(order.email || order.telegram_id) && (
          <div className="card mt-4 p-5">
            <div className="text-sm font-semibold">Заказы клиента ({sameUser.length})</div>
            <ul className="mt-2 space-y-1 text-xs">
              {sameUser.map((o) => (
                <li key={o.id} className="flex justify-between">
                  <Link href={`/admin/orders/${o.id}`} className="hover:text-signal">{o.number}</Link>
                  <span className="text-muted">{statusLabel(o.status)} · {formatUsd(o.total_cents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Действия */}
      <aside className="space-y-3">
        {order.status === "FAILED" && (
          <form action={retryAction} className="card p-4">
            <div className="text-sm font-medium">Повторить выдачу</div>
            <p className="mt-1 text-xs text-muted">После устранения ошибки (баланс поставщика, доступность API)</p>
            <input type="hidden" name="orderId" value={order.id} />
            <button className="btn-primary btn-sm mt-3 w-full">⚙️ Повторить provision</button>
          </form>
        )}

        {order.status === "AWAITING_PAYMENT" && (
          <form action={markPaidAction} className="card p-4">
            <div className="text-sm font-medium">Подтвердить оплату вручную</div>
            <p className="mt-1 text-xs text-muted">Например, перевод пришёл, но не опознан автоматически</p>
            <input type="hidden" name="orderId" value={order.id} />
            <button className="btn-primary btn-sm mt-3 w-full">✅ Отметить оплаченным и выдать</button>
          </form>
        )}

        {order.status === "DELIVERED" && (
          <form action={resendAction} className="card p-4">
            <div className="text-sm font-medium">Повторно отправить eSIM</div>
            <p className="mt-1 text-xs text-muted">Клиенту в Telegram, уведомление админу</p>
            <input type="hidden" name="orderId" value={order.id} />
            <button className="btn-secondary btn-sm mt-3 w-full">📨 Отправить повторно</button>
          </form>
        )}

        {order.status === "DELIVERED" && (
          <form action={refundNoteAction} className="card p-4">
            <div className="text-sm font-medium">Оформить возврат</div>
            <textarea name="note" className="input mt-2 text-sm" placeholder="Причина возврата" rows={2} />
            <input type="hidden" name="orderId" value={order.id} />
            <button className="btn-secondary btn-sm mt-3 w-full">↩️ Пометить как возврат</button>
          </form>
        )}

        <div className="card p-4 text-xs text-muted">
          <div className="font-medium text-fg">Платёж</div>
          <div className="mt-1">Способ: {order.payment_method ?? "—"}</div>
          <div>Оплата: {order.paid_at ? new Date(order.paid_at).toLocaleString("ru-RU") : "—"}</div>
          <div>USDT: {order.usdt_amount ?? "—"} {order.usdt_tx ? `· tx ${order.usdt_tx.slice(0, 12)}…` : ""}</div>
          <div className="mt-2 font-medium text-fg">Клиент</div>
          <div className="mt-1">{order.email ?? "—"}{order.telegram_id ? ` · tg:${order.telegram_id}` : ""}</div>
          {order.promo_code && <div>Промокод: {order.promo_code}</div>}
        </div>
      </aside>
    </div>
  );
}
