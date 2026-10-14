import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { visitor, rateLimit } from "@/lib/visitor";

const TYPES = new Set(["company", "trend", "sponsor", "brief", "alert_hit", "culture", "voice", "source", "memo", "filing", "fund_item", "spotlight", "backtest", "person"]);

export async function POST(req: Request) {
  const { key, value } = await req.json().catch(() => ({}));
  const [type, ...rest] = String(key || "").split(":");
  const id = rest.join(":");
  if (!TYPES.has(type) || !id || ![1, -1, 0].includes(Number(value))) return NextResponse.json({ error: "bad vote" }, { status: 400 });
  if (!(await rateLimit("vote", 120, 3600))) return NextResponse.json({ error: "Too many votes from this browser in the last hour. Try again later." }, { status: 429 });
  const v = await visitor();
  if (Number(value) === 0) await db().delete(S.votes).where(and(eq(S.votes.itemType, type), eq(S.votes.itemId, id), eq(S.votes.visitor, v)));
  else
    await db()
      .insert(S.votes)
      .values({ itemType: type, itemId: id, visitor: v, value: Number(value) })
      .onConflictDoUpdate({ target: [S.votes.itemType, S.votes.itemId, S.votes.visitor], set: { value: Number(value), createdAt: new Date() } });
  const r = (await db().execute(sql`select coalesce(sum(value),0)::int as n from votes where item_type = ${type} and item_id = ${id}`)) as unknown as { rows: { n: number }[] };
  revalidatePath("/", "layout");
  return NextResponse.json({ count: Number(r.rows[0]?.n || 0), mine: Number(value) });
}
