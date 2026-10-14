import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { rateLimit } from "@/lib/visitor";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!(await rateLimit("feedback", 20, 3600))) return NextResponse.json({ error: "Too many reports from this browser in the last hour." }, { status: 429 });
  const [row] = await db()
    .insert(S.feedback)
    .values({ page: String(b.page || "/").slice(0, 200), element: String(b.element || "").slice(0, 300), viewport: String(b.viewport || ""), theme: String(b.theme || ""), browser: String(b.browser || "").slice(0, 200), chips: Array.isArray(b.chips) ? b.chips.slice(0, 5) : [], note: String(b.note || "").slice(0, 1000) })
    .returning({ id: S.feedback.id });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(req: Request) {
  const { id, action, status } = await req.json().catch(() => ({}));
  if (action === "metoo") await db().update(S.feedback).set({ meToo: sql`${S.feedback.meToo} + 1` }).where(eq(S.feedback.id, Number(id)));
  if (status && ["open", "fixed", "wontfix"].includes(status)) await db().update(S.feedback).set({ status }).where(eq(S.feedback.id, Number(id)));
  return NextResponse.json({ ok: true });
}
