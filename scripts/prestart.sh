#!/bin/bash
# The progress page from second zero (10-14-26). Plain HTML with no dependencies, so it can open before
# `npm ci` has run. It shows whose turn it is during the first two minutes (sign in to Vercel, accept the
# database terms), then "you can walk away", and hands over to the full page (scripts/step.ts) at step 1:
# the full page is written to the SAME file and the plain page reloads itself once, when the rich state appears.
#
#   prestart.sh open                      write the page + the first state, open it in the browser, mark it opened
#   prestart.sh state start|signin|terms|walk [url] [code]
#   PRESTART_NO_OPEN=1                    write everything, open nothing (tests)
set -u
DIR="$HOME/.courtside-ventures-scout"
PAGE="$DIR/progress.html"
JS="$DIR/progress.js"
mkdir -p "$DIR"
now_ms() { node -e 'console.log(Date.now())' 2>/dev/null || echo $(( $(date +%s) * 1000 )); }

write_state() { # phase url code
  START=$(cat "$DIR/started-at" 2>/dev/null || now_ms)
  printf 'window.__progress = {"pre":"%s","url":"%s","code":"%s","startedAt":%s,"updatedAt":%s};\n' "$1" "${2:-}" "${3:-}" "$START" "$(now_ms)" > "$JS"
}

write_page() {
cat > "$PAGE" <<'HTML'
<!doctype html><html lang="en" data-build="pre-1"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Courtside Ventures Scout · launching</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Montserrat:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0c;--card:#15151a;--line:#2a2a33;--ink:#f3f3f5;--mute:#9a9aa6;--red:#cc003d;--red2:#e0004a;--gold:#d4a017;--green:#2fbf71}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Montserrat,sans-serif;padding:40px 16px 100px}
main{max-width:760px;margin:0 auto}
h1{font:600 clamp(24px,4vw,34px)/1.1 Oswald,sans-serif;letter-spacing:.02em;margin:0 0 6px;text-transform:uppercase}
.sub{color:var(--mute);margin:0 0 28px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:26px 28px;margin:0 0 18px}
.turn{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
.turn .kicker{color:var(--gold)}
.walk{border-color:var(--green)}
.walk .kicker{color:var(--green)}
.kicker{font:600 13px/1 Montserrat,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin:0 0 10px}
.card h2{font:600 clamp(22px,3.4vw,30px)/1.15 Oswald,sans-serif;margin:0 0 10px}
.card p{margin:0 0 14px;color:var(--ink);overflow-wrap:anywhere}
.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:10px;background:var(--red);color:#fff;font:600 16px/1 Montserrat,sans-serif;text-decoration:none}
.btn:hover{background:var(--red2)}
.code{font:600 22px/1 "IBM Plex Mono",monospace;letter-spacing:.08em;background:#0a0a0c;border:1px solid var(--line);border-radius:8px;padding:10px 14px;display:inline-block;margin:0 0 14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.stat b{display:block;font:600 26px/1 "IBM Plex Mono",monospace;margin:0 0 6px}
.stat span{color:var(--mute);font-size:13px}
.steps{color:var(--mute);font-size:14px;margin:18px 0 0}
.steps li{margin:0 0 4px}
[hidden]{display:none !important}
</style></head><body><main>
<h1>Courtside Ventures Scout</h1>
<p class="sub">Launching on this account. This page updates by itself; the full progress page takes over in a moment.</p>

<section class="card" id="start"><p class="kicker">Starting</p><h2>Getting ready</h2><p>Checking the Vercel sign-in and preparing the install.</p></section>

<section class="card turn" id="signin" hidden><p class="kicker">Your turn</p><h2>Sign in to Vercel</h2>
<p>A Vercel page has opened in this browser. Sign in there, or create a free account on that page (an email code, or GitHub, GitLab, Bitbucket). If the page is not in front, use the button.</p>
<p id="codeRow" hidden>Enter this code if the page asks for it: <br><span class="code" id="code"></span></p>
<p><a class="btn" id="signinBtn" href="#" target="_blank" rel="noopener">Open the Vercel Page</a></p></section>

<section class="card turn" id="terms" hidden><p class="kicker">Your turn</p><h2>Accept the Database Terms</h2>
<p>The free database (Neon, through Vercel) needs its terms accepted once. A page has opened for it; click Accept there. This page continues by itself the moment you do.</p>
<p><a class="btn" id="termsBtn" href="#" target="_blank" rel="noopener">Open the Terms Page</a></p></section>

<section class="card walk" id="walk" hidden><p class="kicker">Nothing more is needed from you</p><h2>You Can Walk Away</h2>
<p>The install, build, tests and deploy run on their own now. The site opens in this browser by itself in about 10 minutes, and this page shows every step until then.</p></section>

<div class="stats">
  <div class="stat"><b id="since">0:00</b><span>Since start</span></div>
  <div class="stat"><b id="waitFor" hidden>0:00</b><b id="togo">~10 min</b><span id="togoLabel">Roughly to go, after your part</span></div>
</div>
<ul class="steps"><li>1 Setup · 2 Database · 3 Build and tests · 4 Deploy · 5 Open</li><li>Each step gets its own line on the full page, with the time it took.</li></ul>
</main>
<script>
function clock(sec){sec=Math.max(0,Math.floor(sec));var m=Math.floor(sec/60),s=String(sec%60).padStart(2,"0");return m+":"+s}
function set(el,txt){if(el&&el.textContent!==txt)el.textContent=txt}
function show(id,on){var el=document.getElementById(id);if(el.hidden===on)el.hidden=!on}
var P=null,handed=false;
function render(){
  var p=window.__progress;if(!p)return;P=p;
  if(!p.pre){ if(!handed){handed=true;location.replace(location.pathname+"?handoff="+Date.now());} return; } /* the full page replaced this one: load it, once */
  ["start","signin","terms","walk"].forEach(function(id){show(id,p.pre===id)});
  if(p.pre==="signin"){var b=document.getElementById("signinBtn");if(p.url&&b.getAttribute("href")!==p.url)b.setAttribute("href",p.url);show("codeRow",!!p.code);set(document.getElementById("code"),p.code||"")}
  if(p.pre==="terms"){var t=document.getElementById("termsBtn");if(p.url&&t.getAttribute("href")!==p.url)t.setAttribute("href",p.url)}
  set(document.getElementById("since"),clock((Date.now()-p.startedAt)/1000));
  set(document.getElementById("togoLabel"),p.pre==="walk"?"Roughly to go":"Roughly to go, after your part");
}
function pull(){var s=document.createElement("script");s.src="progress.js?t="+Date.now();s.onload=s.onerror=function(){s.remove();render()};document.head.appendChild(s)}
pull();setInterval(pull,2000);setInterval(render,1000);
</script></body></html>
HTML
}

case "${1:-}" in
  open)
    rm -f "$DIR/progress-state.json" "$DIR"/progress.html.opened-* 2>/dev/null
    now_ms > "$DIR/started-at"
    write_page
    write_state start
    : > "$PAGE.opened-pre"   # tells scripts/step.ts the page is already open: no second tab
    if [ -z "${PRESTART_NO_OPEN:-}" ]; then
      case "$(uname -s)" in Darwin) open "$PAGE" ;; Linux) xdg-open "$PAGE" > /dev/null 2>&1 || true ;; *) true ;; esac
    fi
    ;;
  state) write_state "${2:-start}" "${3:-}" "${4:-}" ;;
  --help|-h) sed -n '2,9p' "$0"; exit 2 ;;
  *) echo "usage: prestart.sh open | state <start|signin|terms|walk> [url] [code]" >&2; exit 2 ;;
esac
