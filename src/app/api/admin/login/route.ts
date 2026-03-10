import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const password = body.password as string;
  if (password === ADMIN_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin", "1", {
      path: "/",
      maxAge: 60 * 60 * 24, // 24h
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
