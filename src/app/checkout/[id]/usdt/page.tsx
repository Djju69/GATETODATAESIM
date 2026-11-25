import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getOrder } from "@/core/orders";
import { createUsdtInvoice } from "@/core/payments/usdt";
import { config } from "@/core/config";
import UsdtClient from "./usdt-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Оплата USDT" };

export default async function UsdtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  if (!["AWAITING_PAYMENT"].includes(order.status)) {
    redirect(`/esim/${order.delivery_token}`);
  }
  const inv = createUsdtInvoice(order);
  // tron: адрес?amount=...  (глубокая ссылка для кошельков)
  const payLink = `tron:${inv.address}?amount=${inv.amount}`;
  const qrSvg = await QRCode.toString(payLink, { type: "svg", margin: 1, color: { dark: "#0B0F14", light: "#FFFFFF" } });

  return (
    <UsdtClient
      orderId={order.id}
      orderNumber={order.number}
      title={(JSON.parse(order.plan_snapshot) as { title: string }).title}
      address={inv.address}
      amount={inv.amount}
      network={inv.network}
      expiresAt={inv.expiresAt}
      qrSvg={qrSvg}
      botUsername={config.telegram.botUsername}
      token={order.delivery_token}
    />
  );
}
