import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const expected = (process.env.ADMIN_PASSWORD ?? "1234").trim();
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "").trim();
  if (expected && password === expected) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin", "1", {
      path: "/",
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
