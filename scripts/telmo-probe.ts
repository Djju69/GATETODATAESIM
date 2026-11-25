/**
 * Probe TELMO API: проверяет реальные endpoint'ы по вашему ключу и печатает фактические форматы.
 * Документация на developer.telmoesim.com помечена как placeholder, поэтому этот скрипт
 * — источник истины. Запуск: npm run probe
 */
import { db } from "../src/core/db";
import { config } from "../src/core/config";

const BASE = config.telmo.apiBase.replace(/\/$/, "");
const KEY = config.telmo.apiKey;

if (!KEY) {
  console.error("❌ TELMO_API_KEY не задан. Заполните .env");
  process.exit(1);
}

async function call(name: string, url: string, init?: RequestInit) {
  console.log(`\n── ${name} ── ${url}`);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    const text = await res.text();
    console.log(`HTTP ${res.status}`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 2500));
    } catch {
      console.log(text.slice(0, 800));
    }
    return { status: res.status, ok: res.ok, body: text };
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : e}`);
    return { status: 0, ok: false, body: "" };
  }
}

async function main() {
  db();
  console.log(`Base URL: ${BASE}\n`);

  await call("packages (list)", `${BASE}/packages?per_page=5`);
  await call("packages (alt: packages/list)", `${BASE}/packages/list?per_page=5`);
  await call("balance", `${BASE}/balance`);
  await call("countries", `${BASE}/countries?per_page=5`);
  await call("orders (list)", `${BASE}/orders?per_page=5`);

  console.log("\n📋 Сверьте вывод с документацией поставщика. Форматы, которые мы понимаем:");
  console.log("   • data.packages | data | корневой массив — автоопределение");
  console.log("   • поля: id/package_id, data («1 GB» или МБ), validity, price, country_code, region");
  console.log("   Если формат другой — отредактируйте src/core/providers/telmo.ts (функции extractList/mapPlan).");
}

main().then(() => process.exit(0));
