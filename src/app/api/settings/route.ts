import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { getSetting, setSetting } from "@/lib/settings";
import { rateLimit } from "@/lib/visitor";

const ALLOWED = new Set(["scoreWeights", "worthThreshold", "stage", "thesisQueries", "extraSources", "sourcesOff", "aiDailyCap", "lanes"]);
const LABEL: Record<string, string> = { thesis: "Thesis weight", stage: "Stage weight", signal: "Signal weight", culture: "Culture weight", team: "Team weight", geo: "Geography weight" };

function describe(key: string, before: unknown, after: unknown): string {
  if (key === "scoreWeights" && before && after) {
    const b = before as Record<string, number>;
    const a = after as Record<string, number>;
    return Object.keys(a)
      .filter((k) => b[k] !== a[k])
      .map((k) => `${LABEL[k] || k} ${b[k]} → ${a[k]}`)
      .join(", ");
  }
  if (key === "worthThreshold") return `Worth a Look threshold ${before} → ${after}`;
  if (key === "extraSources") return `Extra sources ${after ? "on" : "off"}`;
  if (key === "sourcesOff") return `Sources off: ${(after as string[]).join(", ") || "none"}`;
  if (key === "thesisQueries") return "Thesis keyword search edited";
  if (key === "aiDailyCap") return `AI daily cap ${before} → ${after}`;
  if (key === "stage") return "Stage and check filters edited";
  return `${key} changed`;
}

/** Shared settings: saved for everyone, each change logged with Undo. */
export async function POST(req: Request) {
  const { changes } = await req.json().catch(() => ({}));
  if (!changes || typeof changes !== "object") return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  if (!(await rateLimit("settings", 60, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  const out: string[] = [];
  for (const [key, value] of Object.entries(changes as Record<string, unknown>)) {
    if (!ALLOWED.has(key)) continue;
    if (key === "scoreWeights") {
      const w = value as Record<string, number>;
      const sum = Object.values(w).reduce((a, b) => a + Number(b), 0);
      if (sum !== 100) return NextResponse.json({ error: `The six weights must add up to 100 (they add up to ${sum}).` }, { status: 400 });
    }
    const before = await getSetting<unknown>(key, null);
    await setSetting(key, value);
    const summary = describe(key, before, value);
    await db().insert(S.changeLog).values({ kind: "setting", summary, target: `setting:${key}`, before: { value: before }, after: { value } });
    out.push(summary);
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, saved: out });
}
