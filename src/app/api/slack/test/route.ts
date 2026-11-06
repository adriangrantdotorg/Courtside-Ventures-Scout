import { NextResponse } from "next/server";
import { SLACK } from "@/lib/features";
import { slackPost } from "@/lib/slack";

export async function POST(req: Request) {
  if (!SLACK) return new NextResponse(null, { status: 404 }); // Slack is off (src/lib/features.ts)
  const { text } = await req.json().catch(() => ({}));
  const r = await slackPost(String(text || "A test message from Courtside Ventures Scout."));
  if (r === null) return NextResponse.json({ error: "Slack isn't connected yet." }, { status: 409 });
  if (!r) return NextResponse.json({ error: "Slack did not accept the message." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
