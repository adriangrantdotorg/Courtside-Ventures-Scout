"""Round 6: a "View on GitHub" link in the top bar and the footer of every page (10-30-26).

Writes github.html beside this file. The top bar and footer are the live site's own markup (assets/.chrome-live.html,
cut from the homepage 10-30-26) and wear the live CSS (assets/scout-live.css); only the GitHub link changes per option.
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
LIVE = (HERE / "assets/.chrome-live.html").read_text()
HEADER, FOOTER = LIVE.split("<!--FOOT-->")
REPO = "https://github.com/adriangrantdotorg/Courtside-Ventures-Scout"
TIP = "Opens Scout's code on GitHub in a new window"

MARK = ('<svg class="gh" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 '
        '7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-'
        '2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 '
        '1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-'
        '.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-'
        '.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>')
ARROW = ('<svg class="out" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>')


def link(cls, inner=None):
    inner = inner or f"{MARK}<span>View on GitHub</span>"
    return f'<a class="{cls}" href="{REPO}" target="_blank" rel="noopener noreferrer" title="{TIP}">{inner}</a>'


# Where each option's link goes: (in the top bar, in the footer, an optional band above the footer).
OPTIONS = [
    {"id": "A", "name": "Ghost Chip", "tag": "On-Profile: Matches the Bar",
     "desc": "The same outlined chip as Search and the theme switch, first in the tools group. In the footer, a plain "
             "link with the icon, beside Built by. Quiet: it reads as part of Scout's chrome.",
     "top": link("chip gh-a"), "foot": link("gh-a-foot"), "band": ""},
    {"id": "B", "name": "Solid Button", "tag": "Button: GitHub's Own Look",
     "desc": "A filled button in GitHub's colors (white on Night, ink on Day), so it reads as GitHub at a glance. The "
             "footer carries a smaller copy. Red stays the only call to action color.",
     "top": link("gh-b"), "foot": link("gh-b sm"), "band": ""},
    {"id": "C", "name": "Edge Light", "tag": "Button: Stretch, Motion",
     "desc": "An outlined button whose border carries a slow travelling light, Scout's red fading to white. The footer "
             "copy keeps the light only on hover. Motion: the light circles the border once every 10 s, ambient, loops.",
     "top": link("gh-c"), "foot": link("gh-c sm"), "band": ""},
    {"id": "D", "name": "Open Source Band", "tag": "Button: Stretch, Layout",
     "desc": "In the top bar, a tab that matches the page tabs, with an arrow that says it leaves Scout. Above the "
             "footer, a band that tells investors why it matters, with a full button.",
     "top": link("gh-d", f"{MARK}<span>View on GitHub</span>{ARROW}"),
     "foot": link("gh-a-foot"),
     "band": ('<div class="gh-band"><div><b>Scout Is Open Source</b><span>See how every deal is found, scored and '
              'checked, line by line.</span></div>' + link("x-btn gh-d-btn") + "</div>")},
]


def chrome(opt):
    top = HEADER
    if opt["id"] == "D":
        top = top.replace("</nav><div class=\"tools\">", opt["top"] + "</nav><div class=\"tools\">", 1)
    else:
        top = top.replace('<div class="tools">', '<div class="tools">' + opt["top"], 1)
    foot = FOOTER.replace('<span class="right">', '<span class="right">' + opt["foot"], 1)
    assert REPO in top and REPO in foot
    return f"""{top}
