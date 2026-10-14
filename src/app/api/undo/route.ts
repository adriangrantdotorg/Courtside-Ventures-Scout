import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { setSetting } from "@/lib/settings";

/** Undo one change-log entry: status moves, tracking, settings, fund moves, notes. */
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const [l] = await db().select().from(S.changeLog).where(eq(S.changeLog.id, Number(id)));
  if (!l || l.undoneAt) return NextResponse.json({ error: "Nothing to undo" }, { status: 404 });
  const [kind, tid] = String(l.target || "").split(":");
  const before = (l.before || {}) as Record<string, unknown>;
  if (kind === "company" && "status" in before) await db().update(S.companies).set({ status: String(before.status) }).where(eq(S.companies.id, Number(tid)));
  else if (kind === "company" && "tracked" in before) await db().update(S.companies).set({ tracked: !!before.tracked }).where(eq(S.companies.id, Number(tid)));
  else if (kind === "trend" && "tracked" in before) await db().update(S.trends).set({ tracked: !!before.tracked }).where(eq(S.trends.id, Number(tid)));
  else if (kind === "setting") await setSetting(tid, before.value ?? null);
  else if (kind === "fund" && "kind" in before) await db().update(S.funds).set({ kind: String(before.kind) }).where(eq(S.funds.id, Number(tid)));
  else if (kind === "note") await db().delete(S.notes).where(eq(S.notes.id, Number(tid)));
  else if (kind === "voice" && before.deleted) await db().insert(S.voices).values(before.deleted as typeof S.voices.$inferInsert).onConflictDoNothing();
  else if (kind === "voice") await db().delete(S.voices).where(eq(S.voices.id, Number(tid)));
  else if (kind === "fundrow" && before.deleted) await db().insert(S.funds).values(before.deleted as typeof S.funds.$inferInsert).onConflictDoNothing();
  else if (kind === "fundrow") await db().delete(S.funds).where(eq(S.funds.id, Number(tid)));
  else if (kind === "fundfocus") await db().update(S.funds).set({ focus: String(before.focus) }).where(eq(S.funds.id, Number(tid)));
  else if (kind === "alert") await db().update(S.alerts).set({ active: !!before.active }).where(eq(S.alerts.id, Number(tid)));
  await db().update(S.changeLog).set({ undoneAt: new Date() }).where(eq(S.changeLog.id, l.id));
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, summary: l.summary });
}
