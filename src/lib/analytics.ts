import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "analytics.json");

export type Visit = { sessionId: string; ts: number };

async function ensureFile(): Promise<Visit[]> {
  try {
    const raw = await readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function appendVisit(v: Visit): Promise<void> {
  try {
    const visits = await ensureFile();
    visits.push(v);
    await writeFile(FILE, JSON.stringify(visits), "utf-8");
  } catch {
    // Vercel: read-only fs, skip
  }
}

export async function getVisits(): Promise<Visit[]> {
  return ensureFile();
}

export function stats(visits: Visit[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const todayStart = now - (now % day);
  const weekStart = todayStart - 7 * day;
  const monthStart = todayStart - 30 * day;

  const today = visits.filter((v) => v.ts >= todayStart);
  const week = visits.filter((v) => v.ts >= weekStart);
  const month = visits.filter((v) => v.ts >= monthStart);

  const uniq = (arr: Visit[]) => new Set(arr.map((v) => v.sessionId)).size;

  return {
    total: visits.length,
    uniqueTotal: uniq(visits),
    today: { visits: today.length, unique: uniq(today) },
    week: { visits: week.length, unique: uniq(week) },
    month: { visits: month.length, unique: uniq(month) },
  };
}
