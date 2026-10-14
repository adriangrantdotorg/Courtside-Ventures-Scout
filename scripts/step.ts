// npm run step -- <n> "<name>" [--note "<text>"] [--live <url>]
// Writes the build state to: the local progress page (~/.courtside-ventures-scout), the
// database (settings.build_progress, once DATABASE_URL exists), and prints the chat block.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { STEPS, BUDGETS, clock, minutesToGo } from "../src/lib/progress-core.mjs";

config({ path: ".env.local", quiet: true });

type State = {
  step: number;
  name: string;
  startedAt: number;
  stepStartedAt: number;
  updatedAt: number;
  note: string;
  waiting: boolean;
  waitingSince?: number;
  liveUrl: string;
  done: boolean;
  durations: Record<number, number>;
};

const DIR = join(homedir(), ".courtside-ventures-scout");
const STATE = join(DIR, "progress-state.json");
const PAGE = join(DIR, "progress.html");
const JS = join(DIR, "progress.js");
const PAGE_VERSION = "v6-1";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const pos = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !(all[i - 1] || "").startsWith("--"));
let n = Number(pos[0]);
let name = pos[1] || STEPS[n - 1];
if (n === 0 || isNaN(n)) n = -1;
if (n !== -1 && (n < 1 || n > STEPS.length)) {
  console.error(`usage: npm run step -- <1-${STEPS.length}> "<name>" [--note "<text>"] [--live <url>] [--done]`);
  process.exit(2);
}

mkdirSync(DIR, { recursive: true });
const now = Date.now();
let s: State | null = null;
if (existsSync(STATE)) {
  try {
    s = JSON.parse(readFileSync(STATE, "utf8"));
    if (!s || (s as State & { build?: string }).build !== PAGE_VERSION) s = null;
  } catch {
    s = null;
  }
}
// a background task reporting from an earlier step (or step 0) only updates the note
if (s && (n === -1 || n < s.step)) {
  n = s.step;
  name = s.name;
}
if (n === -1) n = 1;
if (!s || n === 1 && !arg("--note") && s.step !== 1) {
  // The clock starts when the launch did, not when this page took over from the plain one (scripts/prestart.sh)
  const startedAt = Number(process.env.SCOUT_STARTED_AT) || now;
  s = { step: 1, name: STEPS[0], startedAt, stepStartedAt: now, updatedAt: now, note: "", waiting: false, liveUrl: "", done: false, durations: {} };
}
// the plain page from second zero marks the tab as open (".opened-pre"), so no second tab is opened here
const firstCallOfStep1 = n === 1 && !existsSync(PAGE + ".opened-" + PAGE_VERSION) && !existsSync(PAGE + ".opened-pre");

if (n !== s.step) {
  if (n > s.step) {
    // close every step between the old one and this one
    s.durations[s.step] = Math.round((now - s.stepStartedAt) / 1000);
    for (let k = s.step + 1; k < n; k++) s.durations[k] = s.durations[k] ?? 0;
  }
  s.step = n;
  s.stepStartedAt = now;
  s.note = "";
  s.waiting = false;
  delete s.waitingSince;
}
s.name = name;
const note = arg("--note");
if (note !== undefined) {
  s.note = note;
  const waiting = /^waiting for you/i.test(note);
  if (waiting && !s.waiting) s.waitingSince = now;
  if (!waiting && s.waiting && s.waitingSince) s.stepStartedAt += now - s.waitingSince; // the wait does not count against the budget
  if (!waiting) delete s.waitingSince;
  s.waiting = waiting;
}
const live = arg("--live");
if (live) s.liveUrl = live.replace(/\/$/, "");
if (n === STEPS.length && process.argv.includes("--done")) {
  s.durations[STEPS.length] = Math.round((now - s.stepStartedAt) / 1000);
  s.done = true;
}
s.updatedAt = now;
writeFileSync(STATE, JSON.stringify({ ...s, build: PAGE_VERSION }, null, 2));

// progress.html: written once per build version; never reloads itself. Written BEFORE progress.js, so when the
// plain page from second zero (scripts/prestart.sh) sees the rich state and reloads once, this page is already there.
if (!existsSync(PAGE) || !readFileSync(PAGE, "utf8").includes(`data-build="${PAGE_VERSION}"`)) {
  writeFileSync(PAGE, renderPage());
}

// progress.js: the state, re-read by the page every 5 s (a script tag works on file://)
writeFileSync(JS, "window.__progress = " + JSON.stringify(s) + ";\n");

