"use client";

import { useState } from "react";

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* noop */ }
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-left transition hover:border-signal/50"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className={`block break-all text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
      </span>
      <span className="shrink-0 text-xs text-muted">{copied ? "✓ Скопировано" : "Копировать"}</span>
    </button>
  );
}

export default function EsimClient(props: {
  status: string;
  number: string;
  title: string;
  dataShort: string;
  validShort: string;
  iccid: string | null;
  lpa: string | null;
  qrSvg: string | null;
  activationUrl: string | null;
  expiresAt: string | null;
  supportUrl: string;
}) {
  const [tab, setTab] = useState<"ios" | "android">("ios");

  if (props.status !== "DELIVERED" && props.status !== "PROVISIONING") {
    return (
      <div className="section max-w-2xl py-16 text-center">
        <div className="text-4xl">⏳</div>
        <h1 className="mt-4 text-2xl font-semibold">Заказ {props.number}</h1>
        <p className="mt-2 text-sm text-muted">
          {props.status === "AWAITING_PAYMENT"
            ? "Заказ ещё не оплачен. Завершите оплату, чтобы получить eSIM."
            : props.status === "FAILED"
              ? "Произошла ошибка выдачи — поддержка уже занимается заказом. Напишите нам, ускорим решение."
              : "Статус: " + props.status}
        </p>
        <a href="/help" className="btn-secondary mt-6 inline-flex">Написать в поддержку</a>
      </div>
    );
  }

  return (
    <div className="section max-w-3xl py-10 sm:py-14">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-signal/10 px-4 py-1.5 text-sm text-signal">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-signal" />
          {props.status === "PROVISIONING" ? "Выдаём eSIM…" : "eSIM готова к установке"}
        </div>
        <h1 className="h-display mt-4 text-3xl sm:text-4xl">Ваша eSIM</h1>
        <p className="mt-2 text-sm text-muted">
          {props.title} · {props.dataShort} · {props.validShort} · заказ {props.number}
        </p>
      </div>

      {/* QR и данные */}
      {props.qrSvg ? (
        <div className="card mt-8 overflow-hidden">
          <div className="grid gap-6 p-6 sm:grid-cols-[220px_1fr] sm:p-8">
            <div className="mx-auto w-56 rounded-2xl bg-white p-3 [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: props.qrSvg }} />
            <div className="space-y-3">
              <div className="text-sm font-medium">Данные для установки</div>
              {props.iccid && <CopyRow label="ICCID" value={props.iccid} />}
              {props.lpa && <CopyRow label="Код активации (SM-DP+ адрес)" value={props.lpa} />}
              <p className="text-xs leading-relaxed text-muted">
                Отсканируйте QR камерой телефона — или используйте код для ручной установки.
                Устанавливайте eSIM при устойчивом Wi-Fi.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mt-8 p-6 text-center text-sm text-muted">
          QR-код появится здесь через несколько секунд. Обновите страницу.
        </div>
      )}

      {/* Инструкции */}
      <div className="card mt-4 p-6">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("ios")}
            className={`btn btn-sm flex-1 ${tab === "ios" ? "bg-signal text-ink" : "border border-line bg-raised text-muted"}`}
          >
             iPhone
          </button>
          <button
            onClick={() => setTab("android")}
            className={`btn btn-sm flex-1 ${tab === "android" ? "bg-signal text-ink" : "border border-line bg-raised text-muted"}`}
          >
            🤖 Android
          </button>
        </div>
        <ol className="mt-5 ml-4 list-decimal space-y-2 text-sm leading-relaxed text-muted">
          {tab === "ios" ? (
            <>
              <li>Подключитесь к Wi-Fi и откройте <b className="text-fg">Настройки → Сотовая связь</b>.</li>
              <li>Нажмите <b className="text-fg">Добавить eSIM</b> → «Использовать QR-код».</li>
              <li>Отсканируйте QR-код выше (или введите код вручную).</li>
              <li>После загрузки профиля включите <b className="text-fg">«Данные сотовой сети»</b> для новой eSIM.</li>
              <li>В поездке включите <b className="text-fg">«Роуминг данных»</b> — тариф уже включает его, плата за роуминг не списывается.</li>
            </>
          ) : (
            <>
              <li>Подключитесь к Wi-Fi и откройте <b className="text-fg">Настройки → Сеть и интернет → SIM-карты</b>.</li>
              <li>Выберите <b className="text-fg">Добавить eSIM / Скачать SIM</b>.</li>
              <li>Отсканируйте QR-код или выберите «Ввести вручную» и вставьте код выше.</li>
              <li>Дождитесь загрузки профиля и включите <b className="text-fg">мобильные данные</b> для eSIM.</li>
              <li>В поездке включите <b className="text-fg">роуминг данных</b> — он уже включён в тариф.</li>
            </>
          )}
        </ol>
      </div>

      {/* Важно */}
      <div className="card mt-4 border-warn/30 bg-warn/5 p-5 text-sm leading-relaxed">
        <div className="font-medium text-warn">Важная информация</div>
        <ul className="mt-2 space-y-1.5 text-muted">
          <li>• Не удаляйте установленный профиль eSIM — восстановить его нельзя.</li>
          <li>• Устанавливайте eSIM до вылета, при устойчивом интернете.</li>
          <li>• Телефон должен поддерживать eSIM и не быть привязан к оператору.</li>
          {props.expiresAt && <li>• Срок действия пакета истекает: {new Date(props.expiresAt).toLocaleString("ru-RU")}</li>}
        </ul>
      </div>

      {/* Поддержка */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a href={props.supportUrl} target="_blank" rel="noopener" className="btn-secondary btn-sm">
          💬 Поддержка в Telegram
        </a>
        <a href={`mailto:support@gatetodata.com?subject=Заказ ${props.number}`} className="btn-ghost">
          support@gatetodata.com
        </a>
      </div>
      <p className="mt-4 text-center text-xs text-muted/70">
        Сохраните эту страницу в закладки — доступ к eSIM сохраняется по ссылке.
      </p>
    </div>
  );
}
