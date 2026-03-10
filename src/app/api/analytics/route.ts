import { NextRequest, NextResponse } from "next/server";
import { getVisits, stats } from "@/lib/analytics";

const getExpected = () => (process.env.ADMIN_PASSWORD ?? "1234").trim();

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pwd = url.searchParams.get("p") ?? request.headers.get("x-admin-password") ?? "";
  const expected = getExpected();
  if (!expected || pwd.trim() !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const visits = await getVisits();
    return NextResponse.json(stats(visits));
  } catch (e) {
    return NextResponse.json(stats([]));
  }
}
