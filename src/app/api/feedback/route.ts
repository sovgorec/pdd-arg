import { NextRequest, NextResponse } from "next/server";
import { appendFeedback, getFeedback } from "@/lib/feedback";

const getExpected = () => (process.env.ADMIN_PASSWORD ?? "1234").trim();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ ok: false }, { status: 400 });
    const ok = await appendFeedback(text);
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pwd = url.searchParams.get("p") ?? request.headers.get("x-admin-password") ?? "";
  const expected = getExpected();
  if (!expected || pwd.trim() !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await getFeedback();
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
