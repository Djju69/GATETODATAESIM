import Link from "next/link";
import { botUrl } from "@/core/config";

export const metadata = {
  title: "Помощь — установка, совместимость, FAQ",
  description: "Как установить eSIM на iPhone и Android, совместимость устройств, ответы на частые вопросы.",
};

const COMPAT = [
  { brand: "Apple iPhone", models: "XS, XR, 11, 12, 13, 14, 15, 16 (включая SE 2020+)", ok: true },
  { brand: "Apple iPad", models: "Air 3+, Pro 2018+ (Wi-Fi + Cellular)", ok: true },
  { brand: "Google Pixel", models: "3, 3a, 4, 5, 6, 7, 8, 9 (не Enterprise-версии)", ok: true },
  { brand: "Samsung Galaxy", models: "S20+, S21, S22, S23, S24, Z Flip / Fold, A54 5G", ok: true },
  { brand: "Huawei", models: "P40, P40 Pro, Mate 40 Pro (без Google-сервисов — ограничения)", ok: "partial" as const },
  { brand: "Xiaomi / Redmi", models: "12T Pro, 13, 14 (проверьте регион), POCO F5", ok: "partial" as const },
  { brand: "OPPO / OnePlus", models: "Find X3+, 11/12 (проверьте регион)", ok: "partial" as const },
  { brand: "Устройства без eSIM", models: "Большинство моделей до 2019 г., часть бюджетных Android", ok: false },
];

const FAQ = [
  {
    q: "Что такое eSIM и чем она лучше обычной SIM?",
    a: "eSIM — цифровой аналог SIM-карты, встроенный в ваш телефон. Не нужен пластик, не нужно ходить в салон: профиль загружается по QR-коду за пару минут. Данные работают сразу по прибытии — без дорогого роуминга.",
  },
  {
    q: "Когда начинается срок действия пакета?",
    a: "У большинства тарифов отсчёт начинается при первом подключении eSIM к сети оператора. Рекомендуем установить профиль дома по Wi-Fi — активация произойдёт автоматически в стране назначения.",
  },
  {
    q: "Как я получу eSIM после оплаты?",
    a: "Сразу после подтверждения платежа: на сайте откроется страница выдачи с QR-кодом, а при оплате через Telegram eSIM придёт прямо в чат бота. Доступ к странице сохраняется по ссылке — сохраните её.",
  },
  {
    q: "Что делать, если не получается установить?",
    a: "Убедитесь, что телефон подключён к Wi-Fi, и попробуйте установку кодом вручную вместо QR. Не получается — напишите в поддержку Telegram-бота, поможем активировать.",
  },
  {
    q: "Можно ли раздавать интернет на другие устройства?",
    a: "На большинстве тарифов хотспот разрешён. Условия конкретного пакета указаны на его странице.",
  },
  {
    q: "Пакет закончился — можно продлить?",
    a: "Профиль можно пополнить, если поставщик поддерживает продление для тарифа (см. условия на странице тарифа), либо просто купить новый пакет — для второго заказа у нас есть промокоды для постоянных клиентов.",
  },
  {
    q: "Как вернуть деньги?",
    a: "Если eSIM не активировалась по вине поставщика или несовместимости, о которой мы не предупредили, — вернём деньги. Профиль установлен и активирован? Возврат по неиспользованному остатку не предусмотрен (условия поставщика).",
  },
  {
    q: "Работает ли тариф в моей стране проживания?",
    a: "Тарифы предназначены для использования за рубежом. В стране покупки данные обычно не работают — это ограничение роуминговых тарифов у всех провайдеров.",
  },
];

export default function HelpPage() {
  return (
    <div className="section max-w-4xl py-10 sm:py-14">
      <h1 className="h-display text-3xl sm:text-4xl">Помощь</h1>
      <p className="mt-2 text-sm text-muted sm:text-base">
        Установка, совместимость и ответы на частые вопросы.
      </p>

      {/* Установка */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <div className="text-2xl"> iPhone</div>
          <h2 className="mt-2 font-display text-lg font-semibold">Установка на iPhone</h2>
          <ol className="mt-4 ml-4 list-decimal space-y-2 text-sm leading-relaxed text-muted">
            <li>Подключитесь к Wi-Fi.</li>
            <li>Настройки → Сотовая связь → <b className="text-fg">Добавить eSIM</b>.</li>
            <li>Сканируйте QR-код со страницы выдачи.</li>
            <li>Включите «Данные сотовой сети» для eSIM.</li>
            <li>В поездке включите «Роуминг данных».</li>
          </ol>
        </div>
        <div className="card p-6">
          <div className="text-2xl">🤖</div>
          <h2 className="mt-2 font-display text-lg font-semibold">Установка на Android</h2>
          <ol className="mt-4 ml-4 list-decimal space-y-2 text-sm leading-relaxed text-muted">
            <li>Подключитесь к Wi-Fi.</li>
            <li>Настройки → Сеть и интернет → SIM-карты.</li>
            <li><b className="text-fg">Добавить eSIM</b> → сканируйте QR.</li>
            <li>Включите мобильные данные для eSIM.</li>
            <li>В поездке включите роуминг данных.</li>
          </ol>
        </div>
      </div>

      {/* Совместимость */}
      <div id="compat" className="scroll-mt-24">
        <h2 className="h-display mt-14 text-2xl sm:text-3xl">Совместимость устройств</h2>
        <p className="mt-2 text-sm text-muted">
          Проверьте до покупки: Настройки → о телефоне → есть ли пункт «Добавить eSIM».
          Телефон должен быть не привязан к оператору (unlocked).
        </p>
        <div className="card mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {COMPAT.map((row, i) => (
                <tr key={row.brand} className={i % 2 ? "bg-raised/40" : ""}>
                  <td className="px-4 py-3 font-medium">{row.brand}</td>
                  <td className="px-4 py-3 text-muted">{row.models}</td>
                  <td className="px-4 py-3 text-right">
                    {row.ok === true && <span className="chip chip-active">✓ поддерживается</span>}
                    {row.ok === "partial" && <span className="chip">◐ частично</span>}
                    {row.ok === false && <span className="chip">✖ нет</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <h2 className="h-display mt-14 text-2xl sm:text-3xl">Частые вопросы</h2>
      <div className="mt-6 space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="card group p-5">
            <summary className="cursor-pointer list-none font-medium">
              <span className="text-signal mr-2 inline-block transition group-open:rotate-90">▸</span>
              {f.q}
            </summary>
            <p className="mt-3 pl-5 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>

      {/* Контакты */}
      <div className="card mt-12 p-6 text-center sm:p-8">
        <h2 className="font-display text-xl font-semibold">Не нашли ответ?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Напишите в поддержку — отвечаем обычно за 15–30 минут, в любое время суток.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href={botUrl()} target="_blank" rel="noopener" className="btn-primary btn-sm">
            💬 Telegram-бот
          </a>
          <a href="mailto:support@gatetodata.com" className="btn-secondary btn-sm">
            ✉️ support@gatetodata.com
          </a>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/countries" className="btn-primary">Выбрать eSIM</Link>
      </div>
    </div>
  );
}
