import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { latestJobRuns } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Settings › Jobs and Sources poll this every 15 s while anything runs; the page patches in place. */
export async function GET() {
  const [runs, health] = await Promise.all([
    latestJobRuns(),
    db().execute(sql`select source, last_ok, last_error, error_text, items from source_health order by source`) as unknown as Promise<{ rows: unknown[] }>,
  ]);
  return NextResponse.json({ runs, health: health.rows, at: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
