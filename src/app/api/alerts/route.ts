import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { rateLimit } from "@/lib/visitor";

/** Without AI, an alert is a short form: subject, event type, keywords, sources. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const subject = String(b.subject || "").trim().slice(0, 80);
  const event = String(b.event || "mention");
  const keywords = String(b.keywords || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!subject && !keywords.length) return NextResponse.json({ error: "An alert needs a subject or a keyword." }, { status: 400 });
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const EV: Record<string, string> = { mention: "is mentioned", formd: "files a Form D", funding: "raises money", launch: "launches something new" };
  const title = `Alert me when ${subject || keywords.join(" and ")} ${EV[event] || "is mentioned"}${keywords.length && subject ? ` (keywords: ${keywords.join(", ")})` : ""}.`;
  const [a] = await db()
    .insert(S.alerts)
    .values({ title, rule: { subject: subject || "any", event: "keywords", keywords: keywords.map((k: string) => k.toLowerCase()), sources: ["news", "voices", "podcasts", "sec"] } })
    .returning();
  await db().insert(S.changeLog).values({ kind: "alert", summary: `New alert: ${title}`, target: `alert:${a.id}`, before: { active: false }, after: { active: true } });
  revalidatePath("/alerts");
  return NextResponse.json({ ok: true, alert: a });
}

export async function PATCH(req: Request) {
  const { id, active } = await req.json().catch(() => ({}));
  const [a] = await db().select().from(S.alerts).where(eq(S.alerts.id, Number(id)));
  if (!a) return NextResponse.json({ error: "No such alert" }, { status: 404 });
  await db().update(S.alerts).set({ active: !!active }).where(eq(S.alerts.id, a.id));
  await db().insert(S.changeLog).values({ kind: "alert", summary: `${active ? "Turned on" : "Turned off"} the alert "${a.title}"`, target: `alert:${a.id}`, before: { active: a.active }, after: { active: !!active } });
  revalidatePath("/alerts");
  return NextResponse.json({ ok: true });
}
