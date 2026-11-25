"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flagEmoji } from "@/core/countries";

export interface CountryOption {
  code: string;
  name_ru: string;
  min_price_cents: number;
}

export default function CountrySearch({ countries }: { countries?: CountryOption[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Список стран передаётся с сервера (fallback — базовые направления)
  const options: CountryOption[] = countries ?? DEFAULT_TOP;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 6);
    return options.filter((c) => c.name_ru.toLowerCase().includes(s) || c.code.toLowerCase() === s).slice(0, 8);
  }, [q, options]);

  function go(code: string) {
    setOpen(false);
    router.push(`/countries/${code}`);
  }

  return (
    <div className="relative mx-auto w-full max-w-xl text-left">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (filtered[0]) go(filtered[0].code);
        }}
        className="relative"
      >
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setOpen(true); }}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
          placeholder="Страна назначения — например, Турция или ОАЭ"
          className="input h-14 rounded-2xl pl-11 pr-28 text-base shadow-glow"
          aria-label="Поиск страны"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary absolute right-1.5 top-1/2 h-11 -translate-y-1/2 px-5">
          Найти
        </button>
      </form>

      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(c.code)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-raised"
            >
              <span className="flex items-center gap-3">
                <span className="text-xl">{flagEmoji(c.code)}</span>
                <span className="font-medium">{c.name_ru}</span>
              </span>
              <span className="text-sm text-signal">от ${(c.min_price_cents / 100).toFixed(0)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_TOP: CountryOption[] = [
  { code: "TR", name_ru: "Турция", min_price_cents: 299 },
  { code: "AE", name_ru: "ОАЭ", min_price_cents: 399 },
  { code: "TH", name_ru: "Таиланд", min_price_cents: 349 },
  { code: "US", name_ru: "США", min_price_cents: 499 },
  { code: "EG", name_ru: "Египет", min_price_cents: 349 },
  { code: "DE", name_ru: "Германия", min_price_cents: 399 },
];
