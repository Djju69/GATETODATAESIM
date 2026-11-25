import { all, run, uuid, audit, get, nowIso } from "@/core/db";
import { formatUsd } from "@/core/money";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface PriceRule {
  id: string;
  scope: string;
  target: string | null;
  markup_percent: number;
  fixed_markup_cents: number;
  min_margin_cents: number;
  active: number;
}

async function addRule(formData: FormData) {
  "use server";
  const scope = String(formData.get("scope")) as "global" | "country" | "region" | "plan";
  const target = String(formData.get("target") || "").trim() || null;
  const markup_percent = parseFloat(String(formData.get("markup_percent")) || "35");
  const fixed_markup_cents = Math.round(parseFloat(String(formData.get("fixed_markup") || "0")) * 100);
  const min_margin_cents = Math.round(parseFloat(String(formData.get("min_margin") || "1")) * 100);
  await run(
    "INSERT INTO price_rules(id, scope, target, markup_percent, fixed_markup_cents, min_margin_cents, priority, active) VALUES(?,?,?,?,?,?,?,1)",
    uuid(), scope, target, markup_percent, fixed_markup_cents, min_margin_cents, scope === "global" ? 0 : 10
  );
  await audit("admin", "price_rule.create", "price_rule", scope, { target, markup_percent });
  revalidatePath("/admin/plans");
}

async function toggleRule(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await run("UPDATE price_rules SET active = 1 - active WHERE id = ?", id);
  await audit("admin", "price_rule.toggle", "price_rule", id);
  revalidatePath("/admin/plans");
}

async function syncNow() {
  "use server";
  const { syncCatalog } = await import("@/core/catalog");
  await syncCatalog();
  revalidatePath("/admin/plans");
}

export default async function AdminPlansPage() {
  const [rules, topPlans, counts] = await Promise.all([
    all<PriceRule>("SELECT * FROM price_rules ORDER BY priority DESC, scope ASC"),
    all(
      `SELECT id, title, country_code, data_mb, wholesale_cents, retail_cents, active FROM plans
       ORDER BY active DESC, retail_cents ASC LIMIT 50`
    ),
    get<{ total: number; active: number; countries: number }>(
      "SELECT COUNT(*)::int AS total, COALESCE(SUM(active),0)::int AS active, COUNT(DISTINCT country_code)::int AS countries FROM plans"
    ),
  ]) as [PriceRule[], Array<{ id: string; title: string; country_code: string | null; data_mb: number; wholesale_cents: number; retail_cents: number; active: number }>, { total: number; active: number; countries: number } | undefined];
  void nowIso;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-display text-xl">Каталог и розничные цены</h2>
          <form action={syncNow}>
            <button className="btn-secondary btn-sm">🔄 Синхронизировать каталог</button>
          </form>
        </div>
        <p className="mt-1 text-sm text-muted">
          {counts ? `${counts.active} активных из ${counts.total} пакетов · ${counts.countries} стран` : "Каталог пуст"}
          {" · "}
          Розничная цена считается по правилам наценки при каждой синхронизации.
        </p>

        <div className="card mt-4 max-h-[480px] overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2">Тариф</th>
                <th className="px-4 py-2">Себест.</th>
                <th className="px-4 py-2">Розница</th>
                <th className="px-4 py-2">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {topPlans.map((p) => (
                <tr key={p.id} className={`border-b border-line/40 ${p.active ? "" : "opacity-40"}`}>
                  <td className="px-4 py-2.5">
                    {p.title}
                    {!p.active && <span className="ml-2 chip">неактивен</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{formatUsd(p.wholesale_cents)}</td>
                  <td className="px-4 py-2.5 font-semibold text-signal">{formatUsd(p.retail_cents)}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {formatUsd(p.retail_cents - p.wholesale_cents)} ({Math.round(((p.retail_cents - p.wholesale_cents) / p.retail_cents) * 100)}%)
                  </td>
                </tr>
              ))}
              {topPlans.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Каталог не синхронизирован</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside>
        <h2 className="h-display text-xl">Правила наценки</h2>
        <p className="mt-1 text-xs text-muted">Приоритет: план → страна → регион → глобальное</p>

        <form action={addRule} className="card mt-4 space-y-3 p-4 text-sm">
          <div>
            <label className="label">Уровень</label>
            <select name="scope" className="input">
              <option value="global">Все тарифы</option>
              <option value="country">Страна (код: TR, US…)</option>
              <option value="region">Регион (слаг: europe…)</option>
              <option value="plan">Конкретный план (ID)</option>
            </select>
          </div>
          <div>
            <label className="label">Цель (код страны / слаг / ID)</label>
            <input name="target" className="input" placeholder="только для страны/региона/плана" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Наценка %</label>
              <input name="markup_percent" type="number" step="1" defaultValue="35" className="input" />
            </div>
            <div>
              <label className="label">Фикс. $</label>
              <input name="fixed_markup" type="number" step="0.01" defaultValue="0" className="input" />
            </div>
            <div>
              <label className="label">Мин. маржа $</label>
              <input name="min_margin" type="number" step="0.01" defaultValue="1" className="input" />
            </div>
          </div>
          <button className="btn-primary btn-sm w-full">Добавить правило</button>
        </form>

        <div className="card mt-4 p-4 text-sm">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 border-b border-line/40 py-2 last:border-0">
              <div>
                <div className="font-medium">
                  {r.scope === "global" ? "🌐 Все тарифы" : r.scope === "country" ? `🏳 ${r.target}` : r.scope === "region" ? `🗺 ${r.target}` : `📦 ${r.target?.slice(0, 12)}…`}
                </div>
                <div className="text-xs text-muted">
                  +{r.markup_percent}%{r.fixed_markup_cents ? ` +${formatUsd(r.fixed_markup_cents)}` : ""} · мин. маржа {formatUsd(r.min_margin_cents)}
                </div>
              </div>
              <form action={toggleRule}>
                <input type="hidden" name="id" value={r.id} />
                <button className={`chip ${r.active ? "chip-active" : ""}`}>{r.active ? "активно" : "выкл"}</button>
              </form>
            </div>
          ))}
          {rules.length === 0 && <p className="text-muted">Правил нет — наценка по умолчанию 35%</p>}
        </div>
      </aside>
    </div>
  );
}
