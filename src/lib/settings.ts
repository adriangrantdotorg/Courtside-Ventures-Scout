import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type Thesis = { key: string; name: string; weight: number; keywords: string[] };
export type Weights = { thesis: number; stage: number; signal: number; culture: number; team: number; geo: number };

export const DEFAULT_WEIGHTS: Weights = { thesis: 30, stage: 20, signal: 20, culture: 15, team: 10, geo: 5 };

export const DEFAULT_QUERIES = [
  "sports OR fan OR athlete OR league OR NIL OR betting OR fantasy",
  "creator OR streamer OR influencer",
  "gaming OR \"game studio\" OR esports",
  "collectibles OR marketplace OR sneakers OR \"trading cards\"",
  "wellness OR longevity OR peptides OR fitness OR recovery",
  "music OR \"live events\" OR ticketing",
];

export type BuildProgress = {
  step: number;
  name: string;
  startedAt: number;
  stepStartedAt: number;
  updatedAt: number;
  note: string;
  waiting: boolean;
  waitingSince?: number;
  liveUrl: string;
  done: boolean;
  durations: Record<number, number>;
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await db().select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
    if (!rows.length || rows[0].value === null) return fallback;
    return rows[0].value as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  await db()
    .insert(schema.settings)
    .values({ key, value: value === null ? sql`'null'::jsonb` : (value as object), updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: value === null ? sql`'null'::jsonb` : (value as object), updatedAt: new Date() } });
}

export async function getWeights(): Promise<Weights> {
  const w = await getSetting<Partial<Weights> & { lane?: number }>("scoreWeights", DEFAULT_WEIGHTS);
  return { ...DEFAULT_WEIGHTS, ...w, thesis: w.thesis ?? w.lane ?? DEFAULT_WEIGHTS.thesis };
}

export async function getThreshold(): Promise<number> {
  return getSetting<number>("worthThreshold", 45);
}

export async function getThesis(): Promise<Thesis[]> {
  return getSetting<Thesis[]>("lanes", []);
}

export async function extraSourcesOn(): Promise<boolean> {
  return getSetting<boolean>("extraSources", false);
}

export async function sourcesOff(): Promise<string[]> {
  return getSetting<string[]>("sourcesOff", []);
}
