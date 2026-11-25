import Link from "next/link";
import { formatUsd, dataLabel, validityLabel, formatUsdCompact } from "@/core/money";
import { flagEmoji } from "@/core/countries";

export function PlanCard({
  id,
  title,
  dataMb,
  validityDays,
  retailCents,
  countryCode,
  operators,
  compact = false,
}: {
  id: string;
  title: string;
  dataMb: number;
  validityDays: number;
  retailCents: number;
  countryCode?: string | null;
  operators?: string | null;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/plan/${id}`}
      className="card group flex flex-col justify-between p-5 transition hover:border-signal/50 hover:shadow-glow"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">{flagEmoji(countryCode)}</span>
            <div>
              <div className="font-semibold leading-tight">{title}</div>
              {operators && <div className="mt-0.5 text-xs text-muted">{operators}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-bold text-signal">{formatUsdCompact(retailCents)}</div>
          </div>
        </div>
        {!compact && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="chip">{dataLabel(dataMb)}</span>
            <span className="chip">{validityLabel(validityDays)}</span>
            <span className="chip">4G/LTE</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
        <span className="text-xs text-muted">eSIM · активация за 2 минуты</span>
        <span className="text-sm font-semibold text-signal transition group-hover:translate-x-0.5">Купить →</span>
      </div>
    </Link>
  );
}

export function CountryCard({
  code,
  nameRu,
  minPriceCents,
  plansCount,
}: {
  code: string;
  nameRu: string;
  minPriceCents: number;
  plansCount: number;
}) {
  return (
    <Link
      href={`/countries/${code}`}
      className="card group flex items-center justify-between gap-3 p-4 transition hover:border-signal/50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-3xl leading-none">{flagEmoji(code)}</span>
        <div className="min-w-0">
          <div className="truncate font-medium">{nameRu}</div>
          <div className="text-xs text-muted">{plansCount} тариф(ов)</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-base font-bold text-signal">от {formatUsdCompact(minPriceCents)}</div>
        <div className="text-[11px] text-muted">за пакет</div>
      </div>
    </Link>
  );
}
