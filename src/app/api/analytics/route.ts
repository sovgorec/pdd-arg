import { NextRequest, NextResponse } from "next/server";
import { getVisits, stats } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const admin = request.cookies.get("admin")?.value;
  if (admin !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const visits = await getVisits();
  return NextResponse.json(stats(visits));
}
