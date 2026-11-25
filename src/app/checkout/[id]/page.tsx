import { notFound, redirect } from "next/navigation";
import { getOrder } from "@/core/orders";
import { config } from "@/core/config";
import CheckoutClient from "./checkout-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Оформление заказа" };

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  if (["PAID", "PROVISIONING", "DELIVERED"].includes(order.status)) {
    redirect(`/esim/${order.delivery_token}`);
  }
  if (["CANCELLED", "EXPIRED"].includes(order.status)) {
    return (
      <div className="section py-20 text-center">
        <div className="text-4xl">✖️</div>
        <h1 className="mt-4 text-2xl font-semibold">Заказ отменён</h1>
        <p className="mt-2 text-sm text-muted">Оформите заказ заново — каталог всегда актуален.</p>
        <a href="/countries" className="btn-primary mt-6 inline-flex">Выбрать eSIM</a>
      </div>
    );
  }

  const snapshot = JSON.parse(order.plan_snapshot) as {
    title: string; dataMb: number; validityDays: number; operators: string | null;
  };

  const methods: Array<{ id: "stars" | "usdt"; title: string; desc: string; available: boolean; badge?: string }> = [
    {
      id: "stars",
      title: "Telegram Stars",
      desc: "Оплата в Telegram через бота. После оплаты eSIM придёт в чат автоматически.",
      available: config.starsEnabled && !!config.telegram.botToken,
      badge: "Быстро",
    },
    {
      id: "usdt",
      title: "USDT (TRC-20)",
      desc: "Перевод в сети TRON на счёт магазина. Подтверждение 1–3 минуты.",
      available: !!config.usdt.wallet,
      badge: "Без карт",
    },
  ];

  return (
    <CheckoutClient
      orderId={order.id}
      orderNumber={order.number}
      title={snapshot.title}
      dataMb={snapshot.dataMb}
      validityDays={snapshot.validityDays}
      email={order.email ?? ""}
      telegramId={order.telegram_id}
      subtotalCents={order.subtotal_cents}
      discountCents={order.discount_cents}
      promoCode={order.promo_code}
      methods={methods}
    />
  );
}
