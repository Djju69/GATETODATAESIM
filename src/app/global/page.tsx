import Link from "next/link";
import { listGlobalPlans } from "@/core/catalog";
import { PlanCard } from "@/components/cards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Глобальные пакеты",
  description: "Один eSIM для десятков стран мира — для сложных маршрутов и транзитов.",
};

export default async function GlobalPage() {
  const plans = await listGlobalPlans();
  return (
    <div className="section py-10 sm:py-14">
      <Link href="/" className="btn-ghost mb-6 -ml-3">← На главную</Link>
      <h1 className="h-display text-3xl sm:text-4xl">🌐 Весь мир</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
        Пакеты, работающие в десятках стран сразу. Идеальны для длинных маршрутов,
        транзитных пересадок и частых командировок.
      </p>

      {plans.length === 0 ? (
        <div className="card mt-10 p-8 text-center text-sm text-muted">
          Глобальные пакеты появятся после синхронизации каталога с поставщиком.
          Пока посмотрите <Link href="/regions" className="text-signal hover:underline">региональные тарифы</Link>.
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              id={p.id}
              title={p.title.replace("Весь мир · ", "").replace(/ · .*/, "")}
              dataMb={p.data_mb}
              validityDays={p.validity_days}
              retailCents={p.retail_cents}
              countryCode={null}
              operators={p.operators}
            />
          ))}
        </div>
      )}
    </div>
  );
}
