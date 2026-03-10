import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "feedback.json");

export type FeedbackItem = { id: string; text: string; ts: number };

async function ensureFile(): Promise<FeedbackItem[]> {
  try {
    const raw = await readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function appendFeedback(text: string): Promise<boolean> {
  try {
    const items = await ensureFile();
    const item: FeedbackItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      text: String(text || "").trim().slice(0, 2000),
      ts: Date.now(),
    };
    items.push(item);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify(items), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function getFeedback(): Promise<FeedbackItem[]> {
  try {
    const raw = await readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
