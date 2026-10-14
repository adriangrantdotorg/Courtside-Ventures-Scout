import { revalidatePath } from "next/cache";
import { runBacktest } from "@/lib/backtest";
import { rateLimit } from "@/lib/visitor";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

/** Runs one backtest and streams each stage and evidence row as it is found. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const name = (u.get("name") || "").trim().slice(0, 60);
  const enc = new TextEncoder();
  const ok = name && (await rateLimit("backtest", 6, 3600));
  const stream = new ReadableStream({
    async start(ctl) {
      const send = (o: unknown) => ctl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      if (!ok) {
        send({ type: "error", message: name ? "A few backtests per hour per visitor. Try again later." : "Type a startup's name." });
        ctl.close();
        return;
      }
      try {
        const r = await runBacktest({ name, announceDate: u.get("date"), announceUrl: u.get("url"), website: u.get("website") }, (e) => send({ type: "progress", ...e }));
        revalidatePath("/backtest");
        send(r ? { type: "done", ...r } : { type: "error", message: `No funding announcement found for ${name}. Add the date yourself and run it again.` });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      }
      ctl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
}
