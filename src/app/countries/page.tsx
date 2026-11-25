import Link from "next/link";
import { listCountries, listRegions, listGlobalPlans } from "@/core/catalog";
import { formatUsdCompact } from "@/core/money";
import CountrySearch from "@/components/country-search";
import { CountryCard } from "@/components/cards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Все страны",
  description: "Каталог eSIM по странам: 200+ направлений, реальные цены, мгновенная выдача.",
};

export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const { q, region } = await searchParams;
  return await render({ q, region });
}

async function render({ q, region }: { q?: string; region?: string }) {
  const countries = await listCountries(q, region);
  const regions = await listRegions();
  const globalCount = (await listGlobalPlans()).length;

  const regionChips = [
    { slug: "", name: "Все" },
    ...regions.map((r) => ({ slug: r.slug, name: r.name_ru })),
  ];

  return (
    <div className="section py-10 sm:py-14">
      <h1 className="h-display text-3xl sm:text-4xl">Каталог стран</h1>
      <p className="mt-2 text-sm text-muted sm:text-base">
        Выберите страну — покажем все доступные тарифы с актуальными ценами.
      </p>

      <div className="mt-7">
        <CountrySearch countries={countries.map((c) => ({ code: c.code, name_ru: c.name_ru, min_price_cents: c.min_price_cents }))} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {regionChips.map((r) => (
          <Link
            key={r.slug}
            href={r.slug ? `/countries?region=${r.slug}` : "/countries"}
            className={`chip ${region === r.slug ? "chip-active" : ""}`}
          >
            {r.name}
          </Link>
        ))}
        {globalCount > 0 && (
          <Link href="/global" className="chip hover:border-signal/50 hover:text-fg">🌐 Весь мир</Link>
        )}
      </div>

      {countries.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <div className="text-3xl">🤷</div>
          <div className="mt-3 font-medium">Ничего не нашлось</div>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Попробуйте другое название или сбросьте фильтры. Возможно, каталог ещё синхронизируется.
          </p>
          <Link href="/countries" className="btn-secondary btn-sm mt-5">Сбросить фильтры</Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-center justify-between text-sm text-muted">
            <span>{countries.length} стран</span>
            {q && <span>по запросу «{q}»</span>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {countries.map((c) => (
              <CountryCard
                key={c.code}
                code={c.code}
                nameRu={c.name_ru}
                minPriceCents={c.min_price_cents}
                plansCount={c.plans_count}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
