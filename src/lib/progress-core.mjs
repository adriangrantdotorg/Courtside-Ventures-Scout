// One producer for the build-progress view. Used by scripts/step.ts (inlined into the
// local file:// page) and by the live Building page. Plain JS so both can load it.

// The five steps of `npm run launch` (v6, 10-14-26): the finished site is installed, not rebuilt.
export const STEPS = ["Setup", "Database", "Build and tests", "Deploy", "Open"];
export const BUDGETS = [3, 1, 4, 2, 1]; // minutes, measured on the v5 run and the 10-14-26 dry run

export function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? h + ":" + String(m).padStart(2, "0") + ":" + s : m + ":" + s;
}

// "Roughly to go", in minutes rounded to 5. Pauses while a "Waiting for you" note is up.
export function minutesToGo(p, now) {
  if (!p || p.done) return 0;
  const cur = p.step - 1;
  const durations = p.durations || {};
  let actual = 0;
  let budgeted = 0;
  for (let i = 0; i < cur; i++) {
    const d = durations[i + 1];
    if (typeof d === "number") {
      actual += d / 60;
      budgeted += BUDGETS[i];
    }
  }
  let ratio = budgeted > 0 ? actual / budgeted : 1;
  ratio = Math.min(1.6, Math.max(0.7, ratio));
  const effectiveNow = p.waiting && p.waitingSince ? p.waitingSince : now;
  const inStep = Math.max(0, (effectiveNow - (p.stepStartedAt || now)) / 60000);
  let left = Math.max(0, BUDGETS[cur] * ratio - inStep);
  for (let i = cur + 1; i < BUDGETS.length; i++) left += BUDGETS[i] * ratio;
  return Math.max(1, Math.round(left)); // a ten-minute launch is told to the minute
}

export function isStale(p, now) {
  return !!p && !p.done && now - (p.updatedAt || now) > 10 * 60 * 1000;
}

export function stepRows(p) {
  const cur = p ? p.step : 1;
  return STEPS.map((name, i) => {
    const n = i + 1;
    const state = p && p.done ? "done" : n < cur ? "done" : n === cur ? "now" : "todo";
    const d = p && p.durations ? p.durations[n] : undefined;
    let label = name;
    if (n === STEPS.length - 1 && p && p.liveUrl) label = name + " · live at " + p.liveUrl.replace(/^https?:\/\//, "");
    const time = state === "done" && typeof d === "number" ? clock(d) : state === "now" ? "about " + BUDGETS[i] + " min" : "about " + BUDGETS[i] + " min";
    return { n, num: String(n).padStart(2, "0"), name: label, state, time, mark: state === "done" ? "✓" : state === "now" ? "→" : "·" };
  });
}

export function noteLine(p) {
  if (!p) return "Starting";
  const base = "Step " + p.step + " of " + STEPS.length + " · " + p.name;
  return p.note ? (p.waiting ? p.note : base + " · " + p.note) : base;
}
