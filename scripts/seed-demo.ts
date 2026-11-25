/**
 * ДЕМО-заполнение каталога — ТОЛЬКО для проверки интерфейса до подключения ключа TELMO.
 * Данные помечены флагом demo, на витрине показывается баннер «Демо-данные».
 * В рабочей версии фиктивных цен нет: каталог создаётся только `npm run sync`.
 *
 * Запуск: npm run seed-demo   |   Отключить демо: npm run seed-demo -- --off
 */
import { db, run, uuid, nowIso, getSetting, setSetting, get } from "../src/core/db";
import { computeRetailPrice } from "../src/core/pricing";

const DEMO_PLANS: Array<{
  cc: string; cn: string; cnru: string; data: string; days: number; wholesale: number;
}> = [
  { cc: "TR", cn: "Turkey", cnru: "Турция", data: "3 GB", days: 7, wholesale: 170 },
  { cc: "TR", cn: "Turkey", cnru: "Турция", data: "10 GB", days: 14, wholesale: 350 },
  { cc: "TR", cn: "Turkey", cnru: "Турция", data: "20 GB", days: 30, wholesale: 560 },
  { cc: "AE", cn: "United Arab Emirates", cnru: "ОАЭ", data: "2 GB", days: 7, wholesale: 260 },
  { cc: "AE", cn: "United Arab Emirates", cnru: "ОАЭ", data: "10 GB", days: 15, wholesale: 690 },
  { cc: "TH", cn: "Thailand", cnru: "Таиланд", data: "5 GB", days: 10, wholesale: 240 },
  { cc: "TH", cn: "Thailand", cnru: "Таиланд", data: "15 GB", days: 30, wholesale: 480 },
  { cc: "US", cn: "United States", cnru: "США", data: "5 GB", days: 15, wholesale: 420 },
  { cc: "US", cn: "United States", cnru: "США", data: "20 GB", days: 30, wholesale: 890 },
  { cc: "EG", cn: "Egypt", cnru: "Египет", data: "3 GB", days: 7, wholesale: 250 },
  { cc: "EG", cn: "Egypt", cnru: "Египет", data: "10 GB", days: 15, wholesale: 540 },
  { cc: "GB", cn: "United Kingdom", cnru: "Великобритания", data: "5 GB", days: 15, wholesale: 330 },
  { cc: "GR", cn: "Greece", cnru: "Греция", data: "5 GB", days: 15, wholesale: 310 },
  { cc: "IT", cn: "Italy", cnru: "Италия", data: "5 GB", days: 15, wholesale: 310 },
  { cc: "ES", cn: "Spain", cnru: "Испания", data: "5 GB", days: 15, wholesale: 310 },
  { cc: "DE", cn: "Germany", cnru: "Германия", data: "5 GB", days: 15, wholesale: 310 },
  { cc: "KZ", cn: "Kazakhstan", cnru: "Казахстан", data: "3 GB", days: 7, wholesale: 150 },
  { cc: "VN", cn: "Vietnam", cnru: "Вьетнам", data: "5 GB", days: 15, wholesale: 260 },
  { cc: "JP", cn: "Japan", cnru: "Япония", data: "8 GB", days: 15, wholesale: 520 },
  { cc: "CN", cn: "China", cnru: "Китай", data: "10 GB", days: 15, wholesale: 470 },
  { cc: "IN", cn: "India", cnru: "Индия", data: "10 GB", days: 15, wholesale: 290 },
  { cc: "ID", cn: "Indonesia", cnru: "Индонезия", data: "10 GB", days: 15, wholesale: 350 },
  { cc: "CY", cn: "Cyprus", cnru: "Кипр", data: "5 GB", days: 10, wholesale: 300 },
  { cc: "ME", cn: "Montenegro", cnru: "Черногория", data: "5 GB", days: 10, wholesale: 300 },
];

function parseMb(s: string): number {
  const m = s.match(/(\d+)/)!;
  return m[1] ? parseInt(m[1]) * 1024 : 0;
}

async function main() {
  db();
  const off = process.argv.includes("--off");
  if (off) {
    await setSetting("demo_mode", "0");
    await run("DELETE FROM plans WHERE provider_id = 'demo'");
    console.log("✅ Демо-данные отключены и удалены. Запустите npm run sync для реального каталога.");
    return;
  }
  if ((await getSetting("demo_mode")) === "1") {
    console.log("Демо уже включено. Отключить: npm run seed-demo -- --off");
    return;
  }
  const now = nowIso();
  for (const p of DEMO_PLANS) {
    const dataMb = parseMb(p.data);
    const planId = `demo-${p.cc}-${dataMb}-${p.days}`;
    const retail = await computeRetailPrice({
      wholesaleCents: p.wholesale, currency: "USD", kind: "country",
      countryCode: p.cc, regionSlug: null, providerPlanId: planId,
    });
    const regionSlug =
      ["TR", "EG", "AE"].includes(p.cc) ? "middle-east"
      : p.cc === "US" ? "north-america"
      : p.cc === "KZ" ? "cis"
      : ["JP", "CN", "IN", "VN", "ID", "TH"].includes(p.cc) ? "asia"
      : "europe";
    const title = `${p.cnru} · ${p.data} · ${p.days} дн`;
    // 22 колонки — 22 плейсхолдера, порядок строгий
    await run(
      `INSERT INTO plans(id, provider_id, provider_plan_id, kind, country_code, country_name, country_name_ru,
       region_slug, region_name, title, data_mb, validity_days, unlimited, wholesale_cents, retail_cents,
       currency, networks, operators, hotspot, active, popular, synced_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(provider_id, provider_plan_id) DO NOTHING`,
      uuid(), "demo", planId, "country", p.cc, p.cn, p.cnru,
      regionSlug, null, title, dataMb, p.days, 0, p.wholesale, retail,
      "USD", "4G, LTE", "локальные сети партнёров", 1, 1, 1, now
    );
  }
  // Демо-промокод (те же условия, что у кампании TELMO)
  await run(
    `INSERT INTO promo_codes(code, kind, value, min_order_cents, max_uses, used_count, per_user_limit,
      first_order_only, description, active, created_at)
     VALUES('WELCOME1','fixed',100,500,100,0,1,1,'−$1 на первый заказ от $5',1,?)
     ON CONFLICT(code) DO NOTHING`,
    now
  );
  await setSetting("demo_mode", "1");
  const count = await get<{ c: number }>("SELECT COUNT(*)::int AS c FROM plans WHERE provider_id = 'demo'");
  console.log(`✅ Демо-каталог создан (${count?.c ?? 0} тарифов, баннер на витрине).`);
  console.log("   Отключить: npm run seed-demo -- --off");
  console.log("   После получения TELMO_API_KEY: npm run sync (заменит демо на реальные данные).");
  process.exit(0);
}

main();
