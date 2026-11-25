/** Клиентски-безопасные помощники по странам/регионам (без node-зависимостей). */

export const RU_NAMES: Record<string, string> = {
  US: "США", GB: "Великобритания", DE: "Германия", FR: "Франция", IT: "Италия", ES: "Испания",
  PT: "Португалия", GR: "Греция", TR: "Турция", AE: "ОАЭ", TH: "Таиланд", VN: "Вьетнам",
  JP: "Япония", KR: "Южная Корея", CN: "Китай", HK: "Гонконг", SG: "Сингапур", MY: "Малайзия",
  ID: "Индонезия", IN: "Индия", KZ: "Казахстан", UZ: "Узбекистан", AM: "Армения", GE: "Грузия",
  AZ: "Азербайджан", KG: "Кыргызстан", TJ: "Таджикистан", MD: "Молдова", BY: "Беларусь",
  UA: "Украина", RU: "Россия", CY: "Кипр", MT: "Мальта", NL: "Нидерланды", BE: "Бельгия",
  AT: "Австрия", CH: "Швейцария", SE: "Швеция", NO: "Норвегия", DK: "Дания", FI: "Финляндия",
  PL: "Польша", CZ: "Чехия", SK: "Словакия", HU: "Венгрия", RO: "Румыния", BG: "Болгария",
  HR: "Хорватия", SI: "Словения", RS: "Сербия", ME: "Черногория", AL: "Албания", MK: "Северная Македония",
  BA: "Босния и Герцеговина", EE: "Эстония", LV: "Латвия", LT: "Литва", IE: "Ирландия", IS: "Исландия",
  LU: "Люксембург", CA: "Канада", MX: "Мексика", BR: "Бразилия", AR: "Аргентина", CL: "Чили",
  PE: "Перу", CO: "Колумбия", EC: "Эквадор", UY: "Уругвай", PA: "Панама", CR: "Коста-Рика",
  DO: "Доминикана", CU: "Куба", JM: "Ямайка", EG: "Египет", MA: "Марокко", ZA: "ЮАР",
  KE: "Кения", TZ: "Танзания", NG: "Нигерия", GH: "Гана", TN: "Тунис", IL: "Израиль",
  JO: "Иордания", SA: "Саудовская Аравия", QA: "Катар", KW: "Кувейт", OM: "Оман", BH: "Бахрейн",
  LK: "Шри-Ланка", NP: "Непал", BD: "Бангладеш", PH: "Филиппины", KH: "Камбоджа", LA: "Лаос",
  MM: "Мьянма", MN: "Монголия", NZ: "Новая Зеландия", AU: "Австралия", FJ: "Фиджи", MV: "Мальдивы",
};

export function countryNameRu(code: string, fallback: string): string {
  return RU_NAMES[code?.toUpperCase()] ?? fallback;
}

export function flagEmoji(code?: string | null): string {
  if (!code || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const cc = code.toUpperCase();
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

export const REGION_SLUGS: Record<string, string> = {
  europe: "europe", asia: "asia", "north america": "north-america", "south america": "south-america",
  africa: "africa", oceania: "oceania", "middle east": "middle-east", global: "global",
  world: "global", cis: "cis", "united states": "north-america", "central america": "central-america",
};

export const REGION_RU: Record<string, string> = {
  europe: "Европа", asia: "Азия", "north-america": "Северная Америка", "south-america": "Южная Америка",
  africa: "Африка", oceania: "Океания", "middle-east": "Ближний Восток", global: "Весь мир",
  cis: "СНГ", "central-america": "Центральная Америка",
};

export function regionSlugOf(raw: string | undefined): string {
  if (!raw) return "";
  return REGION_SLUGS[raw.trim().toLowerCase()] ?? raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function regionNameRu(slug: string): string {
  return REGION_RU[slug] ?? slug;
}
