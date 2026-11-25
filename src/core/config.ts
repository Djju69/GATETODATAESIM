/** Загрузка и валидация конфигурации из окружения. */
import fs from "node:fs";
import path from "node:path";

function loadEnvFile() {
  // Простейший парсер .env (без зависимостей), чтобы работать и через npm-скрипты, и через next.
  const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), ".env.local")];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}
loadEnvFile();

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}
function int(name: string, fallback: number): number {
  const v = parseInt(str(name), 10);
  return Number.isFinite(v) ? v : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const v = str(name).toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

export const config = {
  databaseUrl: str("DATABASE_URL"),
  baseUrl: str("BASE_URL", "http://localhost:3010"),

  sessionSecret: str("SESSION_SECRET", "dev-only-secret-change-me"),
  adminPassword: str("ADMIN_PASSWORD", ""),

  telmo: {
    apiKey: str("TELMO_API_KEY"),
    apiBase: str("TELMO_API_BASE", "https://api.telmoesim.com/v1"),
    webhookSecret: str("TELMO_WEBHOOK_SECRET"),
    timeoutMs: int("TELMO_TIMEOUT_MS", 20_000),
  },

  telegram: {
    botToken: str("TELEGRAM_BOT_TOKEN"),
    botUsername: str("TELEGRAM_BOT_USERNAME"),
    webhookSecret: str("TELEGRAM_WEBHOOK_SECRET"),
    adminTelegramId: int("ADMIN_TELEGRAM_ID", 0),
  },

  usdt: {
    wallet: str("USDT_WALLET_ADDRESS"),
    trongridKey: str("TRONGRID_API_KEY"),
    rate: parseFloat(str("USDT_RATE", "1.0")) || 1.0,
    // Ожидаемое число подтверждений
    confirmations: int("USDT_CONFIRMATIONS", 19),
    ttlMinutes: int("USDT_TTL_MINUTES", 30),
  },

  starsEnabled: bool("PAYMENTS_STARS_ENABLED", true),

  isProd: process.env.NODE_ENV === "production",
};

/** Ссылка на бота для интерфейса (fallback на реальное имя из env). */
export function botUrl(): string {
  return `https://t.me/${config.telegram.botUsername || "GatetodataEsimBOT"}`;
}

export function requireConfig(checks: { ok: boolean; message: string }[]) {
  const failed = checks.filter((c) => !c.ok).map((c) => c.message);
  if (failed.length) throw new Error("Отсутствует конфигурация:\n- " + failed.join("\n- "));
}
