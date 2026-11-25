/**
 * Резервное копирование.
 * С БД на Supabase автоматические бэкапы делает сама платформа (Dashboard → Database → Backups).
 * Дополнительно можно выгружать через pg_dump:
 *   pg_dump "postgresql://postgres.<ref>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" > backup.sql
 * Этот скрипт проверяет связность с БД и напоминает о политике бэкапов.
 * Запуск: npm run backup (cron: 0 3 * * *)
 */
import { db, get } from "../src/core/db";

async function main() {
  db();
  const row = await get<{ now: string }>("SELECT to_char(now(),'YYYY-MM-DD HH24:MI:SS') AS now");
  const orders = await get<{ c: number }>("SELECT COUNT(*)::int AS c FROM orders");
  console.log(`✅ БД доступна (${row?.now}). Заказов: ${orders?.c ?? 0}.`);
  console.log("Автобэкапы Supabase активны в тарифе Free (7 дней).");
  console.log("Для офлайн-копий настройте pg_dump по расписанию (см. docs/05-DEPLOY.md).");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Ошибка бэкапа/подключения:", e instanceof Error ? e.message : e);
  process.exit(1);
});
