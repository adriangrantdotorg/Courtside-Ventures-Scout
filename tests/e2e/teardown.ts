// After a local e2e run: undo what the tests wrote, so the shared database carries no residue.
import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
config({ path: ".env.local", quiet: true });

export default async function teardown() {
  // a run on the local copy (SCOUT_PGLITE) wrote nothing to the shared database
  if (process.env.LIVE_URL || process.env.SCOUT_PGLITE || !existsSync(".logs/e2e-start")) return;
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
  // rows the Tracking add tests create by name (10-14-26)
  await sql`delete from people where name like 'Test Person %'`;
  await sql`delete from alerts where title like '%Test rule %'`;
  await sql`delete from companies where name like 'Test Co %'`;
  await sql`delete from trends where term like 'Test trend %'`;
  await sql`delete from change_log where created_at >= ${since}`;
  await sql`delete from votes where created_at >= ${since}`;
  await sql`delete from notes where created_at >= ${since}`;
  await sql`delete from feedback where created_at >= ${since}`;
  await sql`delete from rate_limits`;
}
