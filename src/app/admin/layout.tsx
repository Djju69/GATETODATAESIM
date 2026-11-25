import Link from "next/link";
import { isAdmin } from "@/core/admin-auth";
import AdminLogin from "./login-form";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Дашборд", icon: "📊" },
  { href: "/admin/orders", label: "Заказы", icon: "🧾" },
  { href: "/admin/plans", label: "Цены и каталог", icon: "🏷️" },
  { href: "/admin/promos", label: "Промокоды", icon: "🎟️" },
  { href: "/admin/errors", label: "Ошибки провайдера", icon: "⚠️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();
  if (!authed) {
    return <AdminLogin />;
  }
  return (
    <div className="section py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h-display text-2xl">GATETODATA · Админка</h1>
          <p className="text-xs text-muted">Все действия журналируются</p>
        </div>
        <form action="/admin/logout" method="GET">
          <button className="btn-ghost btn-sm">Выйти</button>
        </form>
      </div>
      <nav className="mt-6 flex flex-wrap gap-2">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="chip hover:border-signal/50 hover:text-fg">
            {n.icon} {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
