import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { STATUS_LABEL } from "@/lib/format";
import { rateLimit } from "@/lib/visitor";

/** Shared status for everyone; every move lands in the change log with Undo. */
export async function POST(req: Request) {
  const { id, status } = await req.json().catch(() => ({}));
  if (!STATUS_LABEL[status]) return NextResponse.json({ error: "bad status" }, { status: 400 });
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const [c] = await db().select({ name: S.companies.name, status: S.companies.status }).from(S.companies).where(eq(S.companies.id, Number(id)));
  if (!c) return NextResponse.json({ error: "No such company" }, { status: 404 });
  await db().update(S.companies).set({ status }).where(eq(S.companies.id, Number(id)));
  const [log] = await db()
    .insert(S.changeLog)
    .values({ kind: "status", summary: `${c.name}: ${STATUS_LABEL[c.status]} → ${STATUS_LABEL[status]}`, target: `company:${id}`, before: { status: c.status }, after: { status } })
    .returning({ id: S.changeLog.id });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, logId: log.id });
}
