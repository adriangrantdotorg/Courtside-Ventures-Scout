"""Round 5: Must See masthead art for a startup with no picture (Helios Intelligence, 10-30-26).

Writes masthead.html beside this file. The masthead markup is the live site's own (assets/.hero-live.html, cut from
the homepage 10-30-26); only the picture layer changes per option. Every picture is built from what heliosinc.ai
publishes: the ring mark and lockup (/brand/*.svg), its cypress and cream colors, and its painted sky.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
LIVE = (HERE / "assets/.hero-live.html").read_text()

# The live article, with its broken picture removed and remote images swapped for the copies beside the page.
article = LIVE[LIVE.index("<article"):]
article = re.sub(r'<div class="x-media"[^>]*>.*?</div>', "{MEDIA}", article, count=1, flags=re.S)
article = article.replace('src="https://heliosinc.ai/apple-icon.png?apple-icon.10h65wtk.19qa.png?dpl=dpl_HarKFHNbs6PAQKR2MMNHP5MUb7Jx"', 'src="assets/helios-icon.png"')
article = article.replace('src="https://www.google.com/s2/favicons?sz=64&amp;domain=rythmhealth.com"', 'src="assets/rythm.png"')
article = article.replace('data-live="ago"></span>', 'data-live="ago">3d ago</span>')
article = article.replace('href="/company/515"', 'href="#"')
assert "{MEDIA}" in article and "assets/helios-icon.png" in article and "3d ago" in article

NOW = '<div class="x-media" data-kind="mp4"><div class="m-now"><span>H</span></div></div>'

A = """<div class="x-media" data-kind="mp4"><div class="m-a">
  <img class="ripple r1" src="assets/helios-mark-cream.svg" alt="">
  <img class="ripple r2" src="assets/helios-mark-cream.svg" alt="">
  <img class="mark" src="assets/helios-mark-cream.svg" alt="Helios Intelligence">
</div></div>"""

B = """<div class="x-media" data-kind="mp4"><div class="m-b">
  <img class="field" src="assets/helios-mark-cream.svg" alt="">
  <img class="lock" src="assets/helios-mark-cream.svg" alt="Helios Intelligence">
</div></div>"""

C = """<div class="x-media" data-kind="mp4"><div class="m-c">
  <img class="sky" src="assets/helios-clouds.jpg" alt="">
  <div class="sun"></div>
  <img class="lockup" src="assets/helios-lockup-cypress.svg" alt="Helios Intelligence">
