// An anonymous visitor ID (one vote per browser; names nobody) and per-visitor / per-IP rate limits.
import { cookies, headers } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function visitor(): Promise<string> {
  const jar = await cookies();
  let v = jar.get("sv")?.value;
  if (!v || !/^[a-f0-9-]{36}$/.test(v)) {
    v = randomUUID();
    jar.set("sv", v, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 400 });
  }
  return v;
}

export async function ipHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "local").split(",")[0].trim();
  return createHash("sha256").update(ip + (process.env.CRON_SECRET || "")).digest("hex").slice(0, 24);
}

/** true when allowed. Counts per visitor and per hashed IP inside a window. */
export async function rateLimit(action: string, limit: number, windowSec: number): Promise<boolean> {
  const v = await visitor();
  const ip = await ipHash();
  for (const key of [`${action}:v:${v}`, `${action}:ip:${ip}`]) {
    const max = key.includes(":ip:") ? limit * 4 : limit;
    const r = (await db().execute(sql`
      insert into rate_limits (key, count, window_start) values (${key}, 1, now())
      on conflict (key) do update set
        count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
      returning count`)) as unknown as { rows: { count: number }[] };
    if (Number(r.rows[0]?.count) > max) return false;
  }
  return true;
}
