#!/usr/bin/env python3
"""Builds design/scout-v2-cards.html: four company-card designs for Scout V2.

Every design renders the same companies with the same parts (visual, website,
Funds Raised, one "why" paragraph, latest signal, fit, actions) in three places:
Today, the Pipeline, and the top of a company page. Content is static HTML;
the inline script only wires up clicks (play, full screen, menus, mode).

Run: python3 design/v2-cards/build.py
"""
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "scout-v2-cards.html"
A = "v2-cards/"  # assets path, relative to the page

LAST_VISIT = "10-18-26"

# ---------------------------------------------------------------- data
# Real companies and facts from Scout's database (10-25-26) and their own
# sites. Troveo is not in Scout yet: it shows two sources that disagree.
C = {
    "idl": dict(
        name="International Dance League", area="Sports", fit=51, new=True,
        logo=A + "idl-logo.png", site="idl.pro",
        media=dict(kind="yt", poster=A + "idl-og.jpg", yt="TtM_Yk6pvkM",
                   label="How the league works", src="YouTube"),
        funds=dict(kind="known", amt="$22M", stage="Series A", note="2 rounds",
                   sources=[("Business Wire", "$15M Series A", "10-21-26", "https://www.bastillepost.com/global/article/6276162-idl-raises-15-million-in-series-a-funding-round-led-by-elysian-park-ventures"),
                            ("Pulse 2.0", "$7M Seed", "Nov 2025", "https://pulse2.com/idl-7-million-seed-funding-raised-to-launch-global-professional-dance-league")]),
        why="Six pro teams, five global stages and an ESPN2 deal after a sold-out first season: 6 of 6 events, 2B views. Sony and Yamaha's music fund joined Elysian Park in the Series A.",
        tie="Near Veo",
        signal=dict(src="Axios + 2 more", ago="4d ago", date="10-21-26", url="https://news.google.com/rss/articles/CBMifEFVX3lxTE1jTTgzVkJTeVliUnZDblJoNHhXaGY4U0JqMUE1amRleGFFZ2x"),
        rounds=[("Series A", "$15M", "10-21-26", "Elysian Park Ventures (lead), Sony, Yamaha Music Innovations Fund, KB Partners, APEX, October Ventures"),
                ("Seed", "$7M", "Nov 2025", "Elysian Park Ventures (lead)")],
        news=[("Axios", "International Dance League raises $15M after sold out inaugural season", "10-21-26"),
              ("Sports Business Journal", "International Dance League raises $15M Series A", "10-21-26"),
              ("citybiz", "International Dance League raises $15 million Series A led by Elysian Park Ventures", "10-21-26")],
    ),
    "sleepsense": dict(
        name="SleepSense", area="Health", fit=57, new=False,
        logo=A + "sleepsense-icon.jpg", site=None,
        search="https://www.google.com/search?q=SleepSense+sleep+tracker+Dualstar",
        appstore="https://apps.apple.com/us/app/sleepsense-sleep-tracker/id6791916451",
        media=dict(kind="shots", shots=[A + "sleepsense-1.jpg", A + "sleepsense-2.jpg", A + "sleepsense-3.jpg"],
                   label="App Store screenshots", src="App Store"),
        funds=dict(kind="none", amt="Not yet public", stage=None, note="No raise on record", sources=[]),
        why="Sleep tracking from an iPhone on the nightstand, no wearable needed. Jumped from #69 to #35 in Health & Fitness with 4.2★ from 464 ratings. Near Rythm Health in the portfolio.",
        tie="Near Rythm Health",
        signal=dict(src="App Store chart climb", ago="11d ago", date="10-14-26", url="https://apps.apple.com/us/app/sleepsense-sleep-tracker/id6791916451"),
    ),
    "tash": dict(
        name="tash", area="Lifestyle", fit=48, new=False,
        logo=A + "tash-logo.png", site="tradetash.com",
        media=dict(kind="site", img=A + "tash-og.jpg", label="From tradetash.com", src="Website"),
        funds=dict(kind="est", amt="$500K", stage="Pre-Seed", note="YC standard deal",
                   sources=[("Y Combinator", "Summer 2026 batch; YC's standard deal is $500K", "07-31-26", "https://www.ycombinator.com/companies/tash")]),
        why="Investment-grade portfolios of sports and trading cards, pitched as the BlackRock of collectibles. Overlaps with Kolex in the portfolio.",
        tie="Overlaps Kolex",
        signal=dict(src="Y Combinator", ago="2mo ago", date="07-31-26", url="https://www.ycombinator.com/companies/tash"),
    ),
    "axo": dict(
        name="Axo Longevity", area="Health", fit=53, new=False,
        logo=A + "axolongevity-fav.png", site="axolongevity.com",
        media=dict(kind="logo", dark=A + "axo-logo-white.png", light=A + "axo-logo-dark.png",
                   label="Logo · no product images found", src="Logo"),
        funds=dict(kind="known", amt="$5M", stage="Seed", note="",
                   sources=[("AFP", "$5M Seed, oversubscribed", "09-15-26", "https://news.google.com/rss/articles/CBMiS0FVX3lxTFBxQmdTcFRISFpVQ0l3Ylo4Z1hpS1R1bXhwM0RMTEhiRzhaXzF"),
                            ("Dealroom", "$5M Seed", "09-15-26", "https://news.google.com/rss/articles/CBMitgFBVV95cUxPTTVOSC1CRGdYSzA3TW1GNmRuNHV1c2pEYTZQOWdDNnVSaUl")]),
        why="A preventive-health membership: 100+ biomarkers twice a year plus a coaching plan, €490 a year. Oversubscribed seed; overlaps with Eternal in the portfolio.",
        tie="Overlaps Eternal",
        signal=dict(src="AFP + Dealroom", ago="1mo ago", date="09-15-26", url="https://news.google.com/rss/articles/CBMiS0FVX3lxTFBxQmdTcFRISFpVQ0l3Ylo4Z1hpS1R1bXhwM0RMTEhiRzhaXzF"),
    ),
    "anoria": dict(
        name="ANORIA", area="Health", fit=51, new=False,
        logo=A + "anoria-fav.png", site="anoria.com",
        media=dict(kind="mp4", poster=A + "anoria-poster.jpg", mp4="https://anoria-cdn.b-cdn.net/anoria-launch-vo-1440.mp4",
                   label="Launch film · 1:07", src="anoria.com"),
        funds=dict(kind="est", amt="$500K", stage="Pre-Seed", note="YC standard deal",
                   sources=[("Y Combinator", "Spring 2026 batch; YC's standard deal is $500K", "05-05-26", "https://www.ycombinator.com/companies/anoria")]),
        why="A wearable that reads your emotions in real time and coaches your EQ. Overlaps with Signos in the portfolio.",
        tie="Overlaps Signos",
        signal=dict(src="Y Combinator", ago="5mo ago", date="05-05-26", url="https://www.ycombinator.com/companies/anoria"),
    ),
    "spash": dict(
        name="Spash", area="Sports", fit=47, new=False,
        logo=A + "spash-logo.jpg", site="spash.com",
        media=dict(kind="mp4", poster=A + "spash-poster.jpg", mp4="https://spash.com/wp-content/uploads/2024/07/PADELSHOt.mp4",
                   label="Court camera clip · 0:30", src="spash.com"),
        funds=dict(kind="known", amt="€2M", stage="Series A", note="",
                   sources=[("Dealroom", "€2M Series A", "10-12-26", "https://news.google.com/rss/articles/CBMilwFBVV95cUxQWXAtUzBCRjA1V0V6a1ZVUU1XY2xyaW5kaEdmbzR6VmRxMzY")]),
        why="AI cameras, replays and stats for padel clubs, one of the fastest-growing racquet sports. A €2M round sits right in Courtside's check range.",
        tie=None,
        signal=dict(src="Dealroom", ago="13d ago", date="10-12-26", url="https://news.google.com/rss/articles/CBMilwFBVV95cUxQWXAtUzBCRjA1V0V6a1ZVUU1XY2xyaW5kaEdmbzR6VmRxMzY"),
    ),
    "topdog": dict(
        name="Topdog", area="Gaming", fit=47, new=False,
        logo=A + "topdog-fav.png", site="topdog.games",
        media=dict(kind="site", img=A + "topdog-og.jpg", label="From topdog.games", src="Website"),
        funds=dict(kind="known", amt="$2.5M", stage="Seed", note="",
                   sources=[("Pulse 2.0", "$2.5M Seed", "10-02-26", "https://news.google.com/rss/articles/CBMimgFBVV95cUxQdmx4R09oTEpLNXVndC1EcE9LUk1KdkN2ZXdZM194UHZwQWN"),
                            ("citybiz", "$2.5M", "09-24-26", "https://news.google.com/rss/articles/CBMipAFBVV95cUxOajdDM3VpeFNzVDl5ejlnWDFhS3FhWHFjUmJ5YWJvU0RGUDc"),
                            ("Yahoo Finance", "$2.5M Seed", "09-23-26", "https://news.google.com/rss/articles/CBMilAFBVV95cUxOZDJxaE9QSWo5X0dHSGtqU0pfSEJSUmhGQTZFVEdweGVQM1N")]),
        why="Head-to-head skill games for real cash, live in 45 states with 4.6★ on the App Store. FanDuel's investors are in; overlaps with Eloelo in the portfolio.",
        tie="Overlaps Eloelo",
        signal=dict(src="Pulse 2.0 + 2 more", ago="3w ago", date="10-02-26", url="https://news.google.com/rss/articles/CBMimgFBVV95cUxQdmx4R09oTEpLNXVndC1EcE9LUk1KdkN2ZXdZM194UHZwQWN"),
    ),
    "troveo": dict(
        name="Troveo", area="Media", fit=None, new=False, outside=True,
        logo=A + "troveo-fav.png", site="troveo.ai",
        media=dict(kind="site", img=A + "troveo-og.jpg", label="Logo · no product images found", src="Logo"),
        funds=dict(kind="range", amt="$4.5–7.1M", stage="Seed", note="",
                   sources=[("The AI Insider", "$4.5M Seed", "11-03-24", "https://theaiinsider.tech/2024/11/03/troveo-raises-4-5m-to-scale-platform-helping-filmmakers-and-creators-monetize-in-the-era-of-ai/"),
                            ("Preqin", "$7.1M Seed", "Oct 2025", "https://www.preqin.com/data/profile/asset/troveo-ai--inc-/710965")]),
        why="Pays creators and studios to license their footage to AI labs: more than $20M paid out and 8M+ hours licensed. Seven Seven Six led the seed.",
        tie=None,
        signal=dict(src="Your Library of Links", ago="not in Scout yet", date="10-25-26", url="https://theaiinsider.tech/2024/11/03/troveo-raises-4-5m-to-scale-platform-helping-filmmakers-and-creators-monetize-in-the-era-of-ai/"),
    ),
    "affinity": dict(
        name="Affinity Labs", area="Media", fit=47, new=True,
        logo=A + "affinity-fav.png", site="affinitylabs.ai",
        media=dict(kind="mp4", poster=A + "affinity-poster.jpg", back=A + "affinity-og.jpg", portrait=True,
                   mp4="https://affinitylabs.ai/video/idc-demo.mp4", label="App demo · 0:42", src="affinitylabs.ai"),
        funds=dict(kind="known", amt="$2M", stage="Pre-Seed", note="",
                   sources=[("Pulse 2.0", "$2M Pre-Seed led by Fuel Ventures", "10-20-26", "https://news.google.com/rss/articles/CBMiuAFBVV95cUxPMXl0emQ0WG1pWlVsSGpFb1JySzRITkxWODhoRF92Wmk5MzF"),
                            ("Tech Funding News", "$2M", "10-14-26", "https://news.google.com/rss/articles/CBMinwFBVV95cUxOUE9sSHJQbm1yZWFGNHBrT3VkRDdsU1oxRHl3QWtRNWJrWk0"),
                            ("Dealroom", "$2M", "10-14-26", "https://news.google.com/rss/articles/CBMingFBVV95cUxPcFNMeGhVUmlTa2twdlRXdnE1MS1MdnAzNEFOWUtScklXM09"),
                            ("Konsulteer", "$2M", "10-14-26", "https://news.google.com/rss/articles/CBMiuAFBVV95cUxQU1UwNTEwb1ZwN0FnMjlyLVdjdllmaUhIVjlwNFJnOWllcER")]),
        why="Builds software companies with category-defining creators, pitched as Bending Spoons for creator-led apps. Fuel Ventures led the pre-seed.",
        tie=None,
        signal=dict(src="Pulse 2.0 + 3 more", ago="5d ago", date="10-20-26", url="https://news.google.com/rss/articles/CBMiuAFBVV95cUxPMXl0emQ0WG1pWlVsSGpFb1JySzRITkxWODhoRF92Wmk5MzF"),
    ),
}
TODAY = ["idl", "sleepsense", "tash", "axo"]
PIPE = ["affinity", "anoria", "spash", "topdog", "troveo"]
PAGE = "idl"

