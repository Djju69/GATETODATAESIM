/**
 * TELMO eSIM — адаптер поставщика.
 *
 * ВАЖНО: публичная документация developer.telmoesim.com помечена как «placeholder».
 * Парсер ответов сделан толерантным к нескольким вариантам формата, а все сырые
 * ответы логируются при синхронизации. Скрипт `npm run probe` проверяет реальные
 * endpoint'ы по вашему ключу и печатает фактические форматы — при расхождении
 * правится только этот файл.
 */
import { config } from "../config";
import { apiRequest } from "./http";
import { RU_NAMES, countryNameRu, regionSlugOf, regionNameRu } from "../countries";

export { flagEmoji, countryNameRu } from "../countries";
import {
  CatalogPlan,
  EsimProvider,
  ProviderError,
  ProviderOrderRequest,
  ProviderOrderResult,
  ProviderOrderStatus,
} from "./types";

const BASE = () => config.telmo.apiBase.replace(/\/$/, "");
const KEY = () => config.telmo.apiKey;

/* ---------------------- Нормализация ответов ---------------------- */

type Any = Record<string, unknown>;

function asAny(v: unknown): Any | undefined {
  return v && typeof v === "object" ? (v as Any) : undefined;
}

function pick(obj: Any | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

/** Разбирает "1 GB", "500 MB", 1, "1.5gb" → МБ */
function parseDataMb(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v >= 1000 ? Math.round(v) : Math.round(v * 1024); // эвристика: <1000 = ГБ? нет: считаем МБ если ≥1000
  const s = String(v).trim().toLowerCase();
  const m = s.match(/([\d.]+)\s*(tb|gb|mb)/);
  if (!m) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 1024) : undefined;
  }
  const n = parseFloat(m[1]);
  if (m[2] === "tb") return Math.round(n * 1024 * 1024);
  if (m[2] === "gb") return Math.round(n * 1024);
  return Math.round(n);
}

