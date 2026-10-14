import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { slugify } from "@/lib/format";
import { rateLimit } from "@/lib/visitor";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 80);
  const kind = b.kind === "neighborhood" ? "neighborhood" : "synergistic";
  if (name.length < 2) return NextResponse.json({ error: "A fund needs a name." }, { status: 400 });
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const [f] = await db().insert(S.funds).values({ slug: slugify(name), name, kind, focus: b.focus === "specialist" ? "specialist" : "broad", site: b.site || null }).onConflictDoNothing().returning();
  if (!f) return NextResponse.json({ error: `${name} is already on the list.` }, { status: 409 });
  await db().insert(S.changeLog).values({ kind: "fund", summary: `Added ${name} (${f.focus})`, target: `fundrow:${f.id}`, before: null, after: { id: f.id } });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, fund: f });
}

export async function PATCH(req: Request) {
  const { id, focus } = await req.json().catch(() => ({}));
  const [f] = await db().select().from(S.funds).where(eq(S.funds.id, Number(id)));
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const next = focus === "specialist" ? "specialist" : "broad";
  await db().update(S.funds).set({ focus: next }).where(eq(S.funds.id, f.id));
  await db().insert(S.changeLog).values({ kind: "fund", summary: `${f.name}: ${f.focus} → ${next}`, target: `fundfocus:${f.id}`, before: { focus: f.focus }, after: { focus: next } });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const [f] = await db().select().from(S.funds).where(eq(S.funds.id, Number(id)));
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db().delete(S.funds).where(eq(S.funds.id, f.id));
  await db().insert(S.changeLog).values({ kind: "fund", summary: `Removed ${f.name}`, target: `fundrow:${f.id}`, before: { deleted: f }, after: null });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
