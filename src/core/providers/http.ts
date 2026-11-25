/** HTTP-клиент для провайдеров с таймаутом и нормальными ошибками. */
import { config } from "../config";
import { ProviderError } from "./types";

export async function apiRequest<T>(
  providerId: string,
  operation: string,
  url: string,
  init: RequestInit & { apiKey: string }
): Promise<T> {
  const { apiKey, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.telmo.timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(rest.headers as Record<string, string> | undefined),
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      throw new ProviderError(
        `HTTP ${res.status} на ${operation}`,
        operation,
        res.status,
        body
      );
    }
    return body as T;
  } catch (e: unknown) {
    if (e instanceof ProviderError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new ProviderError(`Сеть/таймаут: ${msg}`, operation, undefined, null);
  } finally {
    clearTimeout(timer);
  }
}
