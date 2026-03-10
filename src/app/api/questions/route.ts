import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET() {
  try {
    const cwd = process.cwd();
    const paths = [
      path.join(cwd, "public", "data", "questions.json"),
      path.join(cwd, "data", "questions.json"),
    ];
    const dataPath = paths.find((p) => existsSync(p)) || paths[0];
    const data = await readFile(dataPath, "utf-8");
    const questions = JSON.parse(data);
    return NextResponse.json(questions);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Файл questions.json не найден. Запустите парсер: python parser/parse_pdf.py" },
      { status: 500 }
    );
  }
}