# ---------------------------------------------------------------- icons
ICONS = {
    "play": '<path d="M7 4.5v15l12.5-7.5z"/>',
    "full": '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    "ext": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "pin": '<path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    "down": '<path d="m6 9 6 6 6-6"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    "video": '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    "image": '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-2.8 0L6 21"/>',
    "phone": '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    "badge": '<path d="M3.9 8.6a4 4 0 0 1 4.8-4.8 4 4 0 0 1 6.7 0 4 4 0 0 1 4.8 4.8 4 4 0 0 1 0 6.7 4 4 0 0 1-4.8 4.8 4 4 0 0 1-6.7 0 4 4 0 0 1-4.8-4.8 4 4 0 0 1 0-6.7Z"/>',
    "news": '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
    "alert": '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
}


def ico(name, cls="ico"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


def e(s):
    return html.escape(s or "", quote=True)


# ---------------------------------------------------------------- shared parts
def media(c, overlay=False):
    """The product visual plus its bar. Controls live in the bar, never on the picture."""
    m = c["media"]
    k = m["kind"]
    tier_icon = {"yt": "video", "mp4": "video", "shots": "phone", "site": "image", "logo": "badge"}[k]
    attrs = f'data-kind="{k}"'
    if k == "yt":
        inner = f'<img class="cover" src="{m["poster"]}" alt="{e(c["name"])}: {e(m["label"])}" loading="lazy">'
        attrs += f' data-yt="{m["yt"]}"'
    elif k == "mp4":
        back = f'<img class="back" src="{m["back"]}" alt="" loading="lazy">' if m.get("back") else ""
        fit = "contain" if m.get("portrait") else "cover"
        inner = f'{back}<img class="{fit}" src="{m["poster"]}" alt="{e(c["name"])}: {e(m["label"])}" loading="lazy">'
        attrs += f' data-mp4="{m["mp4"]}" data-fit="{fit}"' + ("" if overlay else ' data-hover="1"')
    elif k == "shots":
        inner = '<div class="shots">' + "".join(f'<img src="{s}" alt="{e(c["name"])} screenshot" loading="lazy">' for s in m["shots"]) + "</div>"
    elif k == "site":
        inner = (f'<img class="back blur" src="{m["img"]}" alt="" loading="lazy">'
                 f'<img class="contain" src="{m["img"]}" alt="{e(c["name"])}: {e(m["label"])}" loading="lazy">')
    else:
        f = c["funds"]
        badge = f'<span class="lbadge">{e(f["amt"])}{" · " + e(f["stage"]) if f.get("stage") else ""}</span>' if f["kind"] != "none" else ""
        inner = (f'<div class="logostage"><img class="lg lg-dark" src="{m["dark"]}" alt="{e(c["name"])} logo">'
                 f'<img class="lg lg-light" src="{m["light"]}" alt="">{badge}</div>')
    ctl = ""
    if k in ("yt", "mp4"):
        ctl = (f'<span class="mctl"><button class="mb play" type="button" title="Play with sound">{ico("play")}<span>Play</span></button>'
               f'<button class="mb fs" type="button" title="Full screen (or double-click the video)">{ico("full")}<span>Full screen</span></button></span>')
    bar = f'<div class="mbar"><span class="msrc">{ico(tier_icon)}<span>{e(m["label"])}<em> · {e(m["src"])}</em></span></span>{ctl}</div>'
    return f'<div class="media" {attrs}>{inner}</div>', bar


def funds(c, size=""):
    f = c["funds"]
    k = f["kind"]
    amt_cls = {"known": "", "est": " est", "range": " range", "none": " none"}[k]
    stage = f'<span class="stage">{e(f["stage"])}</span>' if f.get("stage") else ""
    warn = ico("alert", "ico warn") if k == "range" else ""
    src = ""
    if f["sources"]:
        n = len(f["sources"])
        verdict = " disagree" if k == "range" else (" agree" if n > 1 else "")
        items = "".join(
            f'<li><a href="{e(u)}" target="_blank" rel="noopener">{e(who)}</a><span>{e(what)}</span><time>{e(d)}</time></li>'
            for who, what, d, u in f["sources"])
        src = (f'<span class="pop"><button class="srcbtn" type="button" aria-expanded="false">{ico("info")}'
               f'{n} source{"s" if n > 1 else ""}{verdict}{ico("down")}</button>'
               f'<span class="popbox" hidden><b>Where this number comes from</b><ul>{items}</ul></span></span>')
    return (f'<div class="funds {size}"><span class="flabel">Funds Raised</span>'
            f'<span class="amt{amt_cls}">{e(f["amt"])}</span>'
            f'<span class="fsub">{stage}{warn}{"<span>" + e(f["note"]) + "</span>" if f["note"] else ""}{src}</span></div>')


def website(c, big=False):
    cls = "btn site big" if big else "btn site"
    if c.get("site"):
        return f'<a class="{cls}" href="https://{c["site"]}" target="_blank" rel="noopener">{ico("ext")}<span>Visit website</span><span class="dom">{e(c["site"])}</span></a>'
    out = f'<a class="{cls} none" href="{e(c["search"])}" target="_blank" rel="noopener" title="No official website found yet">{ico("search")}<span>Search for website</span></a>'
    if c.get("appstore"):
        out += f'<a class="btn ghost" href="{e(c["appstore"])}" target="_blank" rel="noopener">{ico("phone")}<span>App Store</span></a>'
    return out


def more():
    items = ["Draft Investment Memo", "Connection Email", "Add Note", "Copy for CRM", "Download CSV"]
    return ('<span class="pop"><button class="btn ghost morebtn" type="button" aria-expanded="false"><span>More</span>'
            f'{ico("down")}</button><span class="popbox menu" hidden>'
            + "".join(f'<button type="button">{i}</button>' for i in items) + "</span></span>")


def votes():
    return ('<span class="votes"><button type="button" class="up" title="This fits Courtside">▲</button>'
            '<b>0</b><button type="button" class="dn" title="Not for Courtside">▼</button></span>')


def track():
    return f'<button class="btn track" type="button" aria-pressed="false">{ico("pin")}<span>Track</span></button>'


def actions(c, big=False):
    return f'<div class="acts">{website(c, big)}{track()}{votes()}{more()}</div>'


def signal(c):
    s = c["signal"]
    return (f'<a class="sig" href="{e(s["url"])}" target="_blank" rel="noopener">{ico("news")}'
            f'<span>{e(s["src"])}</span><time title="{e(s["date"])}">{e(s["ago"])}</time></a>')


def fit(c):
    if c.get("fit") is None:
        return '<span class="fit out">Not in Scout yet</span>'
    return f'<span class="fit" title="Thesis fit"><b>{c["fit"]}%</b> fit</span>'


def head(c, big=False):
    new = '<span class="newb">New</span>' if c.get("new") else ""
    tie = f'<span class="tie">{e(c["tie"])}</span>' if c.get("tie") else ""
    return (f'<div class="chead"><img class="logo" src="{c["logo"]}" alt="">'
            f'<div class="cname"><h3 class="name{" big" if big else ""}">{e(c["name"])}</h3>'
            f'<div class="tags"><span class="area">{e(c["area"])}</span>{new}{tie}</div></div>{fit(c)}</div>')


def why(c):
    return f'<p class="why">{e(c["why"])}</p>'


def rounds(c):
    rows = "".join(f'<tr><td class="r-st">{e(st)}</td><td class="r-amt">{e(a)}</td><td class="r-date">{e(d)}</td><td class="r-inv">{e(inv)}</td></tr>'
                   for st, a, d, inv in c["rounds"])
    return ('<table class="rounds"><thead><tr><th>Round</th><th>Amount</th><th>Date</th><th>Investors</th></tr></thead>'
            f'<tbody>{rows}</tbody></table>')


def newslist(c):
    return '<ul class="newslist">' + "".join(
        f'<li>{ico("news")}<span><b>{e(src)}</b> {e(t)}</span><time>{e(d)}</time></li>' for src, t, d in c["news"]) + "</ul>"


def place(n, label, body):
    return f'<div class="place"><div class="plabel"><span>{n}</span>{label}</div>{body}</div>'


# ---------------------------------------------------------------- A · Feed
def cardA(c):
    m, bar = media(c)
    return (f'<article class="cardA">{m}{bar}<div class="body">{head(c)}{funds(c, "inline")}{why(c)}'
            f'<div class="foot">{signal(c)}</div>{actions(c, True)}</div></article>')


def rowA(c):
    m, bar = media(c)
    return (f'<article class="rowA"><div class="thumb">{m}{bar}</div><div class="mid">{head(c)}{why(c)}{signal(c)}</div>'
            f'<div class="side">{funds(c)}{website(c)}<div class="mini">{track()}{more()}</div></div></article>')


def pageA(c):
    m, bar = media(c)
    return (f'<article class="pageA"><div class="hero">{m}{bar}</div><div class="pbody">{head(c, True)}'
            f'<div class="prow">{funds(c, "xl")}{actions(c, True)}</div>{why(c)}'
            f'<h4 class="sub">Funds Raised history</h4>{rounds(c)}<h4 class="sub">Latest signals</h4>{newslist(c)}</div></article>')


# ---------------------------------------------------------------- B · Tile
def tileB(c):
    m, bar = media(c, overlay=True)
    f = c["funds"]
    stage = f' · {e(f["stage"])}' if f.get("stage") else ""
    site = (f'<a class="sitepill" href="https://{c["site"]}" target="_blank" rel="noopener">{ico("ext")}<span>{e(c["site"])}</span></a>'
            if c.get("site") else f'<a class="sitepill none" href="{e(c["search"])}" target="_blank" rel="noopener">{ico("search")}<span>Find website</span></a>')
    new = '<span class="newb">New</span>' if c.get("new") else ""
    return (f'<article class="tileB" tabindex="0"><div class="tmedia">{m}<div class="scrim"></div>'
            f'<div class="tl">{fit(c)}</div><div class="tr">{site}</div>'
            f'<div class="over"><div class="tags"><span class="area">{e(c["area"])}</span>{new}</div>'
            f'<h3 class="name">{e(c["name"])}</h3><div class="tfunds"><span class="amt{" none" if f["kind"]=="none" else ""}">{e(f["amt"])}</span><span>{stage.lstrip(" · ")}</span></div>'
            f'<div class="reveal"><div>{why(c)}{signal(c)}<div class="acts">{track()}{votes()}{more()}</div></div></div></div></div>{bar}</article>')


def rowB(c):
    m, bar = media(c, overlay=True)
    return (f'<article class="rowB"><div class="bmedia">{m}<div class="bscrim"></div><div class="bover">{head(c)}{why(c)}{signal(c)}</div></div>'
            f'<div class="bside">{funds(c)}{website(c)}<div class="mini">{track()}{more()}</div></div>{bar}</article>')


def pageB(c):
    m, bar = media(c, overlay=True)
    return (f'<article class="pageB"><div class="phero">{m}<div class="scrim"></div><div class="over">'
            f'<div class="tags"><span class="area">{e(c["area"])}</span><span class="newb">New</span><span class="tie">{e(c["tie"])}</span></div>'
            f'<h3 class="name big">{e(c["name"])}</h3>{funds(c, "xl")}</div></div>{bar}'
            f'<div class="pbody"><div class="prow">{why(c)}{actions(c, True)}</div>'
            f'<div class="two"><div><h4 class="sub">Funds Raised history</h4>{rounds(c)}</div><div><h4 class="sub">Latest signals</h4>{newslist(c)}</div></div></div></article>')


# ---------------------------------------------------------------- C · Deal Sheet
def sheetC(c):
    m, bar = media(c)
    return (f'<article class="sheetC"><div class="ledger">{funds(c, "xxl")}'
            f'{"<span class=tie>" + e(c["tie"]) + "</span>" if c.get("tie") else ""}{fit(c)}</div>'
            f'<div class="cmedia">{m}{bar}</div>'
            f'<div class="cbody">{head(c)}{why(c)}{signal(c)}{actions(c)}</div></article>')


def tableC(ids):
    rows = ""
    for k in ids:
        c = C[k]
        m, bar = media(c)
        f = c["funds"]
        rows += (f'<tr><td class="t-funds">{funds(c)}</td>'
                 f'<td class="t-co">{head(c)}<div class="t-in"><div class="t-thumb">{m}{bar}</div><div class="t-txt">{why(c)}{signal(c)}</div></div></td>'
                 f'<td class="t-act">{website(c)}<div class="mini">{track()}{more()}</div></td></tr>')
    return ('<table class="tableC"><thead><tr><th>Funds Raised</th><th>Company</th><th>Open</th></tr></thead>'
            f'<tbody>{rows}</tbody></table>')


def pageC(c):
    m, bar = media(c)
    total = 22.0
    segs = ""
    for st, a, d, inv in reversed(c["rounds"]):
        v = float(a.strip("$M"))
        segs += f'<span class="seg" style="flex:{v}"><b>{e(a)}</b><span>{e(st)} · {e(d)}</span></span>'
    return (f'<article class="pageC"><div class="memo"><div class="memol">{head(c, True)}{funds(c, "xxl")}'
            f'<div class="stack" title="{total:.0f}M across 2 rounds">{segs}</div>'
            f'<div class="chips"><span class="tie">{e(c["tie"])}</span><span class="area">Co-investors: Sony, Yamaha</span></div>'
            f'{why(c)}{actions(c, True)}</div><div class="memor">{m}{bar}{newslist(c)}</div></div>'
            f'<h4 class="sub">Funds Raised history</h4>{rounds(c)}</article>')


# ---------------------------------------------------------------- D · Signal First
def strip(c):
    s = c["signal"]
    if c.get("new"):
        return (f'<a class="strip new" href="{e(s["url"])}" target="_blank" rel="noopener"><span class="dot"></span>'
                f'<b>New since your last visit</b><span>{e(s["src"])}</span><time title="{e(s["date"])}">{e(s["ago"])}</time></a>')
    return (f'<a class="strip" href="{e(s["url"])}" target="_blank" rel="noopener">{ico("news")}'
            f'<b>Latest signal</b><span>{e(s["src"])}</span><time title="{e(s["date"])}">{e(s["ago"])}</time></a>')


def cardD(c):
    m, bar = media(c)
    return (f'<article class="cardD">{strip(c)}{m}{bar}<div class="body">{head(c)}{funds(c, "inline")}{why(c)}{actions(c)}</div></article>')


def rowD(c):
    m, bar = media(c)
    return (f'<article class="rowD">{strip(c)}<div class="rd"><div class="thumb">{m}{bar}</div><div class="mid">{head(c)}{why(c)}</div>'
            f'<div class="side">{funds(c)}{website(c)}<div class="mini">{track()}{more()}</div></div></div></article>')


def pipeD(ids):
    new = [k for k in ids if C[k].get("new")]
    old = [k for k in ids if not C[k].get("new")]
    out = f'<div class="group"><h4 class="sub">New since your last visit · {len(new)}</h4>' + "".join(rowD(C[k]) for k in new) + "</div>"
    out += '<div class="group"><h4 class="sub">Earlier</h4>' + "".join(rowD(C[k]) for k in old) + "</div>"
    return out


def pageD(c):
    m, bar = media(c)
    return (f'<article class="pageD">{strip(c)}<div class="dgrid"><div class="dmedia">{m}{bar}</div>'
            f'<div class="dside">{head(c, True)}{funds(c, "xl")}{why(c)}{actions(c, True)}</div></div>'
            f'<div class="two"><div><h4 class="sub">Signals, newest first</h4>{newslist(c)}</div><div><h4 class="sub">Funds Raised history</h4>{rounds(c)}</div></div></article>')


# ---------------------------------------------------------------- options
OPTS = [
    dict(id="A", name="Feed", tag="On-profile", desc="A social-post card: the product visual across the top, then name, Funds Raised, one why paragraph, the latest signal and the actions. Roomy and easy to scroll.",
         motion="Motion: none. Videos play a silent preview while you hover them.",
         today=lambda: '<div class="feedA">' + "".join(cardA(C[k]) for k in TODAY) + "</div>",
         pipe=lambda: '<div class="listA">' + "".join(rowA(C[k]) for k in PIPE) + "</div>",
         page=lambda: pageA(C[PAGE])),
    dict(id="B", name="Tile", tag="Stretch", desc="The picture is the card. Name, Funds Raised and the website ride on a dark fade; hover (or tab to) a tile to lift the why, the signal and the actions. Pipeline rows become picture banners.",
         motion="Motion: details lift in 200 ms on hover or focus. Nothing loops.",
         today=lambda: '<div class="gridB">' + "".join(tileB(C[k]) for k in TODAY) + "</div>",
         pipe=lambda: '<div class="listB">' + "".join(rowB(C[k]) for k in PIPE) + "</div>",
         page=lambda: pageB(C[PAGE])),
    dict(id="C", name="Deal Sheet", tag="Stretch", desc="Money first. A big Funds Raised number leads every card, with the stage, the sources and the portfolio tie beside it; the Pipeline becomes a table you can scan by amount.",
         motion="Motion: none. Videos play a silent preview while you hover them.",
         today=lambda: '<div class="listC">' + "".join(sheetC(C[k]) for k in TODAY) + "</div>",
         pipe=lambda: tableC(PIPE),
         page=lambda: pageC(C[PAGE])),
    dict(id="D", name="Signal First", tag="On-profile", desc="Built for the morning scan. Each card opens with its latest signal; anything new since your last visit gets a red strip and moves to the top. The Pipeline groups new versus earlier.",
         motion="Motion: the red New strip fills once (1.2 s) when the card first appears. Here it replays every 6 s so you can see it.",
         today=lambda: '<div class="gridD">' + "".join(cardD(C[k]) for k in sorted(TODAY, key=lambda k: not C[k].get("new"))) + "</div>",
         pipe=lambda: pipeD(PIPE),
         page=lambda: pageD(C[PAGE])),
]

MANIFEST = {
    "project": "Courtside Ventures", "subject": "Scout V2 company card", "surface": "layout", "claude_rec": "D",
    "compares": ["visual.layout", "ux.detail", "ux.density", "ux.structure", "media"],
    "options": [
        {"id": "A", "name": "Feed", "desc": "visual on top, facts below, roomy single column",
         "tokens": {"visual": {"layout": "feed-card", "accent": ["#cc003d"], "ornament": "badge"},
                    "media": {"kind": "photo-video", "placement": "banner", "edge": "flush"},
                    "ux": {"density": "roomy", "detail": "summary", "structure": "feed"}}},
        {"id": "B", "name": "Tile", "desc": "picture fills the card, text on a fade, details on hover",
         "tokens": {"visual": {"layout": "image-tile-grid", "accent": ["#cc003d"], "ornament": "pill"},
                    "media": {"kind": "photo-video", "placement": "full-bleed", "edge": "scrim"},
                    "motion": [{"element": "details", "kind": "lift", "duration_ms": 200, "reactivity": "event", "trigger": "hover", "pace": "fast", "text_moves": False}],
                    "ux": {"density": "balanced", "detail": "one-line", "structure": "grid"}}},
        {"id": "C", "name": "Deal Sheet", "desc": "big Funds Raised number leads; pipeline as a table",
         "tokens": {"visual": {"layout": "ledger-row", "accent": ["#ffbe4c"], "ornament": "type-only"},
                    "media": {"kind": "photo-video", "placement": "inline", "edge": "flush"},
                    "ux": {"density": "compact", "detail": "summary", "structure": "table", "comparison": "number-first"}}},
        {"id": "D", "name": "Signal First", "desc": "latest signal strip on top; new since last visit fills red once",
         "tokens": {"visual": {"layout": "feed-card", "accent": ["#cc003d"], "ornament": "badge"},
                    "media": {"kind": "photo-video", "placement": "banner", "edge": "flush"},
                    "motion": [{"element": "new strip", "kind": "fill", "duration_ms": 1200, "reactivity": "event", "trigger": "appear", "pace": "medium", "text_moves": False, "path": "line"}],
                    "ux": {"density": "roomy", "detail": "summary", "structure": "grouped", "attention_cue": "color"}}},
    ],
}

CSS = (HERE / "cards.css").read_text()
JS = (HERE / "cards.js").read_text()


def section(o):
    return (f'<section class="opt" id="opt-{o["id"]}" data-variation="{o["id"]}"><div class="opt-head">'
            f'<span class="letter">{o["id"]}</span><h2>{o["name"]}</h2><span class="tag">{o["tag"]}</span></div>'
            f'<p class="opt-desc">{o["desc"]}</p><p class="motion">{o["motion"]}</p>'
            f'<div class="frame">{place(1, "On Today · top picks", o["today"]())}'
            f'{place(2, "In the Pipeline", o["pipe"]())}'
            f'{place(3, "On a company page", o["page"]())}</div></section>')


def tiers():
    rows = [("video", "Product video", "International Dance League (YouTube), Affinity Labs, ANORIA, Spash (their own files)"),
            ("phone", "App Store screenshots", "SleepSense"),
            ("image", "Website preview image", "tash, Topdog"),
            ("badge", "Logo plus Funds Raised", "Axo Longevity, Troveo")]
    return '<ul class="tiers">' + "".join(f'<li>{ico(i)}<b>{n}</b><span>{e(w)}</span></li>' for i, n, w in rows) + "</ul>"


PAGE_HTML = f"""<!doctype html>
<html lang="en" data-mode="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scout V2 cards</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bruno+Ace&family=Oswald:wght@500;600;700&family=Montserrat:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{CSS}
</style>
</head>
<body>
<div class="bar"><div class="barin"><span class="brandmark">Scout V2 · Cards</span>
<nav class="jump" aria-label="Designs">{"".join(f'<a href="#opt-{o["id"]}" data-key="{i+1}"><b>{o["id"]}</b>{o["name"]}</a>' for i, o in enumerate(OPTS))}</nav>
<span class="modes" role="group" aria-label="Appearance"><button type="button" data-mode="dark" aria-pressed="true">Dark</button><button type="button" data-mode="light" aria-pressed="false">Light</button></span></div></div>
<main class="wrap">
<h1>Company cards: four designs</h1>
<p class="lede">Real companies and real numbers from Scout's database (10-25-26). Pictures and videos come from each company's own site, the App Store and YouTube. Every design has the same parts; only the layout changes. Each one is shown in the three places a card appears. "New" means a signal since your last visit (set to {LAST_VISIT} here). Troveo isn't in Scout yet: it's here because two sources disagree on its raise.</p>
<div class="legend"><div><h4 class="sub">Every card has</h4><ul class="parts"><li>The product visual, with play and full screen in the bar under it</li><li>A Visit website button (or Search for website when none is found)</li><li>Funds Raised with its sources; "Not yet public" instead of Unknown</li><li>One why-it-fits paragraph, the latest signal and its date</li><li>Thesis fit (smaller), Track, votes, and More for the rest</li></ul></div>
<div><h4 class="sub">How the visual is picked, first match wins</h4>{tiers()}</div></div>
{"".join(section(o) for o in OPTS)}
<p class="lede foot">Keys 1–4 jump between designs. Sources buttons list where each Funds Raised number comes from.</p>
</main>
<script type="application/json" id="variation-manifest">{json.dumps(MANIFEST)}</script>
<script>
{JS}
</script>
</body>
</html>
"""

OUT.write_text(PAGE_HTML)
json.loads(MANIFEST and json.dumps(MANIFEST))
print(f"wrote {OUT} ({len(PAGE_HTML)//1024} KB)")
