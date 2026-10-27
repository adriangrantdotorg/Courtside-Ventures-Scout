import { NextResponse } from "next/server";
import { memoOutline } from "@/lib/memo";
import { aiAvailable } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await memoOutline(Number(id));
  if (!m) return NextResponse.json({ error: "No such company" }, { status: 404 });
  return NextResponse.json(m);
}

/** AI draft: only when AI drafting works; otherwise the outline is the product. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await aiAvailable())) return NextResponse.json({ error: "AI drafting is off. Copy the outline instead." }, { status: 409 });
  const m = await memoOutline(Number(id));
  if (!m) return NextResponse.json({ error: "No such company" }, { status: 404 });
  const { draftMemo, MEMO_CAP_MESSAGE } = await import("@/lib/ai");
  const text = await draftMemo(Number(id), m.markdown);
  if (text === "cap") return NextResponse.json({ error: MEMO_CAP_MESSAGE }, { status: 429 });
  if (!text) return NextResponse.json({ error: "The AI draft did not come back. Copy the outline instead." }, { status: 502 });
  return NextResponse.json({ name: m.name, markdown: text });
}
