import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { slugify } from "@/lib/format";
import { rateLimit } from "@/lib/visitor";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 80);
  if (name.length < 3) return NextResponse.json({ error: "A person needs a name." }, { status: 400 });
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const [p] = await db()
    .insert(S.people)
    .values({ slug: slugify(name), name, role: String(b.role || "").slice(0, 120) || null, youtube: b.youtube || null, blog: b.blog || null, github: b.github || null })
    .onConflictDoUpdate({ target: S.people.slug, set: { tracked: true } })
    .returning();
  await db().insert(S.changeLog).values({ kind: "person", summary: `Tracking ${name}`, target: `person:${p.id}`, before: null, after: { id: p.id } });
  revalidatePath("/people");
  return NextResponse.json({ ok: true, person: p });
}
