/**
 * Слой доступа к данным — Supabase Postgres (postgres.js).
 * Помощники get/all/run сохраняют прежний синтаксис `?`-параметров,
 * транзакции через AsyncLocalStorage (вложенные tx безопасны при конкурентности).
 */
import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, randomBytes } from "node:crypto";
import { config } from "./config";

type Sql = postgres.Sql;
/** Клиент: либо пул, либо транзакционный клиент (внутри tx). */
type DbClient = Sql | postgres.TransactionSql;
type Row = Record<string, unknown>;

let _sql: Sql | null = null;
let _ready: Promise<void> | null = null;
const als = new AsyncLocalStorage<DbClient>();

export function db(): Sql {
  if (!_sql) {
    _sql = postgres(config.databaseUrl, {
      connect_timeout: 15,
      max: 10,
      idle_timeout: 20,
      prepare: false, // совместимо с pgbouncer (Supabase pooler)
    });
    _ready = ensureSchema(_sql);
  }
  return _sql;
}

function client(): DbClient {
  return als.getStore() ?? db();
}

export async function exec(query: string, params: unknown[]): Promise<unknown[]> {
  await _ready;
  // postgres.js использует $1…$n — переводим привычные `?` в нумерованные плейсхолдеры
  let i = 0;
  const pg = query.replace(/\?/g, () => `$${++i}`);
  return client().unsafe(pg, params as never[]);
}

export async function get<T = Row>(query: string, ...params: unknown[]): Promise<T | undefined> {
  const rows = await exec(query, params);
  return rows[0] as T | undefined;
}

export async function all<T = Row>(query: string, ...params: unknown[]): Promise<T[]> {
  return (await exec(query, params)) as T[];
}

export async function run(query: string, ...params: unknown[]): Promise<{ changes: number }> {
  const res = await exec(query, params);
  return { changes: (res as unknown as { count?: number }).count ?? res.length };
}

/** Транзакция. Внутри fn используйте те же get/all/run — они пойдут в транзакционный клиент. */
export async function tx<T>(fn: () => T | Promise<T>): Promise<T> {
  return db().begin(async (scoped) => als.run(scoped, async () => await fn()));
}

/* ---------- Идентификаторы/время ---------- */

export function uuid(): string {
  return randomUUID();
}

export function token(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* ---------- Схема (идемпотентная) ---------- */

async function ensureSchema(sql: Sql) {
  await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    name TEXT,
    locale TEXT NOT NULL DEFAULT 'ru',
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    purpose TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    provider_plan_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    country_code TEXT,
    country_name TEXT,
    country_name_ru TEXT,
    region_slug TEXT,
    region_name TEXT,
    title TEXT NOT NULL,
    data_mb INTEGER NOT NULL,
    validity_days INTEGER NOT NULL,
    unlimited INTEGER NOT NULL DEFAULT 0,
    voice_minutes INTEGER,
    sms_count INTEGER,
    wholesale_cents INTEGER NOT NULL,
    retail_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    networks TEXT,
    operators TEXT,
    speed TEXT,
    hotspot INTEGER,
    description TEXT,
    terms TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    popular INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT NOT NULL,
    UNIQUE(provider_id, provider_plan_id)
  );
  CREATE INDEX IF NOT EXISTS idx_plans_country ON plans(country_code, active);
  CREATE INDEX IF NOT EXISTS idx_plans_region ON plans(region_slug, active);

  CREATE TABLE IF NOT EXISTS price_rules (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    target TEXT,
    markup_percent REAL NOT NULL,
    fixed_markup_cents INTEGER NOT NULL DEFAULT 0,
    min_margin_cents INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    user_id TEXT REFERENCES users(id),
    email TEXT,
    telegram_id BIGINT,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    plan_snapshot TEXT NOT NULL,
    status TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    promo_code TEXT,
    payment_method TEXT,
    payment_ref TEXT,
    usdt_amount TEXT,
    usdt_tx TEXT,
    paid_at TEXT,
    provider_order_id TEXT,
    provider_status TEXT,
    esim_iccid TEXT,
    esim_lpa TEXT,
    esim_qr_data TEXT,
    esim_activation_url TEXT,
    esim_expires_at TEXT,
    esim_state TEXT,
    delivery_token TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL DEFAULT 'web',
    admin_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

  CREATE TABLE IF NOT EXISTS order_events (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    type TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    provider TEXT NOT NULL,
    external_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    raw TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_external ON payments(provider, external_id) WHERE external_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    value INTEGER NOT NULL,
    min_order_cents INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    per_user_limit INTEGER NOT NULL DEFAULT 1,
    first_order_only INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    ends_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS promo_redemptions (
    id TEXT PRIMARY KEY,
    promo_code TEXT NOT NULL REFERENCES promo_codes(code),
    order_id TEXT NOT NULL REFERENCES orders(id),
    user_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS provider_errors (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    order_id TEXT,
    request TEXT,
    response TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS catalog_syncs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    items INTEGER,
    message TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    meta TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_user_id TEXT NOT NULL REFERENCES users(id),
    invited_user_id TEXT NOT NULL REFERENCES users(id),
    reward_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bot_sessions (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `);
}

/* ---------- Настройки/аудит ---------- */

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value;
}

export async function setSetting(key: string, value: string) {
  await run(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value
  );
}

export async function audit(actor: string, action: string, entity?: string, entityId?: string, meta?: unknown) {
  await run(
    "INSERT INTO audit_log(id, actor, action, entity, entity_id, meta, created_at) VALUES(?,?,?,?,?,?,?)",
    uuid(),
    actor,
    action,
    entity ?? null,
    entityId ?? null,
    meta ? JSON.stringify(meta) : null,
    nowIso()
  );
}

export async function logProviderError(provider: string, operation: string, orderId: string | null, request: unknown, response: unknown) {
  await run(
    "INSERT INTO provider_errors(id, provider, operation, order_id, request, response, created_at) VALUES(?,?,?,?,?,?,?)",
    uuid(),
    provider,
    operation,
    orderId,
    request ? JSON.stringify(request) : null,
    response ? JSON.stringify(response) : null,
    nowIso()
  );
}
