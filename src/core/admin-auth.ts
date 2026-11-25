/** Аутентификация администратора: пароль из env + подписанная HMAC cookie. */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config";
import { audit } from "./db";

const COOKIE = "gd_admin";

function sign(value: string): string {
  return crypto.createHmac("sha256", config.sessionSecret).update(value).digest("hex");
}

export function checkPassword(password: string): boolean {
  if (!config.adminPassword) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(config.adminPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSessionCookieValue(): string {
  const payload = `admin.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionCookieValue(store.get(COOKIE)?.value);
}

export async function login(password: string): Promise<boolean> {
  if (!checkPassword(password)) {
    await audit("admin-login", "login.failed");
    return false;
  }
  const store = await cookies();
  store.set(COOKIE, createSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  await audit("admin", "login.ok");
  return true;
}

export async function logout() {
  const store = await cookies();
  store.delete(COOKIE);
}
