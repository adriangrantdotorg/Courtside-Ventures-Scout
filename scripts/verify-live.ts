// npm run verify:live -- <url>: the live checks with AI off, then the read-only browser suite, then the residue query.
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
config({ path: ".env.local", quiet: true });

const LIGHT = process.argv.includes("--light"); // the launch's check: pages and sources only; the browser suite and residue run in `npm run release`
const url = (process.argv.slice(2).find((a) => !a.startsWith("--")) || process.env.SITE_URL || "").replace(/\/$/, "");
if (!url) throw new Error("usage: npm run verify:live -- <url>");
const fails: string[] = [];
const ok = (c: boolean, m: string) => (c ? console.log("✓ " + m) : (fails.push(m), console.log("✗ " + m)));
const get = async (p: string) => {
  const r = await fetch(url + p, { headers: { "user-agent": "CourtsideVenturesScout/1.0 verify" } });
  return { status: r.status, html: await r.text(), landed: r.url };
};
const count = (html: string, re: RegExp) => (html.match(re) || []).length;

const home = await get("/");
// A per-deploy address (project-xxxxxxxxx.vercel.app) is behind Vercel Authentication and lands on vercel.com's login
// page; every content check would then fail for no reason of the site's (third dry run, 10-14-26). Say it once and stop.
if (/^https:\/\/vercel\.com\//.test(home.landed)) {
  console.log(`✗ ${url} is behind Vercel's login wall (it landed on ${home.landed.split("?")[0]}); check the public address, https://<project>.vercel.app`);
  process.exit(1);
}
ok(home.status === 200, "home answers 200");
ok(!home.html.includes('data-testid="building"'), "the Building page is switched off");
ok(home.html.includes('aria-label="Spotlight"') && /class="src"[^>]*href="http/.test(home.html), "the Spotlight has a sourced line");
ok(count(home.html, /class="t1"/g) >= 5, "at least 5 top picks");
ok(count(home.html, /class="item" data-item/g) >= 4, "Velocity shows trends");
ok(home.html.includes("From Courtside"), "the newest Courtside post");
const pl = await get("/pipeline");
ok(pl.status === 200 && count(pl.html, /stageText/g) >= 5, "pipeline cards render");
const tr = await get("/trends");
ok(count(tr.html, /class="rowcard tcard"/g) >= 5, "at least 5 trends");
const sp = await get("/sponsors");
const brands = Number((sp.html.match(/(\d+)(?:<!-- -->)? brands/) || [])[1] || 0);
ok(brands >= 30, `at least 30 Sponsor Radar brands (${brands})`);
const cu = await get("/culture");
ok(count(cu.html, /<blockquote/g) >= 10, "at least 10 Culture entries with sources");
const fd = await get("/throw-some-ds");
ok(count(fd.html, /data-act="source"[^>]*>SEC EDGAR|>SEC EDGAR</g) >= 1, "Form D rows");
const nb = await get("/neighborhood");
ok(nb.status === 200, "Neighborhood answers");
const sy = await get("/synergistic-funders");
ok(sy.status === 200, "Synergistic Funders answers");
const bt = await get("/backtest");
ok(count(bt.html, /class="card2 win"/g) >= 2 && !/class="card2 none"/.test(bt.html), "backtest shows only the deals found first");
const ab = await get("/about");
ok(ab.html.includes("https://www.linkedin.com/in/adriangrant3/") && ab.html.includes("A prototype deal-sourcing site for Courtside Ventures built by Adrian Grant."), "About: Talk to Adrian and the prototype line");
for (const p of ["/icon.png", "/favicon.ico"]) ok((await fetch(url + p)).status === 200, `${p} answers`);
// source links on the top picks answer
const links = [...home.html.matchAll(/class="evi"><a href="(https?:[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).slice(0, 5);
for (const l of links) {
  const r = await fetch(l, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } }).catch(() => null);
  ok(!!r && (r.ok || [401, 403, 429].includes(r.status)), `source link answers: ${l.slice(0, 70)}`);
}
if (!LIGHT) {
// residue is measured as rows the browser suite ADDS, never against zero: the team's own clicks
// (a status change, a tracked trend) are real use, not residue (10-14-26, Adrian's review left three rows).
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL!);
const counts = async () => ((await sql`select (select count(*) from votes)::int v, (select count(*) from companies where tracked)::int t, (select count(*) from trends where tracked)::int tt, (select count(*) from change_log)::int c`) as { v: number; t: number; tt: number; c: number }[])[0];
const before = await counts();
// the browser suite, read-only
try {
  execFileSync("npx", ["playwright", "test", "tests/e2e/site.spec.ts", "tests/e2e/clicks.spec.ts", "tests/e2e/smoke.spec.ts"], { stdio: "inherit", env: { ...process.env, LIVE_URL: url } });
  ok(true, "browser suite on the live URL");
} catch {
  ok(false, "browser suite on the live URL");
}
// residue
const after = await counts();
const d = { v: after.v - before.v, t: after.t - before.t, tt: after.tt - before.tt, c: after.c - before.c };
ok(d.v === 0 && d.t === 0 && d.tt === 0 && d.c === 0, `residue left by the suite: votes ${d.v}, trackers ${d.t}, tracked trends ${d.tt}, change_log ${d.c}`);
}
console.log(fails.length ? `\n${fails.length} live check(s) failed` : "\nall live checks green");
process.exit(fails.length ? 1 : 0);
