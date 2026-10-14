import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { visitor, rateLimit } from "@/lib/visitor";

export async function POST(req: Request) {
  const { companyId, body } = await req.json().catch(() => ({}));
  const text = String(body || "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "A note needs some text." }, { status: 400 });
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const [c] = await db().select({ name: S.companies.name }).from(S.companies).where(eq(S.companies.id, Number(companyId)));
  if (!c) return NextResponse.json({ error: "No such company" }, { status: 404 });
  const [n] = await db().insert(S.notes).values({ companyId: Number(companyId), body: text, visitor: await visitor() }).returning();
  await db().insert(S.changeLog).values({ kind: "note", summary: `Note on ${c.name}`, target: `note:${n.id}`, before: null, after: { id: n.id } });
  revalidatePath(`/company/${companyId}`);
  return NextResponse.json({ ok: true, note: n });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  await db().delete(S.notes).where(eq(S.notes.id, Number(id)));
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
