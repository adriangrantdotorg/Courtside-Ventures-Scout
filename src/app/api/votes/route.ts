import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { voteCounts } from "@/lib/queries";
import { visitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

/** Live counts and this browser's own votes for the keys on a page. */
export async function POST(req: Request) {
  const { keys } = await req.json().catch(() => ({ keys: [] }));
  const list: string[] = Array.isArray(keys) ? keys.slice(0, 400).map(String) : [];
  if (!list.length) return NextResponse.json({ counts: {}, mine: {} });
  const v = await visitor();
  const counts = await voteCounts(list);
  const types = [...new Set(list.map((k) => k.split(":")[0]))];
  const mineRows = await db()
    .select({ t: S.votes.itemType, i: S.votes.itemId, v: S.votes.value })
    .from(S.votes)
    .where(and(eq(S.votes.visitor, v), inArray(S.votes.itemType, types)));
  const mine: Record<string, number> = {};
  for (const r of mineRows) mine[`${r.t}:${r.i}`] = r.v;
  return NextResponse.json({ counts, mine }, { headers: { "cache-control": "no-store" } });
}
