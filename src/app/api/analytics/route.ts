import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getVisits, stats } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  const expected = (process.env.ADMIN_PASSWORD ?? "1234").trim();
  const valid = expected && token === createHmac("sha256", expected).update("admin").digest("hex");
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const visits = await getVisits();
  return NextResponse.json(stats(visits));
}
