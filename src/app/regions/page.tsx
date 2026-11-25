import Link from "next/link";
import { listRegions } from "@/core/catalog";
import { formatUsdCompact } from "@/core/money";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Региональные тарифы",
  description: "Один eSIM-пакет для целого региона: Европа, Азия, Америки, Африка, Ближний Восток.",
};

const REGION_ICONS: Record<string, string> = {
  europe: "🇪🇺", asia: "🌏", "north-america": "🌎", "south-america": "🌎",
  africa: "🌍", oceania: "🌏", "middle-east": "🕌", cis: "🏠", "central-america": "🌎",
};

export default async function RegionsPage() {
  const regions = await listRegions();
  return (
    <div className="section py-10 sm:py-14">
      <h1 className="h-display text-3xl sm:text-4xl">Региональные тарифы</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
        Путешествуете по нескольким странам? Региональный пакет работает во всех странах региона
        без замены eSIM.
      </p>

      {regions.length === 0 ? (
        <div className="card mt-10 p-8 text-center text-sm text-muted">
          Региональные пакеты появятся после синхронизации каталога с поставщиком.
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((r) => (
            <Link
              key={r.slug}
              href={`/regions/${r.slug}`}
              className="card group p-6 transition hover:border-signal/50 hover:shadow-glow"
            >
              <div className="text-3xl">{REGION_ICONS[r.slug] ?? "🌍"}</div>
              <div className="mt-4 font-display text-xl font-semibold">{r.name_ru}</div>
              <div className="mt-1 text-sm text-muted">{r.plans_count} пакетов · от {formatUsdCompact(r.min_price_cents)}</div>
              <div className="mt-4 text-sm font-semibold text-signal transition group-hover:translate-x-0.5">
                Смотреть тарифы →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
