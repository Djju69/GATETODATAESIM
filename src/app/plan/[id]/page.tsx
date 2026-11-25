import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlan } from "@/core/catalog";
import { formatUsd, dataLabel, validityLabel } from "@/core/money";
import { flagEmoji } from "@/core/countries";
import BuyPanel from "@/components/buy-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) return { title: "Тариф" };
  return {
    title: `${plan.title}`,
    description: `${plan.title} — ${dataLabel(plan.data_mb)} на ${validityLabel(plan.validity_days)} за ${formatUsd(plan.retail_cents)}. Мгновенная выдача eSIM.`,
  };
}

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  const emoji = plan.country_code ? flagEmoji(plan.country_code) : plan.kind === "global" ? "🌐" : "🌍";
  const dataShort = dataLabel(plan.data_mb);
  const validShort = validityLabel(plan.validity_days);

  return (
    <div className="section py-10 sm:py-14">
      <Link
        href={plan.kind === "country" ? `/countries/${plan.country_code}` : plan.kind === "region" ? `/regions/${plan.region_slug}` : "/global"}
        className="btn-ghost mb-6 -ml-3"
      >
        ← К каталогу
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Основная информация */}
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{emoji}</span>
            <div>
              <div className="text-sm text-muted">
                {plan.kind === "country" ? "Тариф одной страны" : plan.kind === "region" ? "Региональный тариф" : "Глобальный тариф"}
                {plan.region_name && plan.kind !== "global" && plan.region_name !== plan.country_name_ru ? ` · ${plan.region_name}` : ""}
              </div>
              <h1 className="h-display text-2xl sm:text-3xl">{plan.title}</h1>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { t: "Интернет", v: dataShort },
              { t: "Срок", v: validShort },
              { t: "Сети", v: plan.networks ?? "4G/LTE" },
              { t: "Хотспот", v: plan.hotspot ? "Разрешён" : "По запросу" },
            ].map((s) => (
              <div key={s.t} className="card p-4">
                <div className="text-xs text-muted">{s.t}</div>
                <div className="mt-1 font-semibold">{s.v}</div>
              </div>
            ))}
          </div>

          <div className="card mt-6 p-6">
            <h2 className="font-semibold">Операторы и покрытие</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {plan.operators
                ? `Тариф работает в сетях: ${plan.operators}. Устройство автоматически выберет лучшую доступную сеть.`
                : "Устройство автоматически подключится к сети локального оператора-партнёра. Точные сети станут известны после установки профиля."}
            </p>
            {plan.description && <p className="mt-3 text-sm leading-relaxed text-muted">{plan.description}</p>}
          </div>

          <div className="card mt-4 p-6">
            <h2 className="font-semibold">Условия активации</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li>• Профиль устанавливается по QR-коду (или коду LPA) при Wi-Fi.</li>
              <li>• Срок действия пакета {validShort.toLowerCase()} — обычно отсчёт начинается при первом подключении к сети.</li>
              <li>• Данные работают только за пределами страны проживания (тариф роуминговый).</li>
              <li>• Установленный профиль удалять нельзя — восстановлению он не подлежит.</li>
            </ul>
            {plan.terms && <p className="mt-3 rounded-xl border border-line bg-raised p-3 text-xs leading-relaxed text-muted">{plan.terms}</p>}
          </div>

          <div className="card mt-4 p-6">
            <h2 className="font-semibold">Совместимость</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              iPhone XS и новее, Google Pixel 3+, Samsung Galaxy S20+ и большинство современных
              Android-смартфонов с поддержкой eSIM. Телефон должен быть не привязан к оператору (unlocked).
            </p>
            <Link href="/help#compat" className="btn-ghost mt-2 px-0 text-signal">Проверить устройство →</Link>
          </div>
        </div>

        {/* Панель покупки */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <BuyPanel
            planId={plan.id}
            title={plan.title}
            emoji={emoji}
            dataShort={dataShort}
            validShort={validShort}
            priceCents={plan.retail_cents}
          />
        </aside>
      </div>
    </div>
  );
}
