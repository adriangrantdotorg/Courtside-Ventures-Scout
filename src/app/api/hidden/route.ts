import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull, like, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { rateLimit } from "@/lib/visitor";
import { startupVerdict, TEAM_HIDDEN } from "@/lib/enrich";

export const dynamic = "force-dynamic";

/** The cards the startup filter keeps off the recommendations, and the ones the team restored (V2, 10-26-26). */
export async function GET() {
  const rows = await db()
    .select({ id: S.companies.id, name: S.companies.name, domain: S.companies.domain, why: S.companies.notStartup, keep: S.companies.keep, area: S.companies.thesisArea, score: S.companies.score })
    .from(S.companies)
    .where(or(isNotNull(S.companies.notStartup), eq(S.companies.keep, true)))
    .orderBy(desc(S.companies.score));
  return NextResponse.json({ rows });
}

/** Restore one (keep: true): the filter never drops it again. Hide one (keep: false): off the recommendations; Not a Fit
 *  (by: "team") always records the team's call, Settings' Hide Again gives it the filter's reason. keep: null is Not a
 *  Fit's Undo: the company goes back exactly as it was before its last hide, read from the change log (10-27-26: a card
 *  the rules would flag, still showing before the filter's next run, stayed hidden after ⌘Z). */
export async function POST(req: Request) {
  const { id, keep, by } = await req.json().catch(() => ({}));
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const [c] = await db().select().from(S.companies).where(eq(S.companies.id, Number(id)));
  if (!c) return NextResponse.json({ error: "No such company" }, { status: 404 });
  let next: { keep: boolean; notStartup: string | null };
  if (keep === null) {
    const [last] = await db()
      .select({ before: S.changeLog.before })
      .from(S.changeLog)
      .where(and(eq(S.changeLog.target, `company:${c.id}`), eq(S.changeLog.kind, "startup"), like(S.changeLog.summary, "Hid %")))
      .orderBy(desc(S.changeLog.id))
      .limit(1);
    const b = last?.before as { keep?: boolean; notStartup?: string | null } | null | undefined;
    next = b ? { keep: !!b.keep, notStartup: b.notStartup ?? null } : { keep: false, notStartup: startupVerdict({ ...c, keep: false }) };
  } else if (keep) next = { keep: true, notStartup: null };
  else next = { keep: false, notStartup: by === "team" ? TEAM_HIDDEN : startupVerdict({ ...c, keep: false }) || TEAM_HIDDEN };
  await db().update(S.companies).set({ keep: next.keep, notStartup: next.notStartup, hidden: keep ? false : c.hidden }).where(eq(S.companies.id, c.id));
  await db().insert(S.changeLog).values({ kind: "startup", summary: `${keep === null ? "Put back" : keep ? "Restored" : "Hid"} ${c.name}`, target: `company:${c.id}`, before: { keep: c.keep, notStartup: c.notStartup }, after: next });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, keep: next.keep, why: next.notStartup });
}
