import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { findAnnouncement } from "@/lib/backtest";
import * as F from "@/lib/sources/fetchers";
import { rateLimit } from "@/lib/visitor";

export const maxDuration = 60;

/** Steps that wait on the visitor: confirm the announcement, then confirm the website. */
export async function POST(req: Request) {
  const { step, name } = await req.json().catch(() => ({}));
  const n = String(name || "").trim().slice(0, 60);
  if (!n) return NextResponse.json({ error: "Type a startup's name." }, { status: 400 });
  if (!(await rateLimit("backtest-lookup", 20, 3600))) return NextResponse.json({ error: "A few backtests per hour per visitor. Try again later." }, { status: 429 });
  if (step === "announce") {
    const a = await findAnnouncement(n);
    return NextResponse.json({ announce: a });
  }
  if (step === "website") {
    const r = (await db().execute(sql`select domain from companies where lower(name) = lower(${n}) and domain is not null limit 1`)) as unknown as { rows: { domain: string }[] };
    if (r.rows[0]) return NextResponse.json({ website: r.rows[0].domain });
    const yc = (await F.ycAll()).find((c) => c.name.toLowerCase() === n.toLowerCase());
    if (yc?.website) return NextResponse.json({ website: yc.website.replace(/^https?:\/\//, "").replace(/\/$/, "") });
    const guess = `${n.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    return NextResponse.json({ website: guess, guessed: true });
  }
  return NextResponse.json({ error: "bad step" }, { status: 400 });
}
