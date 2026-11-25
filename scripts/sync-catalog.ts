/**
 * Синхронизация каталога с TELMO: тянет пакеты, считает розничные цены
 * по правилам наценки, обновляет нашу БД. Запуск: npm run sync
 */
import { syncCatalog } from "../src/core/catalog";
import { db } from "../src/core/db";

async function main() {
  db(); // инициализация и миграции
  console.log("🔄 Синхронизация каталога TELMO…");
  const res = await syncCatalog();
  if (res.ok) {
    console.log(`✅ Готово: ${res.items} пакетов загружено`);
  } else {
    console.error(`❌ Ошибка: ${res.message}`);
    console.error("Проверьте TELMO_API_KEY в .env и запустите npm run probe для диагностики API.");
    process.exit(1);
  }
}

main().then(() => process.exit(0));
