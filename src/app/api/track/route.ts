import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { rateLimit } from "@/lib/visitor";

export async function POST(req: Request) {
  const { kind, id, on } = await req.json().catch(() => ({}));
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const n = Number(id);
  if (kind === "company") {
    const [c] = await db().select({ name: S.companies.name, tracked: S.companies.tracked }).from(S.companies).where(eq(S.companies.id, n));
    if (!c) return NextResponse.json({ error: "No such company" }, { status: 404 });
    await db().update(S.companies).set({ tracked: !!on, trackedAt: on ? new Date() : null }).where(eq(S.companies.id, n));
    await db().insert(S.changeLog).values({ kind: "track", summary: `${on ? "Tracked" : "Untracked"} ${c.name}`, target: `company:${n}`, before: { tracked: c.tracked }, after: { tracked: !!on } });
  } else if (kind === "trend") {
    const [t] = await db().select().from(S.trends).where(eq(S.trends.id, n));
    if (!t) return NextResponse.json({ error: "No such trend" }, { status: 404 });
    if (on && !t.tracked) {
      const r = (await db().execute(sql`select count(*)::int as n from trends where tracked = true`)) as unknown as { rows: { n: number }[] };
      if (Number(r.rows[0].n) >= 30) return NextResponse.json({ error: "30 trends are already tracked. Untrack one first to free a slot.", full: true }, { status: 409 });
    }
    await db().update(S.trends).set({ tracked: !!on }).where(eq(S.trends.id, n));
    await db().insert(S.changeLog).values({ kind: "track", summary: `${on ? "Tracked" : "Untracked"} the trend "${t.term}"`, target: `trend:${n}`, before: { tracked: t.tracked }, after: { tracked: !!on } });
  } else if (kind === "person") {
    await db().update(S.people).set({ tracked: !!on }).where(eq(S.people.id, n));
  } else return NextResponse.json({ error: "bad kind" }, { status: 400 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, tracked: !!on });
}
