import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getOrderByDeliveryToken } from "@/core/orders";
import { dataLabel, validityLabel } from "@/core/money";
import { botUrl } from "@/core/config";
import EsimClient from "./esim-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ваша eSIM" };

export default async function EsimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByDeliveryToken(token);
  if (!order) notFound();

  const snapshot = JSON.parse(order.plan_snapshot) as { title: string; dataMb: number; validityDays: number };
  const awaiting = !["DELIVERED", "PROVISIONING"].includes(order.status);

  let qrSvg: string | null = null;
  if (order.esim_lpa) {
    qrSvg = await QRCode.toString(order.esim_lpa, { type: "svg", margin: 1, color: { dark: "#0B0F14", light: "#FFFFFF" } });
  }

  return (
    <EsimClient
      status={order.status}
      number={order.number}
      title={snapshot.title}
      dataShort={dataLabel(snapshot.dataMb)}
      validShort={validityLabel(snapshot.validityDays)}
      iccid={order.esim_iccid}
      lpa={order.esim_lpa}
      qrSvg={qrSvg}
      activationUrl={order.esim_activation_url}
      expiresAt={order.esim_expires_at}
      supportUrl={botUrl()}
    />
  );
}
