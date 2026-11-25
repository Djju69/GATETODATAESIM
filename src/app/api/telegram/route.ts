/** Webhook Telegram-бота (для Vercel и любого HTTPS-хостинга). */
import { webhookCallback } from "grammy";
import { config } from "@/core/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!config.telegram.botToken) {
    return new Response("TELEGRAM_BOT_TOKEN не настроен", { status: 503 });
  }
  // Динамический импорт: не тянем бота в сборки, где он не нужен
  const { bot } = await import("@/bot/bot");
  const handle = webhookCallback(bot, "std/http", {
    secretToken: config.telegram.webhookSecret || undefined,
  });
  return await handle(req);
}

export async function GET() {
  return Response.json({ ok: true, service: "telegram-webhook" });
}
