import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { runNamed } from "@/lib/jobs";
import { rateLimit } from "@/lib/visitor";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Refresh Now: the fastest sources inside one function call, streamed as stage + count. Once an hour for everyone. */
export async function GET() {
  const enc = new TextEncoder();
  const [last] = await db().select({ t: S.jobRuns.startedAt }).from(S.jobRuns).where(eq(S.jobRuns.job, "refresh")).orderBy(desc(S.jobRuns.startedAt)).limit(1);
  const stream = new ReadableStream({
    async start(ctl) {
      const send = (o: unknown) => ctl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      if (last && Date.now() - last.t.getTime() < 60 * 60 * 1000) {
        send({ type: "refused", lastRefresh: last.t.toISOString() });
        ctl.close();
        return;
      }
      if (!(await rateLimit("refresh", 3, 3600))) {
        send({ type: "error", message: "This browser has asked for several refreshes this hour. Try again later." });
        ctl.close();
        return;
      }
      let finished = false;
      const job = runNamed("refresh", 60_000).finally(() => (finished = true));
      while (!finished) {
        await new Promise((r) => setTimeout(r, 1500));
        const r = (await db().execute(sql`select stage, done, total from job_runs where job = 'refresh' order by id desc limit 1`)) as unknown as { rows: { stage: string; done: number; total: number }[] };
        const row = r.rows[0];
        if (row && !finished) send({ type: "stage", stage: row.stage, done: row.done, total: row.total });
      }
      try {
        const res = await job;
        revalidatePath("/", "layout");
        send({ type: "done", items: res.items, changes: res.changes });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      }
      ctl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
}
