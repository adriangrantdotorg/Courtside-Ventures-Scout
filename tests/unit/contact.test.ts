// Scout never speaks to an outside party as someone it is not (Adrian, 10-31-26): the SEC sees only the address in the
// SEC_CONTACT_EMAIL setting, which Adrian gave for it, no address sits in the code (this repo is public), and every
// User-Agent names the project, VCScout, never the firm.
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { transport, resetBackoff } from "@/lib/sources/http";

const real = transport.fetch;
afterEach(() => {
  transport.fetch = real;
  vi.unstubAllEnvs();
});

describe("the SEC contact", () => {
  it("is the SEC_CONTACT_EMAIL setting, and without it Scout never calls the SEC", async () => {
    resetBackoff();
    let ua = "";
    let calls = 0;
    transport.fetch = (async (_u: string, init?: RequestInit) => {
      calls++;
      ua = String((init?.headers as Record<string, string>)["user-agent"]);
      return new Response("", { status: 200 });
    }) as typeof fetch;
    const { fetchText } = await import("@/lib/sources/http");
    vi.stubEnv("SEC_CONTACT_EMAIL", "");
    await fetchText("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D");
    expect(calls).toBe(0);
    vi.stubEnv("SEC_CONTACT_EMAIL", "contact@example.org");
    await fetchText("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D");
    expect(ua).toBe("VCScout/1.0 contact@example.org");
  });

  it("no email address sits in the code, no User-Agent names Courtside, and no script fills the SEC contact", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|mjs|sh)$/.test(f)) files.push(p);
      }
    };
    walk("src");
    walk("scripts");
    const hits = files.flatMap((f) => (readFileSync(f, "utf8").match(/[A-Za-z0-9._+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}/g) || []).map((e) => `${f}: ${e}`));
    expect(hits, "an address an outside site sees is Adrian's call: ask him, and keep it in Vercel's settings").toEqual([]);
    const named = files.filter((f) => /Courtside\w*Scout\/\d/.test(readFileSync(f, "utf8")));
    expect(named, "a User-Agent names the project (VCScout), never Courtside").toEqual([]);
    const fills = files.filter((f) => f.startsWith("scripts") && /SEC_CONTACT_EMAIL/.test(readFileSync(f, "utf8")));
    expect(fills, "only Adrian sets SEC_CONTACT_EMAIL, with an address he gave").toEqual([]);
  });
});
