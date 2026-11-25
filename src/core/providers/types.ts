/** Единый интерфейс поставщика eSIM. Подключение нового провайдера = новый адаптер. */

export type PlanKind = "country" | "region" | "global";

export interface CatalogPlan {
  providerPlanId: string;
  kind: PlanKind;
  countryCode?: string;
  countryName?: string;
  countryNameRu?: string;
  regionSlug?: string;
  regionName?: string;
  title: string;
  dataMb: number;
  unlimited?: boolean;
  validityDays: number;
  voiceMinutes?: number;
  smsCount?: number;
  wholesaleCents: number;
  currency: string;
  networks?: string[];
  operators?: string[];
  speed?: string;
  hotspot?: boolean;
  description?: string;
  terms?: string;
  popular?: boolean;
}

export interface ProviderOrderRequest {
  providerPlanId: string;
  customerEmail: string;
  customerName?: string;
  reference: string; // наш order.number
}

export interface EsimData {
  iccid?: string;
  lpa?: string; // LPA:1$...
  qrUrl?: string;
  activationUrl?: string;
  expiresAt?: string;
}

export interface ProviderOrderResult {
  providerOrderId: string;
  status: string;
  esim?: EsimData;
  raw?: unknown;
}

export interface ProviderOrderStatus {
  providerOrderId: string;
  status: string; // pending|active|expired|failed|...
  esim?: EsimData;
  usage?: { usedMb?: number; totalMb?: number; percent?: number };
  raw?: unknown;
}

export interface EsimProvider {
  readonly id: string;
  /** Проверка доступности API и ключа */
  ping(): Promise<{ ok: boolean; balance?: number; message?: string }>;
  listCatalog(): Promise<CatalogPlan[]>;
  createOrder(req: ProviderOrderRequest): Promise<ProviderOrderResult>;
  getOrder(providerOrderId: string): Promise<ProviderOrderStatus>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly status?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
