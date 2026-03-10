import { readFile, writeFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";

const getFeedbackPath = () =>
  process.env.VERCEL
    ? path.join(os.tmpdir(), "pdd-feedback.json")
    : path.join(process.cwd(), "data", "feedback.json");

export type FeedbackItem = { id: string; text: string; ts: number };

async function loadItems(): Promise<FeedbackItem[]> {
  try {
    const raw = await readFile(getFeedbackPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function appendFeedback(text: string): Promise<boolean> {
  try {
    const items = await loadItems();
    const item: FeedbackItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      text: String(text || "").trim().slice(0, 2000),
      ts: Date.now(),
    };
    items.push(item);
    const filePath = getFeedbackPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(items), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function getFeedback(): Promise<FeedbackItem[]> {
  return loadItems();
}
