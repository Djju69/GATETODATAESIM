import Link from "next/link";
import { popularCountries, popularPlans, listRegions, listGlobalPlans, catalogIsEmpty } from "@/core/catalog";
import { getSetting } from "@/core/db";
import { botUrl } from "@/core/config";
import { formatUsdCompact } from "@/core/money";
import { flagEmoji } from "@/core/countries";
import { CountryCard, PlanCard } from "@/components/cards";
import CountrySearch from "@/components/country-search";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [empty, isDemo, topCountries, plans, regions, global] = await Promise.all([
    catalogIsEmpty(),
    getSetting("demo_mode"),
    popularCountries(8),
    popularPlans(6),
    listRegions(),
    listGlobalPlans(),
  ]);
  const demo = isDemo === "1";
  const topSlice = topCountries.slice(0, 8);
  const regionsSlice = regions.slice(0, 6);
  const globalSlice = global.slice(0, 3);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="section relative pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="chip mx-auto animate-rise">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-signal" />
            Работает в 200+ странах · активация за 2 минуты
          </div>
          <h1 className="h-display mt-6 text-4xl leading-[1.08] sm:text-6xl">
            Интернет в поездке — <span className="text-signal">за пару минут</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            GATETODATA eSIM — цифровой туристический интернет без роуминга, без физических SIM-карт
            и без контрактов. Выберите страну, оплатите — QR-код придёт мгновенно.
          </p>
          <div className="mt-8">
            <CountrySearch />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
            <span>Популярно:</span>
            {topSlice.slice(0, 5).map((c) => (
              <Link key={c.code} href={`/countries/${c.code}`} className="chip transition hover:border-signal/50 hover:text-fg">
                {flagEmoji(c.code)} {c.name_ru}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {demo && (
        <section className="section mt-10">
          <div className="card border-warn/40 bg-warn/5 p-4 text-sm">
            🧪 <b className="text-warn">Демо-режим:</b> цены условные, для проверки интерфейса.
            После настройки ключа TELMO запустите <code className="rounded bg-raised px-1.5 py-0.5">npm run sync</code>,
            затем <code className="rounded bg-raised px-1.5 py-0.5">npm run seed-demo -- --off</code>.
          </div>
        </section>
      )}

      {empty && (
        <section className="section mt-10">
          <div className="card border-warn/40 bg-warn/5 p-5 text-sm">
            ⚠️ Каталог ещё не синхронизирован с поставщиком. Запустите{" "}
            <code className="rounded bg-raised px-1.5 py-0.5">npm run sync</code> (нужен TELMO_API_KEY в .env)
            или демо-наполнение <code className="rounded bg-raised px-1.5 py-0.5">npm run seed-demo</code>.
          </div>
        </section>
      )}

      {/* ---------- ПОПУЛЯРНЫЕ НАПРАВЛЕНИЯ ---------- */}
      {topSlice.length > 0 && (
        <section className="section mt-20">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="h-display text-2xl sm:text-3xl">Популярные направления</h2>
              <p className="mt-1 text-sm text-muted">Проверенные маршруты наших путешественников</p>
            </div>
            <Link href="/countries" className="btn-ghost hidden sm:inline-flex">Все страны →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topSlice.map((c) => (
              <CountryCard key={c.code} code={c.code} nameRu={c.name_ru} minPriceCents={c.min_price_cents} plansCount={c.plans_count} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- ТАРИФЫ ---------- */}
      {plans.length > 0 && (
        <section className="section mt-16">
          <div className="mb-6">
            <h2 className="h-display text-2xl sm:text-3xl">Тарифы недели</h2>
            <p className="mt-1 text-sm text-muted">Реальные пакеты и цены из каталога поставщика</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                id={p.id}
                title={p.title}
                dataMb={p.data_mb}
                validityDays={p.validity_days}
                retailCents={p.retail_cents}
                countryCode={p.country_code}
                operators={p.operators}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------- РЕГИОНЫ ---------- */}
      {regionsSlice.length > 0 && (
        <section className="section mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="h-display text-2xl sm:text-3xl">Путешествуете по нескольким странам?</h2>
              <p className="mt-1 text-sm text-muted">Региональный пакет работает во всех странах региона</p>
            </div>
            <Link href="/regions" className="btn-ghost hidden sm:inline-flex">Все регионы →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regionsSlice.map((r) => (
              <Link
                key={r.slug}
                href={`/regions/${r.slug}`}
                className="card group flex items-center justify-between p-5 transition hover:border-signal/50"
              >
                <div>
                  <div className="font-semibold">{r.name_ru}</div>
                  <div className="mt-0.5 text-xs text-muted">{r.plans_count} пакетов</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-signal">от {formatUsdCompact(r.min_price_cents)}</div>
                  <div className="text-[11px] text-muted">за пакет</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- КАК РАБОТАЕТ ---------- */}
      <section className="section mt-24">
        <h2 className="h-display text-center text-2xl sm:text-3xl">Как работает eSIM</h2>
        <p className="mt-2 text-center text-sm text-muted">Четыре шага — и вы онлайн в любой точке мира</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", t: "Выберите страну", d: "Поиск по 200+ странам и регионам, реальные цены без наценок в карточке." },
            { n: "02", t: "Оплатите", d: "Telegram Stars или USDT — eSIM выдаётся только после подтверждённого платежа." },
            { n: "03", t: "Отсканируйте QR", d: "QR-код и код для ручной установки придут на страницу выдачи и в Telegram." },
            { n: "04", t: "Вы онлайн", d: "Пакет активируется при подключении к сети. Без роуминга и контрактов." },
          ].map((s) => (
            <div key={s.n} className="card p-6">
              <div className="font-display text-sm font-bold text-signal">{s.n}</div>
              <div className="mt-3 font-semibold">{s.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- ПРЕИМУЩЕСТВА ---------- */}
      <section className="section mt-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "⚡️", t: "Мгновенная выдача", d: "QR-код приходит сразу после оплаты — на сайте и в Telegram." },
            { icon: "🌐", t: "200+ стран", d: "Один магазин для всех ваших поездок: от Тбилиси до Токио." },
            { icon: "🛟", t: "Поддержка 24/7", d: "Отвечаем в Telegram обычно за 15–30 минут, на любом этапе." },
            { icon: "🔒", t: "Безопасно", d: "Оплата защищена, eSIM выдаётся только после подтверждения платежа." },
          ].map((f) => (
            <div key={f.t} className="card p-6">
              <div className="text-2xl">{f.icon}</div>
              <div className="mt-3 font-semibold">{f.t}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- УСТРОЙСТВА ---------- */}
      <section className="section mt-20">
        <div className="card grid gap-8 p-8 lg:grid-cols-2 lg:p-10">
          <div>
            <h2 className="h-display text-2xl">Совместимые устройства</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              eSIM поддерживают iPhone XS и новее, Google Pixel 3+, Samsung Galaxy S20+,
              большинство современных смартфонов. Телефон должен быть разлочен.
            </p>
            <Link href="/help#compat" className="btn-secondary btn-sm mt-5">Полный список</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              [" iPhone", "XS / 11 / 12 / 13 / 14 / 15 / 16"],
              [" Pixel", "3 / 4 / 5 / 6 / 7 / 8 / 9"],
              ["Samsung", "S20 / S21 / S22 / S23 / S24 / Flip, Fold"],
              ["Huawei", "P40 / Mate 40 (частично)"],
            ].map(([brand, models]) => (
              <div key={brand} className="rounded-xl border border-line bg-raised p-4">
                <div className="font-semibold">{brand}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted">{models}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- ГЛОБАЛЬНЫЕ ---------- */}
      {globalSlice.length > 0 && (
        <section className="section mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="h-display text-2xl sm:text-3xl">Пакет «Весь мир»</h2>
              <p className="mt-1 text-sm text-muted">Для сложных маршрутов и транзитов</p>
            </div>
            <Link href="/global" className="btn-ghost hidden sm:inline-flex">Все пакеты →</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {globalSlice.map((p) => (
              <PlanCard key={p.id} id={p.id} title={p.title} dataMb={p.data_mb} validityDays={p.validity_days} retailCents={p.retail_cents} countryCode={p.country_code} compact />
            ))}
          </div>
        </section>
      )}

      {/* ---------- FAQ ---------- */}
      <section className="section mt-20">
        <h2 className="h-display text-2xl sm:text-3xl">Частые вопросы</h2>
        <div className="mt-8 space-y-3">
          {[
            { q: "Что такое eSIM?", a: "Цифровая SIM-карта, встроенная в телефон. Не нужен пластик — профиль загружается по QR-коду." },
            { q: "Когда активируется пакет?", a: "Срок действия обычно начинается при первом подключении к сети оператора — установите eSIM дома по Wi-Fi, активируется уже в поездке." },
            { q: "Как получить eSIM после оплаты?", a: "Сразу: на странице выдачи (ссылка придёт на email) и в Telegram-боте, если оформляли там." },
            { q: "Что если телефон не поддерживает eSIM?", a: "Проверьте совместимость до оплаты в разделе «Помощь». На устройствах без eSIM профиль установить нельзя." },
            { q: "Можно ли раздавать интернет?", a: "На большинстве тарифов хотспот разрешён. Условия конкретного пакета — на его странице." },
          ].map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="cursor-pointer list-none font-medium">
                <span className="text-signal mr-2 transition group-open:rotate-90 inline-block">▸</span>
                {f.q}
              </summary>
              <p className="mt-3 pl-5 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/help" className="btn-secondary btn-sm">Все вопросы и ответы</Link>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="section mt-20">
        <div className="card relative overflow-hidden p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_50%_-50%,rgba(0,229,160,.15),transparent)]" />
          <h2 className="h-display text-2xl sm:text-4xl">Готовы остаться на связи?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted sm:text-base">
            Выберите страну — и eSIM уже через две минуты будет на вашем телефоне.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/countries" className="btn-primary">Выбрать eSIM</Link>
            <a href={botUrl()} target="_blank" rel="noopener" className="btn-secondary">
              Купить в Telegram
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
