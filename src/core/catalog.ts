/**
 * Каталог: синхронизация с поставщиком в нашу БД + запросы для витрины.
 * Витрина читает только нашу БД — быстро и независимо от доступности API.
 */
import { all, get, run, uuid, nowIso, logProviderError, getSetting } from "./db";
import { computeRetailPrice } from "./pricing";
import { getProvider } from "./providers/telmo";
import { CatalogPlan, PlanKind } from "./providers/types";
import { dataLabel, validityLabel } from "./money";

/* ---------------- Синхронизация ---------------- */

export interface SyncResult {
  ok: boolean;
  items?: number;
  message?: string;
}

export async function syncCatalog(): Promise<SyncResult> {
  const syncId = uuid();
  await run("INSERT INTO catalog_syncs(id, status, started_at) VALUES(?, 'running', ?)", syncId, nowIso());
  const provider = getProvider();
  try {
    const ping = await provider.ping();
    if (!ping.ok) throw new Error(ping.message ?? "API недоступен");

    const list = await provider.listCatalog();
    if (!list.length) throw new Error("Поставщик вернул пустой каталог — проверьте формат ответа (см. npm run probe)");

    const now = nowIso();
    for (const p of list) {
      const retail = await computeRetailPrice({
        wholesaleCents: p.wholesaleCents,
        currency: p.currency,
        kind: p.kind,
        countryCode: p.countryCode ?? null,
        regionSlug: p.regionSlug ?? null,
        providerPlanId: p.providerPlanId,
      });
      const existing = await get<{ id: string }>(
        "SELECT id FROM plans WHERE provider_id = ? AND provider_plan_id = ?",
        provider.id,
        p.providerPlanId
      );
      const networks = p.networks?.join(", ") ?? null;
      const operators = p.operators?.join(", ") ?? null;
      if (existing) {
        await run(
          `UPDATE plans SET kind=?, country_code=?, country_name=?, country_name_ru=?, region_slug=?, region_name=?,
           title=?, data_mb=?, validity_days=?, unlimited=?, voice_minutes=?, sms_count=?, wholesale_cents=?, retail_cents=?,
           currency=?, networks=?, operators=?, speed=?, hotspot=?, description=?, terms=?, synced_at=?, active=1
           WHERE id=?`,
          p.kind, p.countryCode ?? null, p.countryName ?? null, p.countryNameRu ?? null,
          p.kind === "global" ? "global" : p.regionSlug ?? null, p.regionName ?? null,
          planTitle(p), p.dataMb, p.validityDays, p.unlimited ? 1 : 0, p.voiceMinutes ?? null, p.smsCount ?? null,
          p.wholesaleCents, retail, p.currency, networks, operators, p.speed ?? null,
          p.hotspot ? 1 : 0, p.description ?? null, p.terms ?? null, now, existing.id
        );
      } else {
        await run(
          `INSERT INTO plans(id, provider_id, provider_plan_id, kind, country_code, country_name, country_name_ru,
           region_slug, region_name, title, data_mb, validity_days, unlimited, voice_minutes, sms_count,
           wholesale_cents, retail_cents, currency, networks, operators, speed, hotspot, description, terms,
           active, popular, synced_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?)`,
          uuid(), provider.id, p.providerPlanId, p.kind, p.countryCode ?? null, p.countryName ?? null,
          p.countryNameRu ?? null, p.kind === "global" ? "global" : p.regionSlug ?? null, p.regionName ?? null,
          planTitle(p), p.dataMb, p.validityDays, p.unlimited ? 1 : 0, p.voiceMinutes ?? null, p.smsCount ?? null,
          p.wholesaleCents, retail, p.currency, networks, operators, p.speed ?? null, p.hotspot ? 1 : 0,
          p.description ?? null, p.terms ?? null, now
        );
      }
    }
    // Деактивируем то, чего больше нет у поставщика
    await run(
      "UPDATE plans SET active = 0 WHERE provider_id = ? AND synced_at < ?",
      provider.id, now
    );
    await run("UPDATE catalog_syncs SET status='ok', items=?, finished_at=? WHERE id=?", list.length, nowIso(), syncId);
    return { ok: true, items: list.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logProviderError(provider.id, "sync", null, null, msg);
    await run("UPDATE catalog_syncs SET status='error', message=?, finished_at=? WHERE id=?", msg, nowIso(), syncId);
    return { ok: false, message: msg };
  }
}

function planTitle(p: CatalogPlan): string {
  if (p.kind === "global") return `Весь мир · ${dataLabel(p.dataMb)} · ${validityLabel(p.validityDays)}`;
  if (p.kind === "region") return `${p.regionName ?? p.regionSlug} · ${dataLabel(p.dataMb)} · ${validityLabel(p.validityDays)}`;
  return `${p.countryNameRu ?? p.countryName} · ${dataLabel(p.dataMb)} · ${validityLabel(p.validityDays)}`;
}

/* ---------------- Запросы витрины ---------------- */

export interface PlanRow {
  id: string;
  provider_plan_id: string;
  kind: PlanKind;
  country_code: string | null;
  country_name: string | null;
  country_name_ru: string | null;
  region_slug: string | null;
  region_name: string | null;
  title: string;
  data_mb: number;
  validity_days: number;
  unlimited: number;
  wholesale_cents: number;
  retail_cents: number;
  currency: string;
  networks: string | null;
  operators: string | null;
  speed: string | null;
  hotspot: number;
  description: string | null;
  terms: string | null;
  popular: number;
  active: number;
}

export interface CountrySummary {
  code: string;
  name_ru: string;
  name: string | null;
  min_price_cents: number;
  plans_count: number;
  popular: number;
}

export async function listCountries(q?: string, region?: string): Promise<CountrySummary[]> {
  const filters = ["kind = 'country'", "active = 1"];
  const params: unknown[] = [];
  if (q) { filters.push("(country_name_ru ILIKE ? OR country_name ILIKE ? OR country_code ILIKE ?)"); const like = `%${q}%`; params.push(like, like, like); }
  if (region) { filters.push("region_slug = ?"); params.push(region); }
  return all<CountrySummary>(
    `SELECT country_code AS code,
            MAX(COALESCE(country_name_ru, country_name, country_code)) AS name_ru,
            MAX(country_name) AS name,
            MIN(retail_cents)::int AS min_price_cents,
            COUNT(*)::int AS plans_count,
            MAX(popular)::int AS popular
     FROM plans WHERE ${filters.join(" AND ")}
     GROUP BY country_code
     ORDER BY popular DESC, name_ru ASC`,
    ...params
  );
}

export async function listRegionCountries(slug: string): Promise<CountrySummary[]> {
  const raw = await getSetting(`region:${slug}`);
  let codes: string[] = [];
  try { codes = raw ? JSON.parse(raw) : []; } catch { codes = []; }
  if (!codes.length) return [];
  return all<CountrySummary>(
    `SELECT country_code AS code,
            MAX(COALESCE(country_name_ru, country_name, country_code)) AS name_ru,
            MAX(country_name) AS name,
            MIN(retail_cents)::int AS min_price_cents,
            COUNT(*)::int AS plans_count,
            MAX(popular)::int AS popular
     FROM plans WHERE kind='country' AND active=1 AND country_code = ANY(?)
     GROUP BY country_code ORDER BY name_ru`,
    codes
  );
}

export async function listPlansForCountry(code: string): Promise<PlanRow[]> {
  return all<PlanRow>(
    "SELECT * FROM plans WHERE kind='country' AND country_code = ? AND active = 1 ORDER BY data_mb ASC, retail_cents ASC",
    code.toUpperCase()
  );
}

export async function listPlansForRegion(slug: string): Promise<PlanRow[]> {
  return all<PlanRow>(
    "SELECT * FROM plans WHERE kind = 'region' AND region_slug = ? AND active = 1 ORDER BY data_mb ASC, retail_cents ASC",
    slug
  );
}

export async function listGlobalPlans(): Promise<PlanRow[]> {
  return all<PlanRow>(
    "SELECT * FROM plans WHERE kind = 'global' AND active = 1 ORDER BY data_mb ASC, retail_cents ASC"
  );
}

export async function getPlan(id: string): Promise<PlanRow | undefined> {
  return get<PlanRow>("SELECT * FROM plans WHERE id = ? AND active = 1", id);
}

export async function popularPlans(limit = 8): Promise<PlanRow[]> {
  return all<PlanRow>(
    `SELECT * FROM plans WHERE active = 1 AND (popular = 1 OR country_code IN
      ('US','TR','AE','TH','EG','GB','DE','FR','IT','ES','JP','CN','VN','ID','KZ','IN','MX','GR','CY','TH'))
     ORDER BY retail_cents ASC LIMIT ?`,
    limit
  );
}

export async function popularCountries(limit = 12): Promise<CountrySummary[]> {
  const list = await listCountries();
  const pop = list.filter((c) => c.popular === 1);
  return (pop.length ? pop : list).slice(0, limit);
}

export interface RegionSummary {
  slug: string;
  name_ru: string;
  plans_count: number;
  min_price_cents: number;
}

export async function listRegions(): Promise<RegionSummary[]> {
  return all<RegionSummary>(
    `SELECT region_slug AS slug, MAX(region_name) AS name_ru, COUNT(*)::int AS plans_count, MIN(retail_cents)::int AS min_price_cents
     FROM plans WHERE kind='region' AND active=1 AND region_slug IS NOT NULL AND region_slug != 'global'
     GROUP BY region_slug ORDER BY name_ru`
  );
}

export async function catalogIsEmpty(): Promise<boolean> {
  const row = await get<{ c: number }>("SELECT COUNT(*)::int AS c FROM plans WHERE active = 1");
  return (row?.c ?? 0) === 0;
}
