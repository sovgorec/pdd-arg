import { NextRequest, NextResponse } from "next/server";
import { appendVisit } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = (body.sessionId as string) || "unknown";
    await appendVisit({ sessionId, ts: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