function parsePriceCents(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

function parseValidityDays(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  const s = String(v).toLowerCase();
  const m = s.match(/([\d.]+)\s*(day|день|дн|month|мес|week|нед|year|год|y)/);
  if (!m) {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  const n = parseFloat(m[1]);
  if (m[2].startsWith("month") || m[2] === "мес") return Math.round(n * 30);
  if (m[2].startsWith("week") || m[2] === "нед") return Math.round(n * 7);
  if (m[2].startsWith("year") || m[2] === "год" || m[2] === "y") return Math.round(n * 365);
  return Math.round(n);
}

function strArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  return undefined;
}

/** Извлекает массив элементов из разных возможных обёрток ответа. */
function extractList(body: unknown): Any[] {
  const b = asAny(body);
  if (!b) return Array.isArray(body) ? (body as Any[]) : [];
  for (const key of ["packages", "data", "items", "results", "list"]) {
    const v = b[key];
    if (Array.isArray(v)) return v as Any[];
    const inner = asAny(v);
    if (inner) {
      for (const k2 of ["packages", "items", "results", "list"]) {
        if (Array.isArray(inner[k2])) return inner[k2] as Any[];
      }
    }
  }
  return [];
}

/* ---------------------- Маппинг плана ---------------------- */

function mapPlan(raw: Any, idx: number): CatalogPlan | null {
  const id = String(pick(raw, "id", "package_id", "packageId", "plan_id", "sku", "code") ?? "");
  if (!id) return null;

  const countryCode = pick(raw, "country_code", "countryCode", "iso", "iso2", "country_iso");
  const countryName = pick(raw, "country", "country_name", "countryName") as string | undefined;
  const regionRaw = pick(raw, "region", "region_name", "zone", "area") as string | undefined;

  const dataMb = parseDataMb(pick(raw, "data", "data_amount", "dataAmount", "volume", "data_mb", "dataMb", "size"));
  const validityDays = parseValidityDays(pick(raw, "validity", "validity_days", "validityDays", "duration", "period", "days"));
  const wholesaleCents = parsePriceCents(pick(raw, "price", "wholesale_price", "cost", "amount", "retail_price"));
  if (!dataMb || !validityDays || wholesaleCents === undefined) return null;

  const unlimited = Boolean(pick(raw, "unlimited")) || /unlimited|безлимит/i.test(String(pick(raw, "data", "volume") ?? ""));
  const isGlobal = /global|world/i.test(String(regionRaw ?? "")) || String(countryCode ?? "").toUpperCase() === "WW";

  let kind: "country" | "region" | "global" = "country";
  let regionSlug: string | undefined;
  let cc = countryCode ? String(countryCode).toUpperCase() : undefined;

  if (isGlobal) {
    kind = "global";
    cc = undefined;
    regionSlug = "global";
  } else if (!cc && regionRaw) {
    kind = "region";
    regionSlug = regionSlugOf(regionRaw);
  } else if (cc && regionRaw && /multi|regional|кроме/i.test(String(regionRaw)) && !RU_NAMES[cc] && !countryName) {
    kind = "region";
    regionSlug = regionSlugOf(regionRaw);
  }

  const regionName = regionSlug ? regionNameRu(regionSlug) : undefined;
  const countryNameRuV = cc ? countryNameRu(cc, countryName ?? cc) : undefined;

  const title =
    kind === "global"
      ? "Весь мир"
      : kind === "region"
        ? regionName ?? regionSlug ?? "Регион"
        : countryNameRuV ?? countryName ?? cc ?? "Тариф";

  return {
    providerPlanId: id,
    kind,
    countryCode: kind === "country" ? cc : undefined,
    countryName: kind === "country" ? countryName ?? cc : undefined,
    countryNameRu: kind === "country" ? countryNameRuV : undefined,
    regionSlug: kind === "global" ? "global" : regionSlug,
    regionName,
    title,
    dataMb,
    unlimited,
    validityDays,
    voiceMinutes: pick(raw, "voice", "minutes") as number | undefined,
    smsCount: pick(raw, "sms") as number | undefined,
    wholesaleCents,
    currency: String(pick(raw, "currency", "currency_code") ?? "USD").toUpperCase(),
    networks: strArray(pick(raw, "networks", "network_types", "network_type")),
    operators: strArray(pick(raw, "coverage", "operators", "carriers", "networks_names")),
    speed: (pick(raw, "speed", "network_speed") as string | undefined) ?? undefined,
    hotspot: pick(raw, "hotspot", "tethering") as boolean | undefined,
    description: (pick(raw, "description", "short_description") as string | undefined) ?? undefined,
    terms: (pick(raw, "terms", "conditions", "notes") as string | undefined) ?? undefined,
    popular: Boolean(pick(raw, "popular", "featured")),
  };
}

/* ---------------------- Провайдер ---------------------- */

export const telmoProvider: EsimProvider = {
  id: "telmo",

  async ping() {
    try {
      // Пытаемся дешёвый запрос; на реальном API может быть /balance или /packages?per_page=1
      try {
        const body = await apiRequest<unknown>(this.id, "ping/balance", `${BASE()}/balance`, {
          apiKey: KEY(),
        });
        const b = asAny(body);
        const bal = parsePriceCents(pick(asAny(pick(b, "data") as unknown) ?? b, "balance", "amount", "value"));
        return { ok: true, balance: bal };
      } catch {
        await apiRequest<unknown>(this.id, "ping/packages", `${BASE()}/packages?per_page=1`, { apiKey: KEY() });
        return { ok: true };
      }
    } catch (e) {
      const msg = e instanceof ProviderError ? `${e.message}` : String(e);
      return { ok: false, message: msg };
    }
  },

  async listCatalog(): Promise<CatalogPlan[]> {
    const perPage = 100;
    const out: CatalogPlan[] = [];
    for (const query of ["", "?per_page=100&page=1"]) {
      void query;
    }
    let page = 1;
    let totalPages = 1;
    do {
      const body = await apiRequest<unknown>(
        this.id,
        "packages.list",
        `${BASE()}/packages?per_page=${perPage}&page=${page}`,
        { apiKey: KEY() }
      );
      const list = extractList(body);
      const meta = asAny(pick(asAny(body), "meta")) ?? {};
      const tp = pick(meta, "total_pages", "totalPages", "pages");
      if (typeof tp === "number") totalPages = tp;
      else if (list.length < perPage) totalPages = page;
      for (const raw of list) {
        const p = mapPlan(raw, page);
        if (p) out.push(p);
      }
      page += 1;
    } while (page <= totalPages && page <= 50);
    return out;
  },

  async createOrder(req: ProviderOrderRequest): Promise<ProviderOrderResult> {
    const payload = {
      package_id: req.providerPlanId,
      customer: { email: req.customerEmail, name: req.customerName },
      reference: req.reference,
      metadata: { order_reference: req.reference },
    };
    const body = await apiRequest<unknown>(this.id, "orders.create", `${BASE()}/orders`, {
      apiKey: KEY(),
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = asAny(pick(asAny(body), "data")) ?? asAny(body) ?? {};
    const providerOrderId = String(
      pick(data, "order_id", "orderId", "id", "reference") ?? ""
    );
    const esimRaw = asAny(pick(data, "esim", "sim", "esim_data")) ?? {};
    const esim = {
      iccid: pick(esimRaw, "iccid") as string | undefined,
      lpa: (pick(esimRaw, "manual_code", "lpa", "activation_code", "qrcode", "qr_string") as string | undefined)
        ?.replace(/^LPA:1\$/i, "LPA:1$") ?? undefined,
      qrUrl: pick(esimRaw, "qr_code", "qr_url", "qrCode") as string | undefined,
      activationUrl: pick(esimRaw, "activation_url", "activationUrl") as string | undefined,
      expiresAt: pick(data, "expires_at", "expiresAt") as string | undefined,
    };
    if (!providerOrderId) {
      throw new ProviderError("В ответе orders.create нет order_id", "orders.create", 200, body);
    }
    return { providerOrderId, status: String(pick(data, "status") ?? "pending"), esim, raw: body };
  },

  async getOrder(providerOrderId: string): Promise<ProviderOrderStatus> {
    const body = await apiRequest<unknown>(this.id, "orders.get", `${BASE()}/orders/${providerOrderId}`, {
      apiKey: KEY(),
    });
    const data = asAny(pick(asAny(body), "data")) ?? asAny(body) ?? {};
    const esimRaw = asAny(pick(data, "esim", "sim")) ?? {};
    const usageRaw = asAny(pick(data, "usage")) ?? {};
    return {
      providerOrderId,
      status: String(pick(data, "status") ?? "unknown"),
      esim: {
        iccid: pick(esimRaw, "iccid") as string | undefined,
        lpa: pick(esimRaw, "manual_code", "lpa", "activation_code") as string | undefined,
        qrUrl: pick(esimRaw, "qr_code", "qr_url") as string | undefined,
        activationUrl: pick(esimRaw, "activation_url") as string | undefined,
        expiresAt: pick(data, "expires_at") as string | undefined,
      },
      usage: {
        usedMb: undefined,
        totalMb: parseDataMb(pick(usageRaw, "data_total", "total")),
        percent: pick(usageRaw, "percentage_used") as number | undefined,
      },
      raw: body,
    };
  },
};

export function getProvider(): EsimProvider {
  return telmoProvider;
}
