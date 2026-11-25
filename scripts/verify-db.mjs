/** Быстрая проверка содержимого БД. Запуск: node scripts/verify-db.mjs */
import postgres from "postgres";
import fs from "node:fs";

const url = fs.readFileSync(".env", "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")).split("=").slice(1).join("=").trim();
const sql = postgres(url, { prepare: false, max: 1 });
try {
  const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
  console.log("Таблицы:", t.map((x) => x.table_name).join(", "));
  const p = await sql`SELECT COUNT(*)::int AS c FROM plans`;
  const pr = await sql`SELECT COUNT(*)::int AS c FROM promo_codes`;
  const sync = await sql`SELECT status, items FROM catalog_syncs ORDER BY started_at DESC LIMIT 1`;
  console.log("plans:", p[0].c, "| promo_codes:", pr[0].c, "| последняя синхронизация:", sync[0]?.status ?? "—");
  const sample = await sql`SELECT country_name_ru, data_mb, retail_cents FROM plans WHERE active=1 LIMIT 3`;
  for (const s of sample) console.log(`  · ${s.country_name_ru}: ${s.data_mb}MB → $${(s.retail_cents / 100).toFixed(2)}`);
  await sql.end();
} catch (e) {
  console.error("ERR:", e.message);
  process.exit(1);
}
