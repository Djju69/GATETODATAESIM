import Link from "next/link";
import { listOrders } from "@/core/orders";
import { statusLabel } from "@/core/telegram";
import { formatUsd } from "@/core/money";

export const dynamic = "force-dynamic";

const STATUSES = [
  "", "AWAITING_PAYMENT", "PAID", "PROVISIONING", "DELIVERED", "FAILED", "CANCELLED", "REFUNDED",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const { status, email } = await searchParams;
  const orders = await listOrders({ status: status || undefined, email, limit: 100 });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s || "all"}
            href={s ? `/admin/orders?status=${s}` : "/admin/orders"}
            className={`chip ${(status ?? "") === s ? "chip-active" : ""}`}
          >
            {s ? statusLabel(s) : "Все"}
          </Link>
        ))}
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-5 py-2">Номер</th>
              <th className="px-5 py-2">Тариф</th>
              <th className="px-5 py-2">Клиент</th>
              <th className="px-5 py-2">Сумма</th>
              <th className="px-5 py-2">Оплата</th>
              <th className="px-5 py-2">Статус</th>
              <th className="px-5 py-2">Создан</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const s = JSON.parse(o.plan_snapshot) as { title: string };
              return (
                <tr key={o.id} className="border-b border-line/40 hover:bg-raised/40">
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link href={`/admin/orders/${o.id}`} className="hover:text-signal">{o.number}</Link>
                  </td>
                  <td className="px-5 py-3">{s.title}</td>
                  <td className="px-5 py-3 text-xs">
                    {o.email && <div>{o.email}</div>}
                    {o.telegram_id && <div className="text-muted">tg:{o.telegram_id}</div>}
                  </td>
                  <td className="px-5 py-3">{formatUsd(o.total_cents)}</td>
                  <td className="px-5 py-3 text-xs text-muted">{o.payment_method ?? "—"}</td>
                  <td className="px-5 py-3">{statusLabel(o.status)}</td>
                  <td className="px-5 py-3 text-xs text-muted">{new Date(o.created_at).toLocaleString("ru-RU")}</td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-muted">Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
