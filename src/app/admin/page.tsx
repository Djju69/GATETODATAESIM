import { statsSummary, listOrders } from "@/core/orders";
import { statusLabel } from "@/core/telegram";
import { formatUsd } from "@/core/money";
import { get } from "@/core/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [stats, recent, lastSync] = await Promise.all([
    statsSummary(),
    listOrders({ limit: 10 }),
    get<{ status: string; items: number | null; message: string | null; started_at: string }>(
      "SELECT status, items, message, started_at FROM catalog_syncs ORDER BY started_at DESC LIMIT 1"
    ),
  ]);

  const cards = [
    { label: "Оплачено заказов", value: String(stats.paidOrders), sub: "всего" },
    { label: "Выручка", value: formatUsd(stats.revenueCents), sub: "розница" },
    { label: "Себестоимость", value: formatUsd(stats.costCents), sub: "поставщику" },
    { label: "Маржа", value: formatUsd(stats.marginCents), sub: `${stats.revenueCents ? Math.round((stats.marginCents / stats.revenueCents) * 100) : 0}%` },
    { label: "Ожидают оплаты", value: String(stats.awaiting), sub: "заказов" },
    { label: "Ошибки выдачи", value: String(stats.failed), sub: "требуют внимания" },
    { label: "Клиенты", value: String(stats.customers), sub: "в базе" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-xs text-muted">{c.label}</div>
            <div className="mt-1 font-display text-xl font-bold">{c.value}</div>
            <div className="text-[11px] text-muted/70">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div>
          <span className="font-medium">Каталог поставщика: </span>
          {lastSync ? (
            <>
              <span className={lastSync.status === "ok" ? "text-signal" : "text-danger"}>
                {lastSync.status === "ok" ? `синхронизирован (${lastSync.items} пакетов)` : `ошибка: ${lastSync.message}`}
              </span>
              <span className="ml-2 text-xs text-muted">{new Date(lastSync.started_at).toLocaleString("ru-RU")}</span>
            </>
          ) : (
            <span className="text-warn">ещё не синхронизирован — запустите npm run sync</span>
          )}
        </div>
        <Link href="/admin/plans" className="btn-secondary btn-sm">Настроить цены</Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="font-semibold">Последние заказы</h2>
          <Link href="/admin/orders" className="btn-ghost btn-sm">Все заказы →</Link>
        </div>
        <table className="mt-3 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-5 py-2">Номер</th>
              <th className="px-5 py-2">Тариф</th>
              <th className="px-5 py-2">Сумма</th>
              <th className="px-5 py-2">Статус</th>
              <th className="px-5 py-2">Дата</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => {
              const s = JSON.parse(o.plan_snapshot) as { title: string };
              return (
                <tr key={o.id} className="border-b border-line/40 hover:bg-raised/40">
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link href={`/admin/orders/${o.id}`} className="hover:text-signal">{o.number}</Link>
                  </td>
                  <td className="px-5 py-3">{s.title}</td>
                  <td className="px-5 py-3">{formatUsd(o.total_cents)}</td>
                  <td className="px-5 py-3">{statusLabel(o.status)}</td>
                  <td className="px-5 py-3 text-xs text-muted">{new Date(o.created_at).toLocaleString("ru-RU")}</td>
                </tr>
              );
            })}
            {recent.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">Заказов пока нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
