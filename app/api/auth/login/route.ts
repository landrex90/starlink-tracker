import { NextResponse } from "next/server";
import { createSessionToken, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });
  }

  const valid = await verifyPassword(password);
  if (!valid) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
