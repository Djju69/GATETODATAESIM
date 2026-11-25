import { notFound } from "next/navigation";
import Link from "next/link";
import { listPlansForRegion, listRegions, listRegionCountries } from "@/core/catalog";
import { PlanCard } from "@/components/cards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plans = await listPlansForRegion(slug);
  const name = plans[0]?.region_name ?? slug;
  return {
    title: `eSIM ${name}`,
    description: `Региональные eSIM-пакеты для ${name}: одна SIM — все страны региона.`,
  };
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plans = await listPlansForRegion(slug);
  if (!plans.length) notFound();
  const name = plans[0].region_name ?? slug;
  const regions = (await listRegions()).filter((r) => r.slug !== slug);
  const countries = await listRegionCountries(slug);

  return (
    <div className="section py-10 sm:py-14">
      <Link href="/regions" className="btn-ghost mb-6 -ml-3">← Все регионы</Link>
      <h1 className="h-display text-3xl sm:text-4xl">eSIM {name}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
        Один пакет работает во всех странах региона {countries.length > 0 && `(${countries.length}+ стран)`}.
        Активация по QR-коду сразу после оплаты.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            id={p.id}
            title={p.title.replace(`${name} · `, "").replace(/ · .*/, "")}
            dataMb={p.data_mb}
            validityDays={p.validity_days}
            retailCents={p.retail_cents}
            countryCode={null}
            operators={p.operators}
          />
        ))}
      </div>

      {regions.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Другие регионы</h2>
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => (
              <Link key={r.slug} href={`/regions/${r.slug}`} className="chip transition hover:border-signal/50 hover:text-fg">
                {r.name_ru} · от ${(r.min_price_cents / 100).toFixed(0)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
