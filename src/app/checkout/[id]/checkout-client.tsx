"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dataLabel, validityLabel } from "@/core/money";

interface Method {
  id: "stars" | "usdt";
  title: string;
  desc: string;
  available: boolean;
  badge?: string;
}

export default function CheckoutClient(props: {
  orderId: string;
  orderNumber: string;
  title: string;
  dataMb: number;
  validityDays: number;
  email: string;
  telegramId: number | null;
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  methods: Method[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method["id"]>(props.methods.find((m) => m.available)?.id ?? "usdt");
  const [promo, setPromo] = useState(props.promoCode ?? "");
  const [discount, setDiscount] = useState(props.discountCents);
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Math.max(0, props.subtotalCents - discount);

  async function applyPromo() {
    if (!promo.trim()) return;
    setBusy(true);
    setPromoMsg(null);
    try {
      const res = await fetch(`/api/orders/${props.orderId}/promo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo.trim() }),
      });
      const body = await res.json();
      if (body.ok) {
        setDiscount(body.discountCents);
        setPromoMsg({ text: `Промокод применён: −$${(body.discountCents / 100).toFixed(2)}`, ok: true });
      } else {
        setPromoMsg({ text: body.error, ok: false });
      }
    } catch {
      setPromoMsg({ text: "Ошибка сети", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${props.orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const body = await res.json();
      if (!body.ok) {
        setError(body.error ?? "Не удалось начать оплату");
        return;
      }
      if (method === "usdt") {
        router.push(`/checkout/${props.orderId}/usdt`);
      } else if (body.payUrl) {
        window.location.href = body.payUrl;
      }
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section max-w-3xl py-10 sm:py-14">
      {/* Шаги */}
      <div className="mb-8 flex items-center gap-2 text-xs sm:text-sm">
        {["Тариф", "Данные", "Оплата", "eSIM"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                i < 3 ? "bg-signal text-ink" : "bg-raised text-muted"
              }`}
            >
              {i < 3 ? "✓" : i + 1}
            </span>
            <span className={i < 3 ? "text-fg" : "text-muted"}>{s}</span>
            {i < 3 && <span className="mx-1 h-px w-6 bg-line sm:w-10" />}
          </div>
        ))}
      </div>

      <h1 className="h-display text-2xl sm:text-3xl">Оформление заказа {props.orderNumber}</h1>

      {/* Карточка заказа */}
      <div className="card mt-6 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌍</span>
          <div>
            <div className="font-semibold">{props.title}</div>
            <div className="text-sm text-muted">
              {dataLabel(props.dataMb)} · {validityLabel(props.validityDays)}
            </div>
          </div>
        </div>
        <div className="text-right">
          {discount > 0 && <div className="text-sm text-muted line-through">${(props.subtotalCents / 100).toFixed(2)}</div>}
          <div className="font-display text-2xl font-bold text-signal">${(total / 100).toFixed(2)}</div>
        </div>
      </div>

      {/* Контакт */}
      <div className="card mt-4 p-5">
        <div className="text-sm font-medium">Получение eSIM</div>
        <p className="mt-1 text-sm text-muted">
          {props.telegramId
            ? <>Telegram ID <code className="rounded bg-raised px-1">{props.telegramId}</code> — выдача в чат бота</>
            : <>Email <code className="rounded bg-raised px-1">{props.email}</code> — ссылка на страницу eSIM</>}
        </p>
      </div>

      {/* Промокод */}
      <div className="card mt-4 p-5">
        <label className="label" htmlFor="promo">Промокод</label>
        <div className="flex gap-2">
          <input
            id="promo"
            className="input uppercase placeholder:normal-case"
            placeholder="Введите код"
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
          />
          <button onClick={applyPromo} disabled={busy} className="btn-secondary shrink-0 px-4">Применить</button>
        </div>
        {promoMsg && <p className={`mt-2 text-sm ${promoMsg.ok ? "text-signal" : "text-danger"}`}>{promoMsg.text}</p>}
      </div>

      {/* Способы оплаты */}
      <div className="card mt-4 p-5">
        <div className="text-sm font-medium">Способ оплаты</div>
        <div className="mt-3 space-y-2">
          {props.methods.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                method === m.id ? "border-signal/60 bg-signal/5" : "border-line bg-raised hover:border-line"
              } ${!m.available ? "pointer-events-none opacity-40" : ""}`}
            >
              <input
                type="radio"
                name="method"
                className="mt-1 accent-[#00E5A0]"
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                disabled={!m.available}
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {m.title}
                  {m.badge && <span className="chip">{m.badge}</span>}
                  {!m.available && <span className="chip">скоро</span>}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{m.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <button onClick={pay} disabled={busy} className="btn-primary mt-6 w-full py-4 text-base">
        {busy ? "Переходим к оплате…" : `Оплатить $${(total / 100).toFixed(2)}`}
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        🔒 eSIM выдаётся только после подтверждённого платежа
      </p>
    </div>
  );
}
