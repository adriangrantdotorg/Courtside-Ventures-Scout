import { NextResponse } from "next/server";
import { slackConfigured } from "@/lib/slack";

/** The official "Add to Slack" flow: OAuth v2 with only the incoming-webhook scope. */
export async function GET() {
  if (!slackConfigured()) return NextResponse.redirect(new URL("/settings?s=slack&explain=1", process.env.SITE_URL || "http://localhost:3000"));
  const u = new URL("https://slack.com/oauth/v2/authorize");
  u.searchParams.set("client_id", process.env.SLACK_CLIENT_ID!);
  u.searchParams.set("scope", "incoming-webhook");
  u.searchParams.set("redirect_uri", `${process.env.SITE_URL}/api/slack/callback`);
  return NextResponse.redirect(u.toString());
}
