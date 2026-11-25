"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UsdtClient(props: {
  orderId: string;
  orderNumber: string;
  title: string;
  address: string;
  amount: string;
  network: string;
  expiresAt: string;
  qrSvg: string;
  botUsername: string;
  token: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(props.expiresAt).getTime() - Date.now()) / 1000))
  );
  const [paid, setPaid] = useState(false);
  const [txId, setTxId] = useState("");
  const [txBusy, setTxBusy] = useState(false);
  const [txMsg, setTxMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function checkTx() {
    if (!txId.trim()) return;
    setTxBusy(true);
    setTxMsg(null);
    try {
      const res = await fetch(`/api/orders/${props.orderId}/usdt-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: txId.trim() }),
      });
      const body = await res.json();
      if (body.ok && body.deliveryToken) {
        setTxMsg({ text: "Платёж подтверждён! Открываем eSIM…", ok: true });
        setPaid(true);
        setTimeout(() => router.push(`/esim/${body.deliveryToken}`), 1200);
      } else if (body.ok) {
        setTxMsg({ text: body.error ?? `Оплата подтверждена, статус: ${body.status}`, ok: true });
      } else {
        setTxMsg({ text: body.error ?? "Не удалось проверить транзакцию", ok: false });
      }
    } catch {
      setTxMsg({ text: "Ошибка сети — попробуйте ещё раз", ok: false });
    } finally {
      setTxBusy(false);
    }
  }

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${props.orderId}/status`, { cache: "no-store" });
        const body = await res.json();
        if (body.status && body.status !== "AWAITING_PAYMENT") {
          setPaid(true);
          clearInterval(poll);
          setTimeout(() => router.push(`/esim/${props.token}`), 1200);
        }
      } catch {
        /* продолжаем поллинг */
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [props.orderId, props.token, router]);

  async function copy(text: string, what: "address" | "amount") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* noop */ }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="section max-w-2xl py-10 sm:py-14">
      <h1 className="h-display text-2xl sm:text-3xl">Оплата USDT · {props.orderNumber}</h1>
      <p className="mt-2 text-sm text-muted">{props.title}</p>

      {paid ? (
        <div className="card mt-8 p-10 text-center">
          <div className="text-4xl">✅</div>
          <div className="mt-3 font-display text-xl font-semibold">Платёж подтверждён!</div>
          <p className="mt-2 text-sm text-muted">Выдаём eSIM — пару секунд…</p>
        </div>
      ) : (
        <>
          <div className="card mt-8 overflow-hidden">
            <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start sm:p-8">
              <div
                className="w-44 shrink-0 [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: props.qrSvg }}
              />
              <div className="w-full space-y-4">
                <div>
                  <div className="text-xs text-muted">Сумма к переводу (точно)</div>
                  <button
                    onClick={() => copy(props.amount, "amount")}
                    className="mt-1 flex w-full items-center justify-between rounded-xl border border-line bg-raised px-4 py-3 text-left transition hover:border-signal/50"
                  >
                    <span className="font-display text-2xl font-bold text-signal">{props.amount} USDT</span>
                    <span className="text-xs text-muted">{copied === "amount" ? "✓ Скопировано" : "Копировать"}</span>
                  </button>
                </div>
                <div>
                  <div className="text-xs text-muted">Кошелёк ({props.network})</div>
                  <button
                    onClick={() => copy(props.address, "address")}
                    className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-raised px-4 py-3 text-left transition hover:border-signal/50"
                  >
                    <span className="break-all text-sm">{props.address}</span>
                    <span className="shrink-0 text-xs text-muted">{copied === "address" ? "✓" : "Копировать"}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="border-t border-line/60 bg-raised/50 px-6 py-4 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">Счёт действует ещё</span>
                <span className={`font-mono text-lg font-bold ${secondsLeft < 300 ? "text-warn" : "text-fg"}`}>
                  {mm}:{ss}
                </span>
              </div>
            </div>
          </div>

          <div className="card mt-4 p-5 text-sm leading-relaxed text-muted">
            <div className="mb-2 font-medium text-fg">Инструкция</div>
            <ol className="ml-4 list-decimal space-y-1.5">
              <li>Откройте кошелёк (Trust Wallet, Tonkeeper для TON, любой TRC-20 кошелёк).</li>
              <li>Переведите <b className="text-fg">ровно {props.amount} USDT</b> на адрес выше в сети {props.network}.</li>
              <li>Скопируйте хеш транзакции (TxID) и вставьте ниже — eSIM откроется сразу.</li>
              <li>Или просто подождите 1–3 минуты — статус обновится автоматически.</li>
            </ol>
            <p className="mt-3 rounded-xl border border-warn/30 bg-warn/5 p-3 text-xs text-warn">
              ⚠️ Переводите только USDT в сети {props.network}. Сумма должна совпасть точно.
            </p>
          </div>

          {/* Быстрая проверка по хешу */}
          <div className="card mt-4 p-5">
            <label className="label" htmlFor="txid">Оплатили? Вставьте хеш транзакции (TxID)</label>
            <div className="flex gap-2">
              <input
                id="txid"
                className="input font-mono text-sm placeholder:text-muted/50"
                placeholder="64 HEX-символа из истории кошелька"
                value={txId}
                onChange={(e) => setTxId(e.target.value.trim())}
                spellCheck={false}
              />
              <button onClick={checkTx} disabled={txBusy || txId.length < 10} className="btn-primary shrink-0 px-5">
                {txBusy ? "Проверяем…" : "Проверить"}
              </button>
            </div>
            {txMsg && <p className={`mt-2 text-sm ${txMsg.ok ? "text-signal" : "text-danger"}`}>{txMsg.text}</p>}
          </div>

          <div className="mt-6 text-center text-sm text-muted">
            Оплачено, но статус не изменился?{" "}
            <a href="/help" className="text-signal hover:underline">Напишите в поддержку</a>
          </div>
        </>
      )}
    </div>
  );
}