<div class="gh-page"><span>Today, Pipeline, IC Meeting and every other page sit here.</span></div>
{opt["band"]}{foot}"""


MANIFEST = {
    "project": "Courtside Ventures", "subject": "View on GitHub link (top bar + footer)", "surface": "layout",
    "claude_rec": "A", "compares": ["visual", "motion", "ux"],
    "options": [
        {"id": "A", "name": "Ghost Chip", "desc": OPTIONS[0]["desc"],
         "tokens": {"visual": {"accent": ["#cc003d"], "energy": "calm", "ornament": "none", "radius": "6",
                               "borders": "hairline", "fonts": {"display": "oswald"}},
                    "motion": [], "ux": {"structure": "inline", "attention_cue": "none"}}},
        {"id": "B", "name": "Solid Button", "desc": OPTIONS[1]["desc"],
         "tokens": {"visual": {"accent": ["#ffffff", "#1f2328"], "energy": "balanced", "ornament": "none",
                               "radius": "6", "borders": "none", "fonts": {"display": "montserrat"}},
                    "motion": [], "ux": {"structure": "button", "attention_cue": "contrast"}}},
        {"id": "C", "name": "Edge Light", "desc": OPTIONS[2]["desc"],
         "tokens": {"visual": {"accent": ["#cc003d", "#ffffff"], "energy": "balanced", "ornament": "edge light",
                               "radius": "10", "borders": "hairline", "fonts": {"display": "montserrat"}},
                    "motion": [{"element": "border", "kind": "orbit", "period_s": 10, "reactivity": "ambient",
                                "trigger": "always", "pace": "slow", "text_moves": False, "path": "edge"}],
                    "ux": {"structure": "button", "attention_cue": "motion"}}},
        {"id": "D", "name": "Open Source Band", "desc": OPTIONS[3]["desc"],
         "tokens": {"visual": {"accent": ["#cc003d"], "energy": "balanced", "ornament": "none", "radius": "10",
                               "borders": "hairline", "fonts": {"display": "oswald"}, "layout": "footer band"},
                    "motion": [], "ux": {"structure": "tabs", "detail": "explained", "attention_cue": "placement"}}},
    ],
}

CSS = """
html, body { background:var(--page); }
.wrap { padding:28px 0 60px; }
.lede { max-width:1100px; margin:0 32px 26px; }
.lede h1 { font:400 30px/1.2 "Bruno Ace", sans-serif; color:var(--heading); margin:0 0 10px; }
.lede p { margin:0 0 8px; font-size:18px; color:var(--text-2); }
.switch { display:flex; gap:8px; margin:16px 0 0; }
.switch button { min-height:44px; padding:0 18px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); font:600 16px Montserrat, sans-serif; cursor:pointer; }
.switch button[aria-pressed="true"] { border-color:var(--red); color:var(--red-ink); }
.opt { margin:0 0 44px; }
.ohead { display:flex; gap:16px; align-items:flex-start; margin:0 32px 14px; max-width:1100px; }
.letter { flex:none; width:48px; height:48px; border-radius:8px; display:grid; place-items:center; background:var(--red); color:#fff; font:400 22px/1 "Bruno Ace", sans-serif; }
.ohead h2 { margin:0 0 4px; font:600 24px/1.2 Oswald, sans-serif; letter-spacing:.04em; text-transform:uppercase; color:var(--heading); }
.ohead h2 small { margin-left:10px; font:600 13px/1 Oswald, sans-serif; letter-spacing:.1em; color:var(--text-3); vertical-align:3px; }
.ohead p { margin:0; font-size:18px; color:var(--text-2); max-width:980px; }
.frame { border-top:1px solid var(--border); border-bottom:1px solid var(--border); background:var(--bg); }
.frame .top { position:relative; }
.frame .tabbar { display:none !important; }
.gh-page { min-height:120px; display:grid; place-items:center; color:var(--text-3); font-size:18px; border-bottom:0; }
.gh-page span { border:1px dashed var(--border); border-radius:10px; padding:16px 22px; }

/* The GitHub link, every option */
svg.gh { width:16px; height:16px; fill:currentColor; flex:none; }
svg.out { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; flex:none; }
a.chip.gh-a, a.gh-a-foot, a.gh-b, a.gh-c, a.gh-d, a.gh-d-btn { text-decoration:none !important; }
/* A */
a.chip.gh-a { color:var(--text-2); }
a.chip.gh-a:hover { color:var(--heading); }
a.gh-a-foot { display:inline-flex; align-items:center; gap:7px; color:var(--red-ink); }
a.gh-a-foot:hover span { text-decoration:underline dotted; text-underline-offset:4px; }
/* B */
a.gh-b { display:inline-flex; align-items:center; gap:8px; min-height:40px; padding:0 14px; border-radius:6px; background:#f6f8fa; color:#1f2328; font:600 15px/1 Montserrat, sans-serif; white-space:nowrap; }
a.gh-b:hover { background:#ffffff; box-shadow:0 0 0 3px rgba(255,255,255,.18); }
html[data-theme="light"] a.gh-b { background:#1f2328; color:#ffffff; }
html[data-theme="light"] a.gh-b:hover { background:#000; box-shadow:0 0 0 3px rgba(31,35,40,.18); }
a.gh-b.sm { min-height:36px; padding:0 12px; font-size:14px; }
/* C */
@property --gh-a { syntax:"<angle>"; inherits:false; initial-value:0deg; }
a.gh-c { position:relative; display:inline-flex; align-items:center; gap:8px; min-height:40px; padding:0 15px; border-radius:10px; color:var(--text); font:600 15px/1 Montserrat, sans-serif; white-space:nowrap; background:var(--elevated); isolation:isolate; }
a.gh-c::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:2px; background:conic-gradient(from var(--gh-a), var(--border) 0deg, var(--border) 200deg, var(--red) 290deg, #fff 345deg, var(--border) 360deg); -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; animation:gh-orbit 10s linear infinite; z-index:-1; }
a.gh-c:hover { box-shadow:0 0 18px var(--glow); }
a.gh-c.sm { min-height:36px; padding:0 12px; font-size:14px; }
a.gh-c.sm::before { animation-play-state:paused; background:var(--border); }
a.gh-c.sm:hover::before { animation-play-state:running; background:conic-gradient(from var(--gh-a), var(--border) 0deg, var(--border) 200deg, var(--red) 290deg, #fff 345deg, var(--border) 360deg); }
html[data-theme="light"] a.gh-c::before { background:conic-gradient(from var(--gh-a), var(--border) 0deg, var(--border) 250deg, var(--red) 310deg, #ff8fae 345deg, var(--border) 360deg); }
html[data-theme="light"] a.gh-c.sm::before { background:var(--border); }
@keyframes gh-orbit { to { --gh-a:360deg; } }
@media (prefers-reduced-motion: reduce) { a.gh-c::before { animation:none; } }
/* D */
.nav > a.gh-d { margin-left:auto; display:inline-flex; align-items:center; gap:8px; padding:22px 10px 20px; font:600 15px/1 Oswald, sans-serif; text-transform:uppercase; letter-spacing:.08em; color:var(--text-2); white-space:nowrap; }
.nav > a.gh-d:hover { color:var(--heading); }
.gh-band { display:flex; align-items:center; gap:18px 28px; flex-wrap:wrap; padding:22px 32px; border-top:1px solid var(--border); background:var(--surface); }
.gh-band > div { flex:1; min-width:260px; }
.gh-band b { display:block; font:600 18px/1.2 Oswald, sans-serif; letter-spacing:.06em; text-transform:uppercase; color:var(--heading); margin:0 0 4px; }
.gh-band span { font-size:18px; color:var(--text-2); }
"""

JS = """
(function(){
  var at = new URLSearchParams(location.search).get('at');
  if (at !== null) { var s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation-delay:-' + parseFloat(at) + 's !important;animation-play-state:paused !important}'; document.head.appendChild(s); }
  var t = new URLSearchParams(location.search).get('theme');
  if (t) document.documentElement.dataset.theme = t;
  document.querySelectorAll('.switch button').forEach(function(b){
    b.setAttribute('aria-pressed', String(b.dataset.t === (document.documentElement.dataset.theme || 'dark')));
    b.addEventListener('click', function(){
      document.documentElement.dataset.theme = b.dataset.t;
      document.querySelectorAll('.switch button').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
})();
"""


def card(o):
    return f"""<section class="opt" data-variation="{o["id"]}" id="opt-{o["id"]}">
  <div class="ohead"><div class="letter">{o["id"]}</div><div><h2>{o["name"]}<small>{o["tag"]}</small></h2><p>{o["desc"]}</p></div></div>
  <div class="frame">{chrome(o)}</div>
</section>"""


page = f"""<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scout · View on GitHub</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bruno+Ace&family=Oswald:wght@500;600;700&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/scout-live.css">
<style>{CSS}</style>
<script type="application/json" id="variation-manifest">{json.dumps(MANIFEST)}</script>
</head><body><div class="wrap">
<div class="lede"><h1>View on GitHub: Four Looks</h1>
<p>Each option is the live site's real top bar and footer, with the link added. Every link opens the public repo in a new window.</p>
<p>On the Day theme the colors flip. I recommend <b>A</b>: it fits the bar without competing with Visit Website.</p>
<div class="switch"><button data-t="dark">Night</button><button data-t="light">Day</button></div></div>
{"".join(card(o) for o in OPTIONS)}
</div><script>{JS}</script></body></html>"""

json.loads(json.dumps(MANIFEST))
(HERE / "github.html").write_text(page)
print("wrote", HERE / "github.html")
