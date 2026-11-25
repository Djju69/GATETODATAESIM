import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { botUrl } from "@/core/config";

export const metadata: Metadata = {
  title: {
    default: "GATETODATA eSIM — интернет в поездках по всему миру",
    template: "%s · GATETODATA eSIM",
  },
  description:
    "Туристические eSIM для 200+ стран: Европа, Азия, США, ОАЭ, Турция. QR-код сразу после оплаты, активация за пару минут, без роуминга.",
  keywords: ["eSIM", "туристическая eSIM", "интернет в поездке", "esim россия", "esim турция", "esim европа"],
  openGraph: {
    title: "GATETODATA eSIM — интернет в поездках по всему миру",
    description: "eSIM для 200+ стран. QR после оплаты, активация за пару минут.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  width: "device-width",
  initialScale: 1,
};

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/80 backdrop-blur-md">
      <div className="section flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-signal/15 text-signal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 12.5a10 10 0 0 1 14 0" />
              <path d="M8.5 16a5 5 0 0 1 7 0" />
              <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">
            GATETO<span className="text-signal">DATA</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href="/countries" className="transition hover:text-fg">Страны</Link>
          <Link href="/regions" className="transition hover:text-fg">Регионы</Link>
          <Link href="/global" className="transition hover:text-fg">Весь мир</Link>
          <Link href="/help" className="transition hover:text-fg">Помощь</Link>
          <Link href="/account" className="transition hover:text-fg">Мои заказы</Link>
        </nav>
        <Link href="/countries" className="btn-primary btn-sm hidden sm:inline-flex">
          Выбрать eSIM
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-line/60 bg-ink/60">
      <div className="section grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="font-display text-lg font-semibold">
            GATETO<span className="text-signal">DATA</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Международный магазин туристических eSIM. Интернет в поездках без роуминга и физических SIM-карт.
          </p>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Каталог</div>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/countries" className="hover:text-fg">Все страны</Link></li>
            <li><Link href="/regions" className="hover:text-fg">Регионы</Link></li>
            <li><Link href="/global" className="hover:text-fg">Глобальные пакеты</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Поддержка</div>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/help" className="hover:text-fg">FAQ и установка</Link></li>
            <li><Link href="/help#compat" className="hover:text-fg">Совместимость устройств</Link></li>
            <li><a href="mailto:support@gatetodata.com" className="hover:text-fg">support@gatetodata.com</a></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Telegram</div>
          <p className="text-sm text-muted">Покупайте прямо в боте — заказы синхронизированы с сайтом.</p>
          <a
            href={botUrl()}
            className="btn-secondary btn-sm mt-3"
            target="_blank"
            rel="noopener"
          >
            Открыть бота
          </a>
        </div>
      </div>
      <div className="section flex flex-col gap-2 border-t border-line/50 py-6 text-xs text-muted/70 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} GATETODATA eSIM. Все права защищены.</span>
        <span>Оплата: Telegram Stars · USDT TRC-20 · карты (скоро)</span>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
