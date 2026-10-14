import { NextResponse } from "next/server";
import { slackPost } from "@/lib/slack";

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}));
  const r = await slackPost(String(text || "A test message from Courtside Ventures Scout."));
  if (r === null) return NextResponse.json({ error: "Slack isn't connected yet." }, { status: 409 });
  if (!r) return NextResponse.json({ error: "Slack did not accept the message." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
