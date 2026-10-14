import { NextResponse } from "next/server";
import { saveSlack, slackPost } from "@/lib/slack";
import { transport } from "@/lib/sources/http";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  const site = process.env.SITE_URL || "";
  if (!code) return NextResponse.redirect(`${site}/settings?s=slack&error=cancelled`);
  const body = new URLSearchParams({ code, client_id: process.env.SLACK_CLIENT_ID || "", client_secret: process.env.SLACK_CLIENT_SECRET || "", redirect_uri: `${site}/api/slack/callback` });
  const r = await transport.fetch("https://slack.com/api/oauth.v2.access", { method: "POST", body });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; incoming_webhook?: { url: string; channel: string }; team?: { name: string }; error?: string };
  if (!j.ok || !j.incoming_webhook) return NextResponse.redirect(`${site}/settings?s=slack&error=${encodeURIComponent(j.error || "slack")}`);
  await saveSlack(j.incoming_webhook.url, j.incoming_webhook.channel, j.team?.name || "");
  await slackPost(`Courtside Ventures Scout is connected. Alert hits and the Monday brief will post here. ${site}`);
  return NextResponse.redirect(`${site}/settings?s=slack&connected=1`);
}
