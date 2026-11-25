import { upsertPromo, listPromos } from "@/core/promos";
import { formatUsd } from "@/core/money";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createPromo(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return;
  const kind = String(formData.get("kind")) as "percent" | "fixed";
  const value = kind === "percent" ? parseInt(String(formData.get("percent_value")) || "0") : Math.round(parseFloat(String(formData.get("fixed_value") || "0")) * 100);
  if (!value) return;
  await upsertPromo({
    code,
    kind,
    value,
    min_order_cents: Math.round(parseFloat(String(formData.get("min_order") || "0")) * 100),
    max_uses: formData.get("max_uses") ? parseInt(String(formData.get("max_uses"))) : null,
    per_user_limit: parseInt(String(formData.get("per_user_limit") || "1")),
    first_order_only: !!formData.get("first_order_only"),
    description: String(formData.get("description") || "") || undefined,
  });
  revalidatePath("/admin/promos");
}

async function togglePromo(formData: FormData) {
  "use server";
  const { run } = await import("@/core/db");
  await run("UPDATE promo_codes SET active = 1 - active WHERE code = ?", String(formData.get("code")));
  revalidatePath("/admin/promos");
}

export default async function AdminPromosPage() {
  const promos = await listPromos();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="h-display text-xl">Промокоды</h2>
        <p className="mt-1 text-sm text-muted">
          Скидки применяются на нашей стороне к розничной цене. Себестоимость у поставщика не меняется.
        </p>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2">Код</th>
                <th className="px-4 py-2">Скидка</th>
                <th className="px-4 py-2">Условия</th>
                <th className="px-4 py-2">Использовано</th>
                <th className="px-4 py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.code} className={`border-b border-line/40 ${p.active ? "" : "opacity-40"}`}>
                  <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                  <td className="px-4 py-3 text-signal">{p.kind === "percent" ? `${p.value}%` : formatUsd(p.value)}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {p.min_order_cents > 0 && <>от {formatUsd(p.min_order_cents)} · </>}
                    {p.max_uses !== null && <>лимит {p.max_uses} · </>}
                    {p.first_order_only ? "первый заказ · " : ""}
                    {p.per_user_limit}× на клиента
                    {p.description && <div className="mt-0.5">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3">{p.used_count}{p.max_uses ? `/${p.max_uses}` : ""}</td>
                  <td className="px-4 py-3">
                    <form action={togglePromo}>
                      <input type="hidden" name="code" value={p.code} />
                      <button className={`chip ${p.active ? "chip-active" : ""}`}>{p.active ? "активен" : "выкл"}</button>
                    </form>
                  </td>
                </tr>
              ))}
              {promos.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Промокодов нет — создайте первый справа</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside>
        <form action={createPromo} className="card space-y-3 p-4 text-sm">
          <h3 className="font-semibold">Новый промокод</h3>
          <div>
            <label className="label">Код</label>
            <input name="code" className="input uppercase" placeholder="GATETODATA1" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Тип</label>
              <select name="kind" className="input">
                <option value="fixed">Фикс. $</option>
                <option value="percent">Процент %</option>
              </select>
            </div>
            <div>
              <label className="label">Значение</label>
              <div className="flex flex-col gap-2">
                <input name="fixed_value" type="number" step="0.01" defaultValue="1" className="input" placeholder="1.00" />
                <input name="percent_value" type="number" step="1" defaultValue="10" className="input" placeholder="10" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Мин. заказ $</label>
              <input name="min_order" type="number" step="0.01" defaultValue="5" className="input" />
            </div>
            <div>
              <label className="label">Лимит всего</label>
              <input name="max_uses" type="number" defaultValue="100" className="input" placeholder="пусто = ∞" />
            </div>
          </div>
          <div>
            <label className="label">На одного клиента</label>
            <input name="per_user_limit" type="number" defaultValue="1" className="input" />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="first_order_only" defaultChecked className="accent-[#00E5A0]" />
            Только первый заказ
          </label>
          <div>
            <label className="label">Описание (для клиента)</label>
            <input name="description" className="input" placeholder="−$1 на первый заказ от $5" />
          </div>
          <button className="btn-primary btn-sm w-full">Создать промокод</button>
        </form>

        <div className="card mt-4 p-4 text-xs leading-relaxed text-muted">
          <div className="font-medium text-fg">Кампания TELMO</div>
          <p className="mt-1">
            Рекламная кампания TELMO ($1, max 100, min $5, первый заказ) не подтверждена как доступная
            через API. Создайте такой же промокод здесь — условия совпадают, скидка применится
            к нашей розничной цене.
          </p>
        </div>
      </aside>
    </div>
  );
}
