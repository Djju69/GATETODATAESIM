import { all, run } from "@/core/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function resolve(formData: FormData) {
  "use server";
  await run("UPDATE provider_errors SET resolved = 1 WHERE id = ?", String(formData.get("id")));
  revalidatePath("/admin/errors");
}

export default async function AdminErrorsPage() {
  const errors = (await all(
    "SELECT * FROM provider_errors ORDER BY created_at DESC LIMIT 100"
  )) as Array<{
    id: string; provider: string; operation: string; order_id: string | null;
    request: string | null; response: string | null; resolved: number; created_at: string;
  }>;

  const open = errors.filter((e) => !e.resolved);

  return (
    <div>
      <h2 className="h-display text-xl">Ошибки провайдера</h2>
      <p className="mt-1 text-sm text-muted">
        {open.length ? `${open.length} открытых ошибок` : "Открытых ошибок нет"} — всего записей: {errors.length}
      </p>

      <div className="mt-4 space-y-3">
        {errors.map((e) => (
          <div key={e.id} className={`card p-4 text-sm ${e.resolved ? "opacity-50" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs text-muted">{new Date(e.created_at).toLocaleString("ru-RU")}</span>
                <span className="ml-2 font-semibold">{e.provider} · {e.operation}</span>
                {e.order_id && <span className="ml-2 chip">{e.order_id.slice(0, 8)}…</span>}
              </div>
              {!e.resolved && (
                <form action={resolve}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="chip hover:border-signal/50">Пометить решённой</button>
                </form>
              )}
            </div>
            {(e.response || e.request) && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-line bg-raised p-3 text-xs text-muted">
{e.response ?? e.request}
              </pre>
            )}
          </div>
        ))}
        {errors.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">Ошибок не зафиксировано</div>
        )}
      </div>
    </div>
  );
}
