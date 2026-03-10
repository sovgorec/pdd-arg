import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const expected = (process.env.ADMIN_PASSWORD ?? "1234").trim();
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "").trim();
  if (expected && password === expected) {
    const token = createHmac("sha256", expected).update("admin").digest("hex");
    return NextResponse.json({ ok: true, token });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
