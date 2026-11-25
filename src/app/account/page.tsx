import { listOrders } from "@/core/orders";
import { statusLabel } from "@/core/telegram";
import { formatUsd, dataLabel, validityLabel } from "@/core/money";
import { botUrl } from "@/core/config";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Мои заказы" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const orders = email ? await listOrders({ email, limit: 50 }) : [];

  return (
    <div className="section max-w-3xl py-10 sm:py-14">
      <h1 className="h-display text-3xl sm:text-4xl">Мои заказы</h1>
      <p className="mt-2 text-sm text-muted sm:text-base">
        Личный кабинет без пароля: войдите по email, указанному при покупке.
        Если оформляли заказ через Telegram — все заказы видны в боте.
      </p>

      <form method="GET" className="card mt-8 flex gap-2 p-4">
        <input
          name="email"
          type="email"
          defaultValue={email ?? ""}
          placeholder="email@example.com"
          className="input"
          required
        />
        <button className="btn-primary shrink-0 px-5">Найти</button>
      </form>

      {email && orders.length === 0 && (
        <div className="card mt-6 p-8 text-center">
          <div className="text-3xl">🤷</div>
          <div className="mt-3 font-medium">Заказы с этим email не найдены</div>
          <p className="mt-2 text-sm text-muted">
            Проверьте адрес или напишите в поддержку — найдём ваш заказ по payment-данным.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-8 space-y-3">
          {orders.map((o) => {
            const s = JSON.parse(o.plan_snapshot) as { title: string; dataMb: number; validityDays: number };
            return (
              <div key={o.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-1 text-sm text-muted">
                    {o.number} · {dataLabel(s.dataMb)} · {validityLabel(s.validityDays)} · {formatUsd(o.total_cents)}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`status-chip ${
                        o.status === "DELIVERED"
                          ? "bg-signal/10 text-signal"
                          : o.status === "FAILED"
                            ? "bg-danger/10 text-danger"
                            : o.status === "AWAITING_PAYMENT"
                              ? "bg-warn/10 text-warn"
                              : "bg-sky/10 text-sky"
                      }`}
                    >
                      {statusLabel(o.status)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {o.status === "AWAITING_PAYMENT" && (
                    <Link href={`/checkout/${o.id}`} className="btn-primary btn-sm">Оплатить</Link>
                  )}
                  {["DELIVERED", "PROVISIONING"].includes(o.status) && (
                    <Link href={`/esim/${o.delivery_token}`} className="btn-secondary btn-sm">📲 Открыть eSIM</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!email && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <div className="card p-5">
            <div className="text-2xl">📦</div>
            <div className="mt-2 font-medium">Мои eSIM</div>
            <p className="mt-1 text-sm text-muted">Повторно открывайте QR-код и инструкции по ссылке из письма или бота.</p>
          </div>
          <div className="card p-5">
            <div className="text-2xl">🎟️</div>
            <div className="mt-2 font-medium">Промокоды</div>
            <p className="mt-1 text-sm text-muted">
              Активные промокоды публикуем в <a href={botUrl()} className="text-signal hover:underline">Telegram-боте</a>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
