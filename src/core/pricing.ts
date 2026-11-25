/**
 * Ценообразование: розничная цена = правило наценки над себестоимостью поставщика.
 * Приоритет: правило плана > страны > региона > глобальное.
 */
import { charmPrice } from "./money";
import { all } from "./db";

export interface PriceRule {
  id: string;
  scope: "global" | "country" | "region" | "plan";
  target: string | null;
  markup_percent: number;
  fixed_markup_cents: number;
  min_margin_cents: number;
  priority: number;
  active: number;
}

export interface PricingInput {
  wholesaleCents: number;
  currency: string;
  kind: "country" | "region" | "global";
  countryCode?: string | null;
  regionSlug?: string | null;
  providerPlanId?: string | null;
}

export async function computeRetailPrice(input: PricingInput): Promise<number> {
  const rules = await all<PriceRule>("SELECT * FROM price_rules WHERE active = 1 ORDER BY priority DESC");
  let chosen: PriceRule | undefined;
  for (const r of rules) {
    if (r.scope === "plan" && input.providerPlanId && r.target === input.providerPlanId) { chosen = r; break; }
  }
  if (!chosen) {
    for (const r of rules) {
      if (r.scope === "country" && input.countryCode && r.target === input.countryCode) { chosen = r; break; }
    }
  }
  if (!chosen) {
    for (const r of rules) {
      if (r.scope === "region" && input.regionSlug && r.target === input.regionSlug) { chosen = r; break; }
    }
  }
  if (!chosen) {
    chosen = rules.find((r) => r.scope === "global");
  }
  const percent = chosen?.markup_percent ?? 35;
  const fixed = chosen?.fixed_markup_cents ?? 0;
  const minMargin = chosen?.min_margin_cents ?? 100;

  let retail = Math.round(input.wholesaleCents * (1 + percent / 100)) + fixed;
  if (retail - input.wholesaleCents < minMargin) retail = input.wholesaleCents + minMargin;
  return charmPrice(retail);
}
