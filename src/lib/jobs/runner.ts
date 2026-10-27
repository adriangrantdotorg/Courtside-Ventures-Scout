// Every job: a job_runs row, a live stage/count, a 240 s time box, a resumable cursor.
import { desc, eq, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";

export type Ctx = {
  runId: number;
  stage: (stage: string, done?: number, total?: number) => Promise<void>;
  tick: (n?: number) => void;
  item: (n?: number) => void;
  error: (msg: string) => void;
  timeLeft: () => number;
  outOfTime: () => boolean;
  cursor: <T>(fallback: T) => Promise<T>;
  saveCursor: (c: unknown) => Promise<void>;
  change: (s: string) => void;
  /** Work is left that a next run picks up (pipeline:all then runs another round), though the time box isn't used up. */
  more: () => void;
};

export async function lastCursor<T>(job: string, fallback: T): Promise<T> {
  const [r] = await db().select({ cursor: S.jobRuns.cursor }).from(S.jobRuns).where(eq(S.jobRuns.job, job)).orderBy(desc(S.jobRuns.startedAt)).limit(1);
  return (r?.cursor as T) ?? fallback;
}

export async function runJob(job: string, fn: (ctx: Ctx) => Promise<void>, budgetMs = 240_000): Promise<{ id: number; status: string; items: number; errors: number; changes: string[]; timedOut: boolean; more: boolean }> {
  const t0 = Date.now();
  const prevCursor = await lastCursor(job, null as unknown);
  const [row] = await db().insert(S.jobRuns).values({ job, status: "running", stage: "starting" }).returning({ id: S.jobRuns.id });
  let items = 0;
  let errors = 0;
  let done = 0;
  let total = 0;
  let stage = "starting";
  let cursor: unknown = prevCursor;
  const log: string[] = [];
  const changes: string[] = [];
  let more = false;
  let lastWrite = 0;
  const write = async (force = false) => {
    if (!force && Date.now() - lastWrite < 2000) return;
    lastWrite = Date.now();
    await db().update(S.jobRuns).set({ stage, done, total, items, errors }).where(eq(S.jobRuns.id, row.id));
  };
  const ctx: Ctx = {
    runId: row.id,
    stage: async (s, d = 0, t = 0) => {
      stage = s;
      done = d;
      total = t;
      await write(true);
    },
    tick: (n = 1) => {
      done += n;
      void write();
    },
    item: (n = 1) => {
      items += n;
    },
    error: (m) => {
      errors++;
      if (log.length < 40) log.push(m.slice(0, 300));
    },
    timeLeft: () => budgetMs - (Date.now() - t0),
    outOfTime: () => Date.now() - t0 > budgetMs,
    cursor: async <T,>(fb: T) => (prevCursor as T) ?? fb,
    saveCursor: async (c) => {
      cursor = c;
      await db().update(S.jobRuns).set({ cursor: c as object }).where(eq(S.jobRuns.id, row.id));
    },
    change: (s) => {
      if (changes.length < 50) changes.push(s);
    },
    more: () => {
      more = true;
    },
  };
  let status = "ok";
  try {
    await fn(ctx);
    if (Date.now() - t0 > budgetMs || more) status = "partial";
  } catch (e) {
    status = "error";
    ctx.error(e instanceof Error ? e.stack || e.message : String(e));
  }
  if (errors && status === "ok") status = "partial";
  await db()
    .update(S.jobRuns)
    .set({ status, finishedAt: new Date(), stage: status === "error" ? "stopped on an error" : "done", done, total, items, errors, log: log.join("\n"), cursor: cursor as object, changes })
    .where(eq(S.jobRuns.id, row.id));
  return { id: row.id, status, items, errors, changes, timedOut: Date.now() - t0 > budgetMs, more };
}

/** A job is "running" only if it started recently and has not finished. */
export async function runningJobs() {
  const r = (await db().execute(sql`select id, job, started_at, stage, done, total from job_runs where finished_at is null and started_at > now() - interval '10 minutes' order by started_at desc`)) as unknown as {
    rows: { id: number; job: string; started_at: string; stage: string; done: number; total: number }[];
  };
  return r.rows;
}
