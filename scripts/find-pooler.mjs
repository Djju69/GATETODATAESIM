/**
 * Определяет регион Supabase-проекта перебором официальных pooler-хостов.
 * Прямой хост db.<ref>.supabase.co — только IPv6 и недоступен из этой сети,
 поэтому используем Session Pooler (IPv4).
 * Запуск: node scripts/find-pooler.mjs
 */
import postgres from "postgres";

const REF = "tcqgzgvgfitokekhnmzs";
const PASSWORD_ENC = "%2B%2Cvf6%24XgkPXVJ%24e";
const REGIONS = [
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-south-1", "sa-east-1",
];

for (const region of REGIONS) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const url = `postgresql://postgres.${REF}:${PASSWORD_ENC}@${host}:5432/postgres`;
  const sql = postgres(url, { connect_timeout: 8, max: 1, prepare: false });
  try {
    const [{ version }] = await sql`select version() as version`;
    console.log(`✅ НАЙДЕНО: ${host} — ${version.split(",")[0]}`);
    console.log(`\nДобавьте в .env:`);
    console.log(`DATABASE_URL=${url}`);
    await sql.end();
    process.exit(0);
  } catch (e) {
    const msg = String(e.message ?? e).slice(0, 80);
    console.log(`— ${host}: ${msg}`);
    await sql.end().catch(() => {});
  }
}
console.log("\n❌ Ни один регион не подошёл — проверьте пароль в Supabase (Settings → Database → Reset database password).");
process.exit(1);