// database (optional until the schema exists)
async function writeDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    await sql`insert into settings (key, value, updated_at) values ('build_progress', ${JSON.stringify(s)}::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  } catch {
    /* table not there yet: the local page still updates */
  }
}

function block(st: State) {
  const bar = STEPS.map((_, i) => (i < st.step - (st.done ? 0 : 1) || st.done ? "▰" : i === st.step - 1 ? "▰" : "▱")).join("");
  const since = clock((now - st.startedAt) / 1000);
  const done = STEPS.slice(0, st.step - 1)
    .map((nm, i) => `✓ ${i + 1} ${nm}${i === STEPS.length - 2 && st.liveUrl ? ` (live: ${st.liveUrl})` : ""}`)
    .join("   ");
  const later = STEPS.map((nm, i) => ({ nm, i }))
    .filter(({ i }) => i > st.step - 1)
    .map(({ nm, i }) => `${i + 1} ${nm}`)
    .join(" · ");
  const lines = [`${bar}  Step ${st.step} of ${STEPS.length} · ${st.name} · ${since} since start`];
  if (done) lines.push(done);
  lines.push(st.done ? `✓ ${STEPS.length} ${st.name}: done` : `→ ${st.step} ${st.name}${st.note ? ": " + st.note : ""}`);
  if (later && !st.done) lines.push("  " + later);
  lines.push(st.done ? "" : `  roughly ${minutesToGo(st, now)} min to go`);
  return lines.filter(Boolean).join("\n");
}

function renderPage() {
  const core = readFileSync(join(process.cwd(), "src/lib/progress-core.mjs"), "utf8").replace(/^export /gm, "");
  const css = readFileSync(join(process.cwd(), "src/app/progress.css"), "utf8");
  return `<!doctype html><html lang="en" data-build="${PAGE_VERSION}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scout Launch Progress</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Montserrat:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>body{margin:0;background:#0a0a0c;padding:40px 16px 100px}${css}.pg-open{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:10px;background:#cc003d;color:#fff;font:600 16px/1 Montserrat,sans-serif;text-decoration:none}.pg-open:hover{background:#e0004a}</style></head>
<body><main class="pg" id="pg">
<div class="pg-eyebrow">Courtside Ventures Scout</div>
<h1 class="pg-title">Scout is launching</h1>
<div class="pg-note" id="note"><i></i><span id="noteText">Starting</span></div>
<div class="pg-note pg-stale" id="stale" hidden><i></i><span>No update for <b class="pg-live" style="min-width:5ch" id="staleFor">0:00</b></span></div>
<div class="pg-stats">
 <div class="pg-stat now"><b class="pg-live" style="min-width:7ch;text-align:left" id="since">0:00</b><span>Since start</span><small>step <em id="stepNo">1</em> began <em class="pg-live" style="min-width:5ch;text-align:left" id="stepSince">0:00</em> ago</small></div>
 <div class="pg-stat" id="togoCard"><b>~<em class="pg-live" style="min-width:3ch;text-align:left" id="togo">11</em> min</b><span>Roughly to go</span><small id="togoSub">learns from the steps so far</small></div>
</div>
<div class="pg-bar" id="bar">${STEPS.map(() => "<i></i>").join("")}</div>
<div class="pg-list" id="list">${STEPS.map((nm, i) => `<div class="pg-row todo" data-n="${i + 1}"><span class="mk">·</span><span class="k">${String(i + 1).padStart(2, "0")}</span><span class="n">${nm}</span><span class="t">about ${BUDGETS[i]} min</span></div>`).join("")}</div>
<p class="pg-foot" id="foot"></p>
<p id="openRow" hidden><a class="pg-open" id="openBtn" href="#" target="_blank" rel="noopener">Open Scout</a></p>
</main>
<script>
${core}
var P = null;
function set(el, txt){ if (el && el.textContent !== txt) el.textContent = txt; }
function render(){
  var p = window.__progress; if (!p) return; P = p;
  var now = Date.now();
  set(document.getElementById("noteText"), p.done ? "Done · Scout is live" : noteLine(p));
  document.getElementById("note").classList.toggle("wait", !!p.waiting);
  var stale = isStale(p, now); var st = document.getElementById("stale");
  if (st.hidden === stale) st.hidden = !stale;
  set(document.getElementById("staleFor"), clock((now - p.updatedAt)/1000));
  set(document.getElementById("since"), clock(((p.done ? p.updatedAt : now) - p.startedAt)/1000));
  set(document.getElementById("stepNo"), String(p.step));
  set(document.getElementById("stepSince"), clock((now - p.stepStartedAt)/1000));
  set(document.getElementById("togo"), String(minutesToGo(p, now)));
  var togo = document.getElementById("togoCard"); if (togo.hidden !== !!p.done) togo.hidden = !!p.done; // nothing to go once it is done
  set(document.getElementById("togoSub"), p.waiting ? "paused while it waits for you" : "learns from the steps so far");
  var bars = document.getElementById("bar").children;
  for (var i=0;i<bars.length;i++){ var c = p.done || i < p.step-1 ? "done" : i === p.step-1 ? "now" : ""; if (bars[i].className !== c) bars[i].className = c; }
  var rows = stepRows(p), els = document.getElementById("list").children;
  for (var j=0;j<rows.length;j++){ var r = rows[j], e = els[j], cls = "pg-row " + r.state; if (e.className !== cls) e.className = cls;
    set(e.children[0], r.mark); set(e.children[2], r.name); set(e.children[3], r.time); }
  set(document.getElementById("foot"), p.liveUrl ? "Live site: " + p.liveUrl.replace(/^https?:\\/\\//, "") : "");
  var row = document.getElementById("openRow"), btn = document.getElementById("openBtn");
  if (p.done && p.liveUrl){ if (btn.getAttribute("href") !== p.liveUrl) btn.setAttribute("href", p.liveUrl); if (row.hidden) row.hidden = false; }
}
function pull(){ var s = document.createElement("script"); s.src = "progress.js?t=" + Date.now(); s.onload = s.onerror = function(){ s.remove(); render(); }; document.head.appendChild(s); }
pull(); setInterval(pull, 5000); setInterval(render, 1000);
</script></body></html>`;
}

await writeDb();
console.log(block(s));

if (firstCallOfStep1) {
  writeFileSync(PAGE + ".opened-" + PAGE_VERSION, String(now));
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    execFileSync(opener, [PAGE], { stdio: "ignore" });
  } catch {
    /* no opener: the chat block still carries the state */
  }
}
