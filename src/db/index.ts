import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

let cached: DB | null = null;

// Tests set globalThis.__scoutTestDb to a PGlite drizzle instance with the same schema.
export function db(): DB {
  const g = globalThis as { __scoutTestDb?: unknown };
  if (g.__scoutTestDb) return g.__scoutTestDb as DB;
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export function hasDb(): boolean {
  const g = globalThis as { __scoutTestDb?: unknown };
  return !!g.__scoutTestDb || !!process.env.DATABASE_URL;
}

export { schema };
