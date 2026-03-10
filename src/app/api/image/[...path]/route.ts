import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filename = pathSegments?.join("/") || "";
  if (!filename || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  try {
    const cwd = process.cwd();
    const paths = [
      path.join(cwd, "public", "images", filename),
      path.join(cwd, "images", filename),
    ];
    const imagePath = paths.find((p) => existsSync(p));
    if (!imagePath) throw new Error("Not found");
    const buffer = await readFile(imagePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : "image/png";
    return new NextResponse(buffer, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