</div></div>"""

OPTIONS = [
    ("A", "Ring Pulse", "On-Profile",
     "The ring mark sits large on Helios's own cypress green, with a slow cream glow, and a soft echo of the rings "
     "travels outward like a heartbeat.",
     "Breathing glow every 6 s; an echo ring leaves the mark every 4 s (each travels for 8 s). Ambient, loops.",
     "Helios's logo (SVG or large icon) and its main color. Works for any startup with a logo."),
    ("B", "Contour Field", "Stretch: Pattern",
     "The mark blown up past the frame, so its rings sweep the whole masthead like a topographic map, quiet "
     "enough to read the name over it. A crisp copy of the mark anchors the right side.",
     "The field drifts very slowly (one cycle every 60 s). Ambient, loops.",
     "Helios's logo and its main color. Best for marks made of lines or rings."),
    ("C", "Brand Sky", "Stretch: Light and Warm",
     "Helios's own painted sky from heliosinc.ai, with its green lockup in the open sky on the right. The "
     "masthead wears the startup's real brand world, not one Scout made up.",
     "The clouds drift sideways very slowly (one cycle every 70 s). Ambient, loops.",
     "The site's own hero art plus the logo. Only for startups whose site has hero art."),
]

MANIFEST = {
    "project": "Courtside Ventures",
    "subject": "Must See masthead art for a startup with no picture",
    "surface": "media",
    "claude_rec": "A",
    "compares": ["media", "visual.accent", "motion"],
    "options": [
        {"id": "A", "name": "Ring Pulse", "desc": "the brand mark large on its brand color, glow breathes, echo rings travel out",
         "tokens": {"visual": {"accent": ["#FBF7EA"], "bg": "#0F3323", "energy": "calm", "ornament": "edge light"},
                    "media": {"kind": "logo-art", "color_source": "brand", "placement": "right", "glow_shape": "halo"},
                    "motion": [{"element": "glow", "kind": "breathe", "period_s": 6, "reactivity": "ambient", "trigger": "idle", "pace": "slow", "text_moves": False},
                               {"element": "ring", "kind": "ripple", "period_s": 8, "reactivity": "ambient", "trigger": "idle", "pace": "slow", "text_moves": False, "path": "radial"}]}},
        {"id": "B", "name": "Contour Field", "desc": "the mark enlarged past the frame as a full-bleed contour pattern",
         "tokens": {"visual": {"accent": ["#FBF7EA"], "bg": "#0F3323", "energy": "calm", "ornament": "motif"},
                    "media": {"kind": "logo-pattern", "color_source": "brand", "placement": "full-bleed"},
                    "motion": [{"element": "background", "kind": "drift", "period_s": 60, "reactivity": "ambient", "trigger": "idle", "pace": "slow", "text_moves": False}]}},
        {"id": "C", "name": "Brand Sky", "desc": "the startup's own site art with its lockup, light and warm",
         "tokens": {"visual": {"accent": ["#0F3323"], "base": "light", "energy": "calm", "text_temperature": "warm"},
                    "media": {"kind": "site-art", "color_source": "site", "placement": "full-bleed"},
                    "motion": [{"element": "background", "kind": "drift", "period_s": 70, "reactivity": "ambient", "trigger": "idle", "pace": "slow", "text_moves": False}]}},
    ],
}


def card(media: str) -> str:
    return article.replace("{MEDIA}", media)


def section(media: str) -> str:
    return ('<section class="x-sec" aria-label="Must See"><div class="x-sech"><h2 class="x-h2">Must See</h2>'
            '<span class="x-count">The Highest Thesis-Fit Startup Recently in the News</span></div>' + card(media) + "</section>")


CSS = """
:root{--cy:#0F3323;--cream:#FBF7EA}
body{background:var(--bg,#0b0b0e);margin:0}
.pg{max-width:1500px;margin:0 auto;padding:40px 32px 120px;font:18px/1.55 Montserrat,sans-serif;color:var(--text,#e8e8ee)}
.pg h1{font:600 40px/1.1 Oswald,sans-serif;letter-spacing:.02em;margin:0 0 12px;color:var(--heading,#fff)}
.lede{max-width:980px;margin:0 0 12px;color:var(--text-2,#c9c9d3)}
.lede b{color:var(--heading,#fff)}
.opt{margin:56px 0 0}
.opt-h{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 6px}
.opt-h .id{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:10px;background:#1b1b22;border:1px solid #33333d;font:700 22px/1 Oswald,sans-serif;color:#fff}
.opt-h h2{font:600 30px/1.1 Oswald,sans-serif;margin:0;color:#fff}
.opt-h .tag{font:600 14px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;padding:7px 10px;border-radius:6px;border:1px solid #3a3a46;color:#c9c9d3}
.opt-h .tag.rec{border-color:#1ed760;color:#1ed760}
.opt p{margin:4px 0;max-width:1100px;color:#c9c9d3}
.opt p b{color:#fff}
.opt .x-sec{margin-top:18px}
.ref .x-tile{opacity:.92}

/* Now: the live fallback */
.m-now{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(80% 120% at 50% 0,#2a2a31 0,#111114 60%,#0c0c0f 100%)}
.m-now span{display:grid;place-items:center;width:16%;aspect-ratio:1;border-radius:22%;background:#1e1e23;border:1px solid #2c2c33;font:700 64px/1 Oswald,sans-serif;color:#bdbdc4;margin-bottom:6%}

/* A: Ring Pulse */
.m-a{position:absolute;inset:0;background:radial-gradient(60% 95% at 79% 38%,#1f5c40 0%,#123d2b 38%,var(--cy) 62%,#07140d 100%)}
.m-a img{position:absolute;left:79%;top:38%;height:54%;transform:translate(-50%,-50%)}
.m-a .mark{animation:a-glow 6s ease-in-out infinite;filter:drop-shadow(0 0 18px rgba(251,247,234,.18))}
.m-a .ripple{opacity:0;animation:a-ripple 8s cubic-bezier(.2,.6,.3,1) infinite}
.m-a .r2{animation-delay:-4s}
@keyframes a-glow{0%,100%{filter:drop-shadow(0 0 14px rgba(251,247,234,.14))}50%{filter:drop-shadow(0 0 42px rgba(251,247,234,.42))}}
@keyframes a-ripple{0%{opacity:.30;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}

/* B: Contour Field */
.m-b{position:absolute;inset:0;background:linear-gradient(115deg,#07140d 0%,var(--cy) 45%,#174a33 100%);overflow:hidden}
.m-b .field{position:absolute;left:66%;top:46%;height:300%;opacity:.17;transform:translate(-50%,-50%) rotate(0deg);animation:b-drift 60s ease-in-out infinite}
.m-b .lock{position:absolute;left:66%;top:46%;height:30%;transform:translate(-50%,-50%);filter:drop-shadow(0 0 24px rgba(7,20,13,.9))}
@keyframes b-drift{0%,100%{transform:translate(-50%,-50%) rotate(0deg) scale(1)}50%{transform:translate(-48%,-52%) rotate(6deg) scale(1.05)}}

/* C: Brand Sky */
.m-c{position:absolute;inset:0;overflow:hidden;background:#cfd9ea}
.m-c .sky{position:absolute;top:0;left:0;height:100%;width:116%;object-fit:cover;object-position:center 62%;animation:c-drift 70s ease-in-out infinite}
.m-c:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,8,10,.62) 0,rgba(8,8,10,.35) 38%,transparent 62%)}
.m-c .sun{position:absolute;inset:0;background:radial-gradient(45% 70% at 8% 0,rgba(255,244,214,.55),transparent 70%)}
.m-c .lockup{position:absolute;left:70%;top:30%;width:28%;transform:translate(-50%,-50%)}
@keyframes c-drift{0%,100%{transform:translateX(0)}50%{transform:translateX(-12%)}}

@media (prefers-reduced-motion:reduce){.m-a *,.m-b *,.m-c *{animation:none!important}}
.frozen *{animation-play-state:paused!important}
"""

# ?at=<seconds> freezes every animation at that moment, for headless frame checks.
FREEZE = """<script>
(function(){var at=parseFloat(new URLSearchParams(location.search).get('at'));if(isNaN(at))return;
document.documentElement.classList.add('frozen');
document.querySelectorAll('.m-a *,.m-b *,.m-c *').forEach(function(el){var d=parseFloat(getComputedStyle(el).animationDelay)||0;el.style.animationDelay=(d-at)+'s';});})();
</script>"""


def opt_html(o):
    oid, name, tag, what, motion, needs = o
    rec = ' <span class="tag rec">Recommended</span>' if oid == MANIFEST["claude_rec"] else ""
    media = {"A": A, "B": B, "C": C}[oid]
    return (f'<div class="opt" data-variation="{oid}" id="opt-{oid}"><div class="opt-h"><span class="id">{oid}</span>'
            f'<h2>{name}</h2><span class="tag">{tag}</span>{rec}</div>'
            f"<p>{what}</p><p><b>Motion:</b> {motion}</p><p><b>Scout Needs:</b> {needs}</p>"
            + section(media) + "</div>")


page = f"""<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Helios Masthead Variations</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bruno+Ace&family=Oswald:wght@500;600;700&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="scout-live.css"><style>{CSS}</style></head><body><div class="pg">
<h1>Must See: Art for a Startup With No Picture</h1>
<p class="lede">Helios Intelligence has no product shot, so today the masthead falls back to a gray <b>H</b>. Each option
below builds the picture from <b>heliosinc.ai</b> itself: its ring logo, its cypress green and cream, and its painted sky.
Only the picture changes; the words, buttons and layout are the live site's own markup.</p>
<div class="opt ref"><div class="opt-h"><h2>Now</h2><span class="tag">Live Today</span></div>
<p>The fallback letter tile on a gray field.</p>{section(NOW)}</div>
{''.join(opt_html(o) for o in OPTIONS)}
</div>
<script type="application/json" id="variation-manifest">{json.dumps(MANIFEST)}</script>
{FREEZE}</body></html>"""

json.loads(page.split('id="variation-manifest">')[1].split("</script>")[0])
(HERE / "masthead.html").write_text(page)
print("wrote", HERE / "masthead.html")
