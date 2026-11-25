import { NextResponse } from "next/server";
import { logout } from "@/core/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await logout();
  return NextResponse.redirect(new URL("/admin", req.url));
}
