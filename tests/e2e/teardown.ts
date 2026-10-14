// After a local e2e run: undo what the tests wrote, so the shared database carries no residue.
import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
config({ path: ".env.local", quiet: true });

export default async function teardown() {
  if (process.env.LIVE_URL || !existsSync(".logs/e2e-start")) return;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const since = readFileSync(".logs/e2e-start", "utf8").trim();
  const logs = (await sql`select id, target, before from change_log where created_at >= ${since} and undone_at is null order by id desc`) as { id: number; target: string; before: Record<string, unknown> | null }[];
  for (const l of logs) {
    const [kind, id] = String(l.target || "").split(":");
    if (kind === "company" && l.before && "status" in l.before) await sql`update companies set status = ${String(l.before.status)} where id = ${Number(id)}`;
    if (kind === "company" && l.before && "tracked" in l.before) await sql`update companies set tracked = ${!!l.before.tracked} where id = ${Number(id)}`;
    if (kind === "trend" && l.before && "tracked" in l.before) await sql`update trends set tracked = ${!!l.before.tracked} where id = ${Number(id)}`;
  }
  await sql`delete from change_log where created_at >= ${since}`;
  await sql`delete from votes where created_at >= ${since}`;
  await sql`delete from notes where created_at >= ${since}`;
  await sql`delete from feedback where created_at >= ${since}`;
  await sql`delete from rate_limits`;
}
