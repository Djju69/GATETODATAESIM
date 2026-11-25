/** Проверка подключения к Supabase. Запуск: node scripts/test-supabase.mjs */
import postgres from "postgres";
import fs from "node:fs";

// Читаем DATABASE_URL из .env
const env = fs.readFileSync(".env", "utf8");
const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const url = line?.split("=").slice(1).join("=").trim();
if (!url) {
  console.error("DATABASE_URL не найден в .env");
  process.exit(1);
}
console.log("Подключаюсь:", url.replace(/:[^:@]+@/, ":***@"));
const sql = postgres(url, { connect_timeout: 15 });
try {
  const [{ version }] = await sql`select version() as version`;
  console.log("✅ Postgres:", version.split(",")[0]);
  const tables = await sql`select count(*)::int as n from information_schema.tables where table_schema='public'`;
  console.log("Таблиц в public:", tables[0].n);
} catch (e) {
  console.error("❌ Ошибка:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
