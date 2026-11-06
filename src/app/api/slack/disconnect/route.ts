import { NextResponse } from "next/server";
import { SLACK } from "@/lib/features";
import { disconnectSlack } from "@/lib/slack";

export async function POST() {
  if (!SLACK) return new NextResponse(null, { status: 404 }); // Slack is off (src/lib/features.ts)
  await disconnectSlack();
  return NextResponse.json({ ok: true });
}
