"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuyPanel(props: {
  planId: string;
  title: string;
  emoji: string;
  dataShort: string;
  validShort: string;
  priceCents: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [promo, setPromo] = useState("");
  const [promoState, setPromoState] = useState<{ text: string; ok: boolean } | null>(null);
  const [discountCents, setDiscountCents] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Math.max(0, props.priceCents - discountCents);

  async function checkPromo() {
    if (!promo.trim()) return;
    setBusy(true);
    setPromoState(null);
    try {
      if (!orderId) {
        // Заказ ещё не создан — просто сохраняем код, применится при создании
        setPromoState({ text: "Код сохранён — применится при оформлении", ok: true });
        return;
      }
      const res = await fetch(`/api/orders/${orderId}/promo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo.trim() }),
      });
      const body = await res.json();
      if (body.ok) {
        setDiscountCents(body.discountCents);
        setPromoState({ text: `Промокод применён: −$${(body.discountCents / 100).toFixed(2)}`, ok: true });
      } else {
        setPromoState({ text: body.error, ok: false });
      }
    } catch {
      setPromoState({ text: "Не удалось проверить промокод", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: props.planId,
          email: email.trim(),
          promoCode: promo.trim() || undefined,
          orderId,
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        setError(body.error ?? "Не удалось создать заказ");
        return;
      }
      setOrderId(body.order.id);
      router.push(`/checkout/${body.order.id}`);
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="text-xl">{props.emoji}</span> {props.dataShort} · {props.validShort}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold text-signal">${(total / 100).toFixed(2)}</span>
        {discountCents > 0 && (
          <span className="text-lg text-muted line-through">${(props.priceCents / 100).toFixed(2)}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">Разовый платёж, без подписки</p>

      <div className="mt-5">
        <label className="label" htmlFor="email">Email для получения eSIM</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          className="input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-muted/70">Ссылка на eSIM придёт на этот адрес</p>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="promo">Промокод (необязательно)</label>
        <div className="flex gap-2">
          <input
            id="promo"
            className="input uppercase placeholder:normal-case"
            placeholder="GATETODATA1"
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
          />
          <button type="button" onClick={checkPromo} disabled={busy} className="btn-secondary shrink-0 px-4">
            OK
          </button>
        </div>
        {promoState && (
          <p className={`mt-1.5 text-xs ${promoState.ok ? "text-signal" : "text-danger"}`}>{promoState.text}</p>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <button onClick={submit} disabled={busy || !email.trim()} className="btn-primary mt-5 w-full">
        {busy ? "Оформляем…" : "Перейти к оплате →"}
      </button>

      <ul className="mt-4 space-y-1.5 text-xs text-muted">
        <li>✓ QR-код сразу после оплаты</li>
        <li>✓ Повторный доступ из «Мои заказы»</li>
        <li>✓ Поддержка 24/7 в Telegram</li>
      </ul>
    </div>
  );
}
