import { NextResponse } from "next/server";
import { desc, eq, isNotNull, or } from "drizzle-orm";
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

/** Restore one (keep: true): the filter never drops it again. Hide one (keep: false: Not a Fit, or Hide Again): off the
 *  recommendations until the team restores it. keep: null is Not a Fit's Undo: back to the filter's own call. */
export async function POST(req: Request) {
  const { id, keep } = await req.json().catch(() => ({}));
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const [c] = await db().select().from(S.companies).where(eq(S.companies.id, Number(id)));
  if (!c) return NextResponse.json({ error: "No such company" }, { status: 404 });
  const why = keep === null ? startupVerdict({ ...c, keep: false }) : keep ? null : startupVerdict({ ...c, keep: false }) || TEAM_HIDDEN;
  await db().update(S.companies).set({ keep: !!keep, notStartup: why, hidden: keep ? false : c.hidden }).where(eq(S.companies.id, c.id));
  await db().insert(S.changeLog).values({ kind: "startup", summary: `${keep === null ? "Put back" : keep ? "Restored" : "Hid"} ${c.name}`, target: `company:${c.id}`, before: { keep: c.keep, notStartup: c.notStartup }, after: { keep: !!keep, notStartup: why } });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, keep: !!keep, why });
}
