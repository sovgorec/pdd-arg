import { NextRequest, NextResponse } from "next/server";

const getExpected = () => (process.env.ADMIN_PASSWORD ?? "1234").trim();

export async function POST(request: NextRequest) {
  const expected = getExpected();
  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "").trim();
  if (expected && password === expected) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
