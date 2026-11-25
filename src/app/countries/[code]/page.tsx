import { notFound } from "next/navigation";
import Link from "next/link";
import { listPlansForCountry, listCountries } from "@/core/catalog";
import { formatUsd } from "@/core/money";
import { flagEmoji } from "@/core/countries";
import { PlanCard } from "@/components/cards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const plans = await listPlansForCountry(code);
  const name = plans[0]?.country_name_ru ?? plans[0]?.country_name ?? code.toUpperCase();
  return {
    title: `eSIM ${name}`,
    description: `Туристические eSIM для ${name}: тарифы, цены, мгновенная выдача QR-кода.`,
  };
}

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const plans = await listPlansForCountry(code);
  if (!plans.length) notFound();

  const name = plans[0].country_name_ru ?? plans[0].country_name ?? code.toUpperCase();
  const minPrice = Math.min(...plans.map((p) => p.retail_cents));
  const operators = plans.map((p) => p.operators).filter(Boolean);
  const others = (await listCountries()).slice(0, 8);

  return (
    <div className="section py-10 sm:py-14">
      <Link href="/countries" className="btn-ghost mb-6 -ml-3">← Все страны</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-5xl leading-none">{flagEmoji(code)}</span>
          <div>
            <h1 className="h-display text-3xl sm:text-4xl">eSIM {name}</h1>
            <p className="mt-1 text-sm text-muted">
              {plans.length} тариф(ов) · от <span className="text-signal">{formatUsd(minPrice)}</span>
              {operators.length > 0 && <> · сети: {[...new Set(operators)].slice(0, 3).join(", ")}</>}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            id={p.id}
            title={p.title.replace(`${name} · `, "").replace(/ · .*/, "")}
            dataMb={p.data_mb}
            validityDays={p.validity_days}
            retailCents={p.retail_cents}
            countryCode={code}
            operators={p.operators}
          />
        ))}
      </div>

      <div className="card mt-12 p-6 sm:p-8">
        <h2 className="h-display text-xl">Что входит</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            ["📶", "Данные", "Интернет 4G/LTE на скорости локального оператора"],
            ["⏳", "Срок", "Отсчитывается с активации профиля в сети"],
            ["📲", "Установка", "QR-код или код LPA для ручной установки"],
            ["🛟", "Поддержка", "Помощь с активацией 24/7 в Telegram"],
          ].map(([icon, t, d]) => (
            <div key={t} className="rounded-xl border border-line bg-raised p-4">
              <div className="text-xl">{icon}</div>
              <div className="mt-2 font-semibold">{t}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Другие направления</h2>
        <div className="flex flex-wrap gap-2">
          {others.map((c) => (
            <Link key={c.code} href={`/countries/${c.code}`} className="chip transition hover:border-signal/50 hover:text-fg">
              {flagEmoji(c.code)} {c.name_ru} · от {formatUsd(c.min_price_cents)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
