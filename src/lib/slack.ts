// Slack: incoming-webhook only, stored server-side, encrypted. Posting is optional and quiet.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getSetting, setSetting } from "./settings";
import { transport } from "./sources/http";

function key() {
  return createHash("sha256")
    .update(process.env.CRON_SECRET || "scout-local")
    .digest();
}

export function encrypt(s: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(s, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(s: string): string | null {
  try {
    const [iv, tag, enc] = s.split(".").map((x) => Buffer.from(x, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export type SlackConn = { webhook: string; channel: string; team: string; connectedAt: string };

export async function slackConnection(): Promise<Omit<SlackConn, "webhook"> | null> {
  const c = await getSetting<SlackConn | null>("slack", null);
  return c ? { channel: c.channel, team: c.team, connectedAt: c.connectedAt } : null;
}

export async function saveSlack(webhook: string, channel: string, team: string) {
  await setSetting("slack", { webhook: encrypt(webhook), channel, team, connectedAt: new Date().toISOString() });
}

export async function disconnectSlack() {
  await setSetting("slack", null);
}

/** null when Slack isn't connected; true/false for the post. */
export async function slackPost(text: string): Promise<boolean | null> {
  const c = await getSetting<SlackConn | null>("slack", null);
  if (!c) return null;
  const url = decrypt(c.webhook);
  if (!url) return false;
  try {
    const r = await transport.fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    return r.ok;
  } catch {
    return false;
  }
}

export function slackConfigured() {
  return !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}
