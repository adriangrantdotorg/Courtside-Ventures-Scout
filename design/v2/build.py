#!/usr/bin/env python3
"""Scout V2 full-page mockups, round 3.

Builds design/v2/*.html:
  today.html     the homepage: Must See, Fit Race, the filter, On the Radar
  pipeline.html  the Pipeline with Tile rows
  company.html   a company page with the Deal Sheet header (Topdog)
  filters.html, hover.html, overlap.html   three options each, with taste manifests
Every page reuses the LIVE site's chrome (header, ticker, masthead, footer) from the snapshots in
source/, styled by the live CSS. The preview strip above the site switches the three option sets
(?f=1..3 filter, ?h=1..3 hover, ?o=1..3 overlap) on every page.

Run: python3 design/v2/build.py   (fails if a label isn't Title Case)
"""
import html
import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "source"
IMG = "../v2-cards/"
PF = "pf/"
TODAY = date(2026, 10, 26)
LAST_VISIT = date(2026, 10, 18)
CAP = 15.0  # Scout only recommends companies that have raised less than $15M in total (Adrian, 10-26-26)
DEFAULTS = {"f": "2", "h": "1", "o": "2", "w": "1"}  # his picks (10-26-26): Dropdown Bar, Veil, Logo Pair, Filled or Ghost Globe


def d(s):
    m, dd, y = s.split("-")
    return date(2000 + int(y), int(m), int(dd))


def ago(s):
    n = (TODAY - d(s)).days
    if n < 1:
        return "today"
    if n < 7:
        return f"{n}d ago"
    if n < 30:
        return f"{n // 7}w ago"
    if n < 365:
        return f"{n // 30}mo ago"
    return f"{n // 365}y ago"


def e(s):
    return html.escape(s or "", quote=True)


GN = "https://news.google.com/rss/articles/"
YC = "YC Standard Deal"
# Courtside portfolio companies the samples overlap with (icons from their sites)
PORT = {"Rythm Health": "rythmhealth.png", "Eternal": "eternal.png", "Journey": "journey.png", "Baller League": "ballerleague.png",
        "Camb AI": "camb.png", "Signos": "signos.png", "Future": "future.png", "Every Mother": "every-mother.png",
        "Paceline": "paceline.png", "Kolex": "kolex.png", "Eloelo": "eloelo.png", "Zionverse": None}


def yc(batch, dt, slug):
    return dict(amt="$500K", n=0.5, est=True, stage="Pre-Seed", note=YC,
                src=[("Y Combinator", f"{batch} batch; YC's standard deal is $500K", dt, f"https://www.ycombinator.com/companies/{slug}")])


# ---------------------------------------------------------------- companies (Scout's database, 10-26-26)
CO_ALL = [
    dict(k="sleepsense", name="SleepSense", area="Health", fit=57, logo="sleepsense-icon.jpg", site=None,
         search="https://www.google.com/search?q=SleepSense+sleep+tracker+Dualstar",
         media=dict(kind="shots", shots=["sleepsense-1.jpg", "sleepsense-2.jpg", "sleepsense-3.jpg"]),
         funds=dict(amt="Unknown", n=None, stage=None, note="", src=[]),
         why="Sleep tracking from an iPhone on the nightstand, no wearable needed. Jumped from #69 to #35 in Health & Fitness with 4.2★ from 464 ratings.",
         ov=("Rythm Health", "Both in convenient at-home health", "adjacent"),
         sig=[("App Store", "SleepSense is #35 in Health & Fitness (was #69)", "10-14-26", "https://apps.apple.com/us/app/sleepsense-sleep-tracker/id6791916451")]),
    dict(k="snag", name="Snag", area="Lifestyle", fit=55, logo=None, mono="S", site=None,
         search="https://www.google.com/search?q=Snag+lease+takeover+marketplace+%244M+seed", media=dict(kind="logo"),
         funds=dict(amt="$4M", n=4.0, stage="Seed", note="", src=[("Dealroom", "$4M Seed", "09-25-26", GN + "CBMinAFBVV95cUxQYXB5SVZ0UHluYmt6VHBwUWdscVhXNTgxdU40bUFWOWVZc0V")]),
         why="A marketplace for lease takeovers, so a renter can hand a lease to someone who wants it. Fresh off a $4M seed.", ov=None,
         sig=[("Dealroom", "Snag raises $4M seed to build a marketplace for lease takeovers", "09-25-26", GN + "CBMinAFBVV95cUxQYXB5SVZ0UHluYmt6VHBwUWdscVhXNTgxdU40bUFWOWVZc0V")]),
    dict(k="axo", name="Axo Longevity", area="Health", fit=53, logo="axolongevity-fav.png", site="axolongevity.com",
         media=dict(kind="logo", dark="axo-logo-white.png", light="axo-logo-dark.png"),
         funds=dict(amt="$5M", n=5.0, stage="Seed", note="", src=[("AFP", "$5M Seed, oversubscribed", "09-15-26", GN + "CBMiS0FVX3lxTFBxQmdTcFRISFpVQ0l3Ylo4Z1hpS1R1bXhwM0RMTEhiRzhaXzF"),
                                                                ("Dealroom", "$5M Seed", "09-15-26", GN + "CBMitgFBVV95cUxPTTVOSC1CRGdYSzA3TW1GNmRuNHV1c2pEYTZQOWdDNnVSaUl")]),
         why="A preventive-health membership: 100+ biomarkers twice a year plus a coaching plan, €490 a year. Oversubscribed seed.",
         ov=("Eternal", "Both in longevity and diagnostics"),
         sig=[("AFP", "Axo Longevity raises oversubscribed $5M seed round", "09-15-26", GN + "CBMiS0FVX3lxTFBxQmdTcFRISFpVQ0l3Ylo4Z1hpS1R1bXhwM0RMTEhiRzhaXzF"),
              ("Dealroom", "Axo Longevity raises $5M seed to expand preventive health membership across Europe", "09-15-26", GN + "CBMitgFBVV95cUxPTTVOSC1CRGdYSzA3TW1GNmRuNHV1c2pEYTZQOWdDNnVSaUl")]),
    dict(k="quippy", name="Quippy", area="Health", fit=53, logo="quippyapp-fav.png", site="quippyapp.com",
         media=dict(kind="mp4", poster="quippy-poster.jpg", back="quippy-og.jpg", mp4="https://quippyapp.com/assets/quippy/app-home/unit-claim-your-space-phone.webm", play="Play App Preview", fit="contain"),
         funds=yc("Fall 2026", "08-26-26", "quippy"),
         why="The gym for your social life: short, realistic practice conversations, like pushing back on a boss, with feedback after each one.",
         ov=("Journey", "Both in everyday mental health practice", "adjacent"),
         sig=[("Y Combinator", "YC Fall 2026: Helps build social skills through daily practice", "08-26-26", "https://www.ycombinator.com/companies/quippy")]),
    dict(k="grocalo", name="Grocalo", area="Media", fit=53, logo="grocalo-fav.png", site="grocalo.com",
         media=dict(kind="logo", img="grocalo-logo.png"), funds=yc("Summer 2026", "08-18-26", "grocalo"),
         why="An AI that runs a creator's social content, from reading the audience to posting.",
         ov=("Baller League", "Both in creator tools and distribution"),
         sig=[("Y Combinator", "YC Summer 2026: AI brain for creators that runs their social content", "08-18-26", "https://www.ycombinator.com/companies/grocalo")]),
    dict(k="mochi", name="Mochi", area="Media", fit=52, logo="mochi-fav.png", site="mochi.tv",
         media=dict(kind="site", img="mochi-og.jpg"), funds=yc("Summer 2026", "08-13-26", "mochi"),
         why="One-minute anime microdramas with a cliffhanger every minute, made with AI alongside writers from Marvel and Cartoon Network.",
         ov=("Camb AI", "Both in AI for creators", "adjacent"),
         sig=[("Y Combinator", "YC Summer 2026: Watch and create anime", "08-13-26", "https://www.ycombinator.com/companies/mochi")]),
    dict(k="idl", name="International Dance League", area="Sports", fit=51, logo="idl-logo.png", site="idl.pro",
         media=dict(kind="yt", poster="idl-og.jpg", yt="TtM_Yk6pvkM", play="Play How the League Works"),
         funds=dict(amt="$22M", n=22.0, stage="Series A", note="2 Rounds", src=[]), why="", ov=None,
         sig=[("Axios", "International Dance League raises $15M after sold out inaugural season", "10-21-26", GN)]),
    dict(k="anoria", name="ANORIA", area="Health", fit=51, logo="anoria-fav.png", site="anoria.com",
         media=dict(kind="mp4", poster="anoria-poster.jpg", mp4="https://anoria-cdn.b-cdn.net/anoria-launch-vo-1440.mp4", play="Play Launch Film"),
         funds=yc("Spring 2026", "05-05-26", "anoria"),
         why="A wearable that reads your emotions in real time and coaches your EQ.",
         ov=("Signos", "Both build health wearables"),
         sig=[("Y Combinator", "YC Spring 2026: The first wearable that reads your emotions to enhance your EQ", "05-05-26", "https://www.ycombinator.com/companies/anoria")]),
    dict(k="imperfect", name="Imperfect", area="Health", fit=50, logo="imperfect-fav.png", site="imperfect.co",
         media=dict(kind="site", img="imperfect-og.jpg"), funds=yc("Spring 2026", "04-14-26", "imperfect"),
         why="An adaptive coach for runners, cyclists and triathletes that reshapes training, recovery and nutrition around real life.",
         ov=("Future", "Both in personal training and coaching"),
         sig=[("Y Combinator", "YC Spring 2026: Adaptive training coach for runners, cyclists, and triathletes", "04-14-26", "https://www.ycombinator.com/companies/imperfect")]),
    dict(k="magic", name="Magic AI", area="Health", fit=50, logo="magic-fav.png", site="magic.fit",
         media=dict(kind="mp4", poster="magic-poster.jpg", back="magic-og.jpg", mp4="https://magic.fit/cdn/shop/videos/c/vp/003718be82c2439eacfa584625a98a20/003718be82c2439eacfa584625a98a20.HD-1080p-7.2Mbps-58649313.mp4", play="Play Mirror Demo", fit="contain"),
         funds=dict(amt="$11M", n=11.0, stage=None, note="", src=[("Dealroom", "$11M", "09-23-26", GN + "CBMioAFBVV95cUxOc3MwS2hudW9udDJMamVobUJacGVBUEhqeE56aHVSYTgtZXN")]),
         why="A hologram fitness mirror with an AI coach that checks your form; the new money takes it to the US.",
         ov=("Every Mother", "Both in at-home fitness", "adjacent"),
         sig=[("Dealroom", "Magic AI raises $11M to take its hologram fitness mirror to the US", "09-23-26", GN + "CBMioAFBVV95cUxOc3MwS2hudW9udDJMamVobUJacGVBUEhqeE56aHVSYTgtZXN")]),
    dict(k="lumeria", name="Lumeria", area="Health", fit=49, logo="lumeria-fav.png", site="lumeria.skin",
         media=dict(kind="site", img="lumeria-og.jpg"), funds=yc("Summer 2026", "07-25-26", "lumeria"),
         why="The Oura Ring for skin: a clip-on multispectral camera that scans your skin at home and spots a breakout days before it shows.",
         ov=("Paceline", "Both in connected consumer health"),
         sig=[("Y Combinator", "YC Summer 2026: Oura Ring for Skin", "07-25-26", "https://www.ycombinator.com/companies/lumeria")]),
    dict(k="pov", name="POV Beauty", area="Media", fit=48, logo="povbeauty-fav.png", site="povbeauty.com",
         media=dict(kind="site", img="pov-og.jpg"), funds=dict(amt="$15M", n=15.0, stage="Series A", note="", src=[]), why="", ov=None,
         sig=[("Dealroom", "POV Beauty raises $15M Series A", "10-19-26", GN)]),
    dict(k="tash", name="tash", area="Lifestyle", fit=48, logo="tash-logo.png", site="tradetash.com",
         media=dict(kind="site", img="tash-og.jpg"), funds=yc("Summer 2026", "07-31-26", "tash"),
         why="Investment-grade portfolios of sports and trading cards, pitched as the BlackRock of collectibles.",
         ov=("Kolex", "Both in trading cards and collectibles"),
         sig=[("Y Combinator", "YC Summer 2026: The BlackRock of collectibles", "07-31-26", "https://www.ycombinator.com/companies/tash")]),
    dict(k="illume", name="Illume Labs", area="Health", fit=48, logo="illumelabs-fav.png", site="illumelabs.ai",
         media=dict(kind="logo", img="illumelabs-fav.png"), funds=yc("Summer 2026", "07-15-26", "illume-labs"),
         why="A 24/7 AI longevity companion that reads your wearables, blood panels and genome, then texts you what to do next.",
         ov=("Eternal", "Both in longevity and diagnostics"),
         sig=[("Y Combinator", "YC Summer 2026: 24/7 Personal Health & Longevity Companion", "07-15-26", "https://www.ycombinator.com/companies/illume-labs")]),
    dict(k="spill", name="Spill Games", area="Gaming", fit=48, logo=None, mono="SG", site="spill.games", media=dict(kind="logo"),
         funds=dict(amt="$10.5M", n=10.5, stage="Series A", note="", src=[("G2G News", "$10.5M Series A led by Elevation Capital", "10-19-26", GN + "CBMixgFBVV95cUxQc093dVJPV3B6ZDJWbTRfdVVZZXRDVzhBLXAxaGdYODVJNjl"),
                                                                            ("Inc42", "$10.5M", "10-14-26", GN + "CBMikAFBVV95cUxNaG1EUlV0cElobXFaTDN4THFFZ1h0SVgxdklIQnBwNXhxdy1"),
                                                                            ("CNBC TV18", "$10.5M led by Elevation Capital", "10-14-26", GN + "CBMi0wFBVV95cUxQU3Rod0MtaGU5MzNpbG1xWERFUk9NcWF2RjlNZjZJbEktQzN")]),
         why="An AI-led mobile studio making merge-match games. Elevation Capital led the Series A.", ov=None,
         sig=[("G2G News", "Spill Games secures US$10.5 million in Series A led by Elevation Capital", "10-19-26", GN + "CBMixgFBVV95cUxQc093dVJPV3B6ZDJWbTRfdVVZZXRDVzhBLXAxaGdYODVJNjl"),
              ("Indian Startup News", "Mobile gaming studio Spill Games raises $10.5 million in funding led by Elevation Capital", "10-17-26", GN + "CBMizwFBVV95cUxPRmFTbmdlUl9POHZFRjFZUDdqMEVoVDlZcWxPRHBiYVlndXA"),
              ("Inc42", "Spill Games raises $10.5 Mn to scale AI-led mobile gaming studio", "10-14-26", GN + "CBMikAFBVV95cUxNaG1EUlV0cElobXFaTDN4THFFZ1h0SVgxdklIQnBwNXhxdy1")]),
    dict(k="affinity", name="Affinity Labs", area="Media", fit=47, logo="affinity-fav.png", site="affinitylabs.ai",
         media=dict(kind="mp4", poster="affinity-poster.jpg", back="affinity-og.jpg", mp4="https://affinitylabs.ai/video/idc-demo.mp4", play="Play App Demo", fit="contain"),
         funds=dict(amt="$2M", n=2.0, stage="Pre-Seed", note="", src=[("Pulse 2.0", "$2M Pre-Seed led by Fuel Ventures", "10-20-26", GN + "CBMiuAFBVV95cUxPMXl0emQ0WG1pWlVsSGpFb1JySzRITkxWODhoRF92Wmk5MzF"),
                                                                       ("Tech Funding News", "$2M", "10-14-26", GN + "CBMinwFBVV95cUxOUE9sSHJQbm1yZWFGNHBrT3VkRDdsU1oxRHl3QWtRNWJrWk0"),
                                                                       ("Dealroom", "$2M", "10-14-26", GN + "CBMingFBVV95cUxPcFNMeGhVUmlTa2twdlRXdnE1MS1MdnAzNEFOWUtScklXM09")]),
         why="Builds software companies with category-defining creators, pitched as Bending Spoons for creator-led apps. Fuel Ventures led the pre-seed.", ov=None,
         sig=[("Pulse 2.0", "Affinity Labs raises $2 million pre-seed led by Fuel Ventures to scale creator-led software", "10-20-26", GN + "CBMiuAFBVV95cUxPMXl0emQ0WG1pWlVsSGpFb1JySzRITkxWODhoRF92Wmk5MzF"),
              ("Tech Funding News", "Affinity Labs raises $2M to build 'Bending Spoons for creator-led apps'", "10-14-26", GN + "CBMinwFBVV95cUxOUE9sSHJQbm1yZWFGNHBrT3VkRDdsU1oxRHl3QWtRNWJrWk0"),
              ("Dealroom", "Affinity Labs raises $2M to turn creators into software founders", "10-14-26", GN + "CBMingFBVV95cUxPcFNMeGhVUmlTa2twdlRXdnE1MS1MdnAzNEFOWUtScklXM09")]),
    dict(k="topdog", name="Topdog", area="Gaming", fit=47, logo="topdog-fav.png", site="topdog.games",
         media=dict(kind="site", img="topdog-og.jpg"),
         funds=dict(amt="$4.1M", n=4.1, stage="Seed", note="2 Rounds", src=[("Pulse 2.0", "$2.5M Seed led by Boston Seed Capital", "10-02-26", "https://pulse2.com/topdog-raises-2-5-million-seed-round-to-scale-real-time-multiplayer-gaming/"),
                                                                                ("citybiz", "$2.5M Seed", "09-24-26", "https://www.citybiz.co/?p=908496"),
                                                                                ("Bonus.com", "$4.1M in total, after a $1.6M pre-seed", "Sep 2026", "https://www.bonus.com/news/topdog-real-money-skill-gaming-app-funding/")]),
         why="Head-to-head skill games for real cash, live in 45 states with 4.6★ on the App Store. FanDuel co-founder Nigel Eccles backs it.",
         ov=("Eloelo", "Both in social and multiplayer games"),
         rounds=[("Seed", "$2.5M", "Sep 2026", "Boston Seed Capital (lead), The Raine Group, Bullpen Capital, Versus Ventures, Spoondrift Capital, Permit Ventures"),
                 ("Pre-Seed", "$1.6M", "Earlier", "Lightspeed")],
         breakdown=[("Thesis Fit", 19, 30), ("Stage and Check", 20, 20), ("Signal Strength", 5, 20), ("Culture", 0, 15), ("Team", 0, 10), ("Geography", 3, 5)],
         sig=[("Pulse 2.0", "Topdog raises $2.5 million seed round to scale real-time multiplayer gaming", "10-02-26", GN + "CBMimgFBVV95cUxQdmx4R09oTEpLNXVndC1EcE9LUk1KdkN2ZXdZM194UHZwQWN"),
              ("citybiz", "Topdog raises $2.5M to expand real-time multiplayer skill gaming", "09-24-26", GN + "CBMipAFBVV95cUxOajdDM3VpeFNzVDl5ejlnWDFhS3FhWHFjUmJ5YWJvU0RGUDc"),
              ("Yahoo Finance", "Topdog raises $2.5 million seed financing to scale real time multiplayer gaming", "09-23-26", GN + "CBMilAFBVV95cUxOZDJxaE9QSWo5X0dHSGtqU0pfSEJSUmhGQTZFVEdweGVQM1N")]),
    dict(k="spash", name="Spash", area="Sports", fit=47, logo="spash-logo.jpg", site="spash.com",
         media=dict(kind="mp4", poster="spash-poster.jpg", mp4="https://spash.com/wp-content/uploads/2024/07/PADELSHOt.mp4", play="Play Court Clip"),
         funds=dict(amt="€2M", n=2.0, stage="Series A", note="", src=[("Dealroom", "€2M Series A", "10-12-26", GN + "CBMilwFBVV95cUxQWXAtUzBCRjA1V0V6a1ZVUU1XY2xyaW5kaEdmbzR6VmRxMzY")]),
         why="AI cameras, replays and stats for padel clubs, one of the fastest-growing racquet sports. A €2M round sits right in Courtside's check range.", ov=None,
         sig=[("Dealroom", "France's Spash raises €2M Series A to put AI in padel clubs", "10-12-26", GN + "CBMilwFBVV95cUxQWXAtUzBCRjA1V0V6a1ZVUU1XY2xyaW5kaEdmbzR6VmRxMzY")]),
    dict(k="noise", name="Noise", area="Media", fit=47, logo="getnoise-fav.png", site="getnoise.com",
         media=dict(kind="site", img="noise-og.jpg"),
         funds=dict(amt="$5.5M", n=5.5, stage="Seed", note="", src=[("Dealroom", "$5.5M Seed", "09-17-26", GN + "CBMioAFBVV95cUxQc21JdWVHV3V0ZTA4bk4wTWFyb296YXVsZVUyUThPY0pWbWt")]),
         why="Pays everyday creators to make brand content, so creators become the distribution.",
         ov=("Zionverse", "Both build around creator content"),
         sig=[("Dealroom", "Noise raises $5.5M seed to pay everyday creators for brand content", "09-17-26", GN + "CBMioAFBVV95cUxQc21JdWVHV3V0ZTA4bk4wTWFyb296YXVsZVUyUThPY0pWbWt")]),
    dict(k="melty", name="Melty", area="Gaming", fit=47, logo="melty-fav.png", site="melty.gg",
         media=dict(kind="site", img="melty-og.jpg"), funds=yc("Fall 2026", "10-05-26", "melty-gg"),
         why="Mash up any game: players remix and mod games into new ones.", ov=None,
         sig=[("Y Combinator", "YC Fall 2026: Mashup any game", "10-05-26", "https://www.ycombinator.com/companies/melty-gg")]),
]
for c in CO_ALL:
    c["new"] = d(c["sig"][0][2]) > LAST_VISIT if re.match(r"\d\d-\d\d-\d\d$", c["sig"][0][2]) else False
# Real competitors only: a loose keyword match ("adjacent" in the data) never shows on any page (Adrian, 10-26-26)
for c in CO_ALL:
    if c.get("ov") and len(c["ov"]) > 2 and c["ov"][2] == "adjacent":
        c["ov"] = None
# The cap: Scout never recommends a company that has raised $15M or more
CO = [c for c in CO_ALL if c["funds"]["n"] is None or c["funds"]["n"] < CAP]
DROPPED = [c["name"] for c in CO_ALL if c not in CO]
BY = {c["k"]: c for c in CO}
RANKED = sorted(CO, key=lambda c: (-c["fit"], not c["new"], c["name"]))
BUCKETS = [("Unknown", lambda n: n is None), ("Under $1M", lambda n: n is not None and n < 1),
           ("$1–5M", lambda n: n is not None and 1 <= n < 5), ("$5–15M", lambda n: n is not None and 5 <= n < CAP)]
AREAS = ["Health", "Media", "Gaming", "Lifestyle", "Sports"]
MUST = BY["sleepsense"]  # Must See: the highest fit with news in the last two weeks


def bucket(c):
    return next(i for i, (_, f) in enumerate(BUCKETS) if f(c["funds"]["n"]))


# ---------------------------------------------------------------- icons
I = {
    "play": '<path d="M7 4.5v15l12.5-7.5z"/>',
    "pause": '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
    "ext": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "pin": '<path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    "down": '<path d="m6 9 6 6 6-6"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    "news": '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "sound": '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    "up": '<path d="M8 3l6 9H2z"/>',
    "dn": '<path d="M8 13L2 4h12z"/>',
    "arrow": '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    "link": '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
}


def ico(n, cls="x-ico", vb="0 0 24 24"):
    return f'<svg class="{cls}" viewBox="{vb}" aria-hidden="true">{I[n]}</svg>'


# ---------------------------------------------------------------- shared parts
def hue(f):
    return max(40, min(140, 40 + (f - 40) * 5))


def fit_ring(c, size="md"):
    f = c["fit"]
    C = 2 * 3.14159 * 42
    return (f'<span class="x-fit {size}" style="--h:{hue(f)}" title="Thesis fit: how well {e(c["name"])} matches Courtside\'s thesis">'
            f'<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="42"/>'
            f'<circle class="val" cx="50" cy="50" r="42" stroke-dasharray="{C * f / 100:.1f} {C:.1f}"/></svg>'
            f'<span class="num"><b>{f}<small>%</small></b><em>Fit</em></span></span>')


def logo(c, cls="x-logo"):
    if c.get("logo"):
        return f'<img class="{cls}" src="{IMG}{c["logo"]}" alt="">'
    return f'<span class="{cls} mono">{e(c.get("mono", c["name"][:1]))}</span>'


def pf_logo(name, cls="x-pflogo"):
    f = PORT.get(name)
    if f:
        return f'<img class="{cls}" src="{PF}{f}" alt="">'
    return f'<span class="{cls} mono">{e(name[:1])}</span>'


def media_html(c):
    m = c["media"]
    k = m["kind"]
    a = f'data-kind="{k}"'
    if k == "yt":
        inner = f'<img class="cover" src="{IMG}{m["poster"]}" alt="{e(c["name"])}" loading="lazy">'
        a += f' data-yt="{m["yt"]}"'
    elif k == "mp4":
        back = f'<img class="back" src="{IMG}{m["back"]}" alt="" loading="lazy">' if m.get("back") else ""
        inner = f'{back}<img class="{m.get("fit", "cover")}" src="{IMG}{m["poster"]}" alt="{e(c["name"])}" loading="lazy">'
        a += f' data-mp4="{e(m["mp4"])}" data-fit="{m.get("fit", "cover")}"'
    elif k == "shots":
        inner = '<div class="shots">' + "".join(f'<img src="{IMG}{s}" alt="" loading="lazy">' for s in m["shots"]) + "</div>"
    elif k == "site":
        inner = f'<img class="back blur" src="{IMG}{m["img"]}" alt="" loading="lazy"><img class="contain" src="{IMG}{m["img"]}" alt="{e(c["name"])}" loading="lazy">'
    else:
        if m.get("dark"):
            mark = f'<img class="lg lg-dark" src="{IMG}{m["dark"]}" alt="{e(c["name"])}"><img class="lg lg-light" src="{IMG}{m["light"]}" alt="">'
        elif m.get("img"):
            mark = f'<img class="lg sq" src="{IMG}{m["img"]}" alt="{e(c["name"])}">'
        else:
            mark = f'<span class="lg monogram">{e(c.get("mono", c["name"][:1]))}</span>'
        inner = f'<div class="logostage">{mark}</div>'
    return f'<div class="x-media" {a} data-co="{c["k"]}">{inner}</div>'


def play_bar(c):
    m = c["media"]
    if m["kind"] not in ("yt", "mp4"):
        return ""
    return (f'<div class="x-pbar"><button class="x-play" type="button" data-co="{c["k"]}">{ico("play", "x-ico fill")}'
            f'<span>{e(m["play"])}</span></button></div>')


def sources(c):
    f = c["funds"]
    n = len(f["src"])
    if not n:
        return ""
    verdict = " Agree" if n > 1 else ""
    items = "".join(f'<li><a href="{e(u)}" target="_blank" rel="noopener">{e(w)}</a><span>{e(what)}</span><time>{e(dt)}</time></li>' for w, what, dt, u in f["src"])
    return (f'<span class="x-pop"><button class="x-srcbtn" type="button" aria-expanded="false">{ico("info")}<span>{n} Source{"s" if n > 1 else ""}{verdict}</span>{ico("down")}</button>'
            f'<span class="x-popbox" hidden><b>Where This Number Comes From</b><ul>{items}</ul></span></span>')


def funds(c, size="", lean=False):
    """lean: the amount only (cards); the stage, the note and the sources live on the company page."""
    f = c["funds"]
    amt_cls = " none" if f["n"] is None else (" est" if f.get("est") else "")
    if lean:
        return f'<div class="x-funds {size}"><span class="x-flabel">Funds Raised</span><span class="x-amt{amt_cls}">{e(f["amt"])}</span></div>'
    stage = f'<span class="x-stage">{e(f["stage"])}</span>' if f.get("stage") else ""
    note = f'<span class="x-note">{e(f["note"])}</span>' if f.get("note") else ""
    return (f'<div class="x-funds {size}"><span class="x-flabel">Funds Raised</span><span class="x-amt{amt_cls}">{e(f["amt"])}</span>'
            f'<span class="x-fsub">{stage}{note}{sources(c)}</span></div>')


def signals(c):
    s = c["sig"]
    first = s[0]
    when = f'<time title="{e(first[2])}">{ago(first[2])}</time>' if re.match(r"\d\d-\d\d-\d\d$", first[2]) else ""
    if len(s) == 1:
        return f'<a class="x-sig" href="{e(first[3])}" target="_blank" rel="noopener">{ico("news")}<span>{e(first[0])}</span>{when}</a>'
    items = "".join(f'<li><a href="{e(u)}" target="_blank" rel="noopener"><b>{e(w)}</b><span class="x-headline">{e(t)}</span></a><time>{e(dt)}</time></li>' for w, t, dt, u in s)
    return (f'<span class="x-pop x-sigpop"><button class="x-sig x-sigbtn" type="button" aria-expanded="false">{ico("news")}'
            f'<span>{e(first[0])} + {len(s) - 1} More</span>{when}{ico("down")}</button>'
            f'<span class="x-popbox x-siglist" hidden><b>{len(s)} Signals, Newest First</b><ul>{items}</ul></span></span>')


def site_btn(c, style="cta"):
    if c.get("site"):
        return f'<a class="x-btn site {style}" href="https://{c["site"]}" target="_blank" rel="noopener" title="Opens {e(c["site"])}">{ico("ext")}<span>Visit Website</span></a>'
    return f'<a class="x-btn site find" href="{e(c["search"])}" target="_blank" rel="noopener" title="No official website found yet; searches the web">{ico("search")}<span>Find Website</span></a>'


GLOBE = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>'
MAG = '<circle cx="10.5" cy="10.5" r="6"/><path d="m20 20-5.2-5.2"/>'
ARR = '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>'
WIN = '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M2.5 9h19"/><path d="M5.5 6.6h.01M8 6.6h.01M10.5 6.6h.01"/>'


def svg(paths, cls="x-ico"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{paths}</svg>'


def web_icon(c):
    """Visit Website / Find Website with no words: four designs, the strip picks one (?w=1..4)."""
    known = bool(c.get("site"))
    href = f'https://{c["site"]}' if known else c["search"]
    tip = "Visit Website" if known else "Find Website"
    full = f'{tip}: {c["site"]}' if known else "Find Website: No Official Site Yet, Searches the Web"
    state = "known" if known else "search"
    fav = f'<img src="{IMG}{c["logo"]}" alt="">' if c.get("logo") else f'<b>{e(c.get("mono", c["name"][:1]))}</b>'
    w1 = svg(GLOBE)
    w2 = svg(GLOBE) + f'<span class="x-wbadge">{svg(ARR if known else MAG)}</span>'
    w3 = (f'<span class="x-wfav">{fav}</span><span class="x-wbadge">{svg(ARR)}</span>') if known else (svg(GLOBE) + f'<span class="x-wbadge">{svg(MAG)}</span>')
    w4 = svg(WIN) + f'<span class="x-wbadge">{svg(ARR if known else MAG)}</span>'
    # Filled or Ghost Globe, picked 10-26-26; used on Today's cards only (the Pipeline and company pages keep the labeled buttons)
    return f'<a class="x-web w1 {state}" href="{e(href)}" target="_blank" rel="noopener" aria-label="{e(full)}" data-tip="{tip}">{w1}</a>'


def new_chip(c):
    return '<span class="x-new"><i></i>New</span>' if c.get("new") else ""


def area(c):
    return f'<span class="x-area">{e(c["area"])}</span>'


def more():
    items = ["Draft Investment Memo", "Connection Email", "Add Note", "Copy for CRM", "Download CSV"]
    return (f'<span class="x-pop"><button class="x-btn x-more" type="button" aria-expanded="false"><span>More</span>{ico("down")}</button>'
            '<span class="x-popbox x-menu" hidden>' + "".join(f'<button type="button">{i}</button>' for i in items) + "</span></span>")


def track(on=False):
    return f'<button class="x-btn x-track" type="button" aria-pressed="{str(on).lower()}">{ico("pin")}<span>{"Tracking" if on else "Track"}</span></button>'


def votes():
    return (f'<span class="x-votes"><button type="button" class="up" title="This fits Courtside">{ico("up", "x-ico fill", "0 0 16 16")}</button>'
            f'<b>0</b><button type="button" class="dn" title="Not for Courtside">{ico("dn", "x-ico fill", "0 0 16 16")}</button></span>')


def data_attrs(c):
    return f'data-k="{c["k"]}" data-area="{c["area"].lower()}" data-bucket="{bucket(c) if c in CO else 0}" data-fit="{c["fit"]}" data-new="{1 if c["new"] else 0}"'


# ---------------------------------------------------------------- overlap with a portfolio company: three designs
def ov_text(c):
    return f'Overlaps with {c["ov"][0]}'


def ov_tag(c):
    """Inline parts that sit with the chips: option 2 (logo pair) and option 3's text line."""
    if not c.get("ov"):
        return ""
    name, why = c["ov"][:2]
    return (f'<span class="x-ov o2" title="{e(why)}"><span class="pair">{logo(c, "x-pairlogo")}{pf_logo(name, "x-pairlogo")}</span>'
            f'<span>{e(ov_text(c))}</span></span>')  # Logo Pair, picked 10-26-26


def ov_ribbon(c):
    """Option 1: a violet ribbon across the card."""
    return ""  # the ribbon lost to the Logo Pair (10-26-26)
    name, why = c["ov"][:2]
    return f'<div class="x-ov o1 ribbon" title="{e(why)}">{pf_logo(name)}<span><b>{e(ov_text(c))}</b><em>Courtside Portfolio</em></span></div>'


def ov_pin(c):
    """Option 3: the portfolio company's logo pinned to the fit ring."""
    return ""  # the pinned badge lost to the Logo Pair (10-26-26)
    return f'<span class="x-ov o3 pin" title="{e(ov_text(c))}">{pf_logo(c["ov"][0])}</span>'


def ov_panel(c):
    """The company page: all three options, at page size."""
    if not c.get("ov"):
        return ""
    name, why = c["ov"][:2]
    return (f'<div class="x-ov o2 callout pairbig"><span class="pair big">{logo(c, "x-pairlogo")}{pf_logo(name, "x-pairlogo")}</span><div><b>{e(ov_text(c))}</b><span>{e(why)}. {e(name)} is a Courtside portfolio company: check for conflicts before reaching out.</span></div></div>')


# ---------------------------------------------------------------- the card hover: three designs
def hover_layers():
    t = "Click to View More Details"
    return f'<div class="x-hovwrap"><div class="x-hov h1" aria-hidden="true"><span>{t}{ico("arrow")}</span></div></div>'  # Veil, picked 10-26-26


# ---------------------------------------------------------------- cards
def tile(c, forced_hover=None):
    hov = f' data-hov="{forced_hover}"' if forced_hover else ""
    return (f'<article class="x-tile link{" hovon" if forced_hover else ""}" tabindex="0" {data_attrs(c)} data-href="company.html" id="t-{c["k"]}"{hov} title="Open {e(c["name"])}">'
            f'<div class="x-tm">{media_html(c)}<div class="x-scrim"></div>{hover_layers()}'
            f'<div class="x-tl">{fit_ring(c, "md")}{ov_pin(c)}</div><div class="x-tr">{web_icon(c)}</div>'
            f'<div class="x-over">{ov_ribbon(c)}<div class="x-tags">{area(c)}{new_chip(c)}{ov_tag(c)}</div>'
            f'<h3 class="x-name">{e(c["name"])}</h3>{funds(c, "tile", lean=True)}</div></div>{play_bar(c)}</article>')


def hero(c):
    return (f'<article class="x-tile hero open always" {data_attrs(c)} id="t-{c["k"]}">'
            f'<div class="x-tm">{media_html(c)}<div class="x-scrim"></div>'
            f'<div class="x-tl">{fit_ring(c, "lg")}{ov_pin(c)}</div><div class="x-tr">{web_icon(c) if c.get("site") else ""}</div>'
            f'<div class="x-over">{ov_ribbon(c)}<div class="x-tags">{area(c)}{new_chip(c)}{ov_tag(c)}</div>'
            f'<h3 class="x-name">{e(c["name"])}</h3>{funds(c, "tile") if c["funds"]["n"] is not None else ""}'
            f'<div class="x-reveal"><div><p class="x-why">{e(c["why"])}</p>{signals(c)}'
            f'<div class="x-acts"><a class="x-btn ghost" href="company.html">{ico("arrow")}<span>View Details</span></a>{track()}{more()}{votes()}</div></div></div>'
            f'</div></div>{play_bar(c)}</article>')


def row(c, rank, tracked=False):
    return (f'<article class="x-row" {data_attrs(c)}>'
            f'<div class="x-key"><span class="x-rank">#{rank}</span><div class="x-tl static">{fit_ring(c, "lg")}{ov_pin(c)}</div>{funds(c, "row")}</div>'
            f'<div class="x-banner"><div class="x-bclip">{media_html(c)}<div class="x-bscrim"></div></div>'
            f'<div class="x-bover">{ov_ribbon(c)}<div class="x-chead">{logo(c)}<div><h3 class="x-name">{e(c["name"])}</h3><div class="x-tags">{area(c)}{new_chip(c)}{ov_tag(c)}</div></div></div>'
            f'<p class="x-why">{e(c["why"])}</p>{signals(c)}</div></div>'
            f'<div class="x-side">{site_btn(c, "cta")}{track(tracked)}{more()}{votes()}</div>{play_bar(c)}</article>')


# ---------------------------------------------------------------- Fit Race (static, highest fit first)
def race():
    top = RANKED[:10]
    head = ('<div class="x-rhead"><span>#</span><span></span><span>Company</span><span>Thesis Fit</span><span>Funds Raised</span></div>')
    rows = ""
    for i, c in enumerate(top):
        rows += (f'<a class="x-rr" href="company.html" style="--w:{c["fit"]};--h:{hue(c["fit"])}">'
                 f'<span class="x-rpos">{i + 1}</span>{logo(c, "x-logo sm")}<span class="x-rname">{e(c["name"])}{new_chip(c)}</span>'
                 f'<span class="x-rtrack"><i></i><b>{c["fit"]}%</b></span><span class="x-rfund{" none" if c["funds"]["n"] is None else ""}">{e(c["funds"]["amt"])}</span></a>')
    return (f'<section class="x-sec"><div class="x-sech"><h2 class="x-h2">The Combine</h2><span class="x-count">(Top 10 Startups by Thesis Fit · Updated Daily)</span></div>'
            f'<div class="x-race static">{head}{rows}</div></section>')


# ---------------------------------------------------------------- the filter: three designs, all drive On the Radar
def counts():
    b = [sum(1 for c in CO if c is not MUST and bucket(c) == i) for i in range(len(BUCKETS))]
    a = {x: sum(1 for c in CO if c is not MUST and c["area"] == x) for x in AREAS}
    return b, a


def filter1():
    b, a = counts()
    funds_seg = '<button type="button" class="x-seg" data-set="bucket" data-val="" aria-pressed="true">All</button>' + "".join(
        f'<button type="button" class="x-seg" data-set="bucket" data-val="{i}" aria-pressed="false">{e(n)} <b>{b[i]}</b></button>' for i, (n, _) in enumerate(BUCKETS) if b[i])
    cats = '<button type="button" class="x-chip" data-set="area" data-val="" aria-pressed="true">All</button>' + "".join(
        f'<button type="button" class="x-chip" data-set="area" data-val="{x.lower()}" aria-pressed="false">{x} <b>{a[x]}</b></button>' for x in AREAS)
    return (f'<div class="x-filter f1" data-variation-part="1"><div class="x-frow"><span class="x-flabel">Funds Raised</span><div class="x-segs">{funds_seg}</div></div>'
            f'<div class="x-frow"><span class="x-flabel">Category</span><div class="x-chips">{cats}</div></div>'
            f'<div class="x-frow x-fextra"><span class="x-flabel">Also</span><div class="x-chips">'
            f'<button type="button" class="x-chip" data-toggle="fit50" aria-pressed="false">50%+ Fit</button>'
            f'<button type="button" class="x-chip" data-toggle="newonly" aria-pressed="false"><i class="x-dot"></i>New This Week</button></div>'
            f'<span class="x-fcount" data-count></span><button type="button" class="x-fclear" data-clear>Clear Filters</button></div></div>')


def dd(label, key, opts):
    items = f'<button type="button" data-set="{key}" data-val="" aria-pressed="true"><span>All</span></button>' + "".join(
        f'<button type="button" data-set="{key}" data-val="{v}" aria-pressed="false"><span>{e(n)}</span><b>{k}</b></button>' for v, n, k in opts)
    return (f'<span class="x-pop x-dd"><button class="x-ddbtn" type="button" aria-expanded="false" data-label="{label}">'
            f'<span class="x-flabel">{label}</span><b data-shown>All</b>{ico("down")}</button>'
            f'<span class="x-popbox x-ddmenu" hidden>{items}</span></span>')


def filter2():
    b, a = counts()
    return (f'<div class="x-filter f2" data-variation-part="2">'
            + dd("Funds Raised", "bucket", [(str(i), n, b[i]) for i, (n, _) in enumerate(BUCKETS) if b[i]])
            + dd("Category", "area", [(x.lower(), x, a[x]) for x in AREAS])
            + f'<button type="button" class="x-chip" data-toggle="fit50" aria-pressed="false">50%+ Fit</button>'
            f'<button type="button" class="x-chip" data-toggle="newonly" aria-pressed="false"><i class="x-dot"></i>New This Week</button>'
            f'<span class="x-fcount" data-count></span><button type="button" class="x-fclear" data-clear>Clear Filters</button></div>')


def filter3():
    b, a = counts()
    total = sum(b)
    tabs = f'<button type="button" class="x-tab" data-set="area" data-val="" aria-pressed="true">All <b>{total}</b></button>' + "".join(
        f'<button type="button" class="x-tab" data-set="area" data-val="{x.lower()}" aria-pressed="false">{x} <b>{a[x]}</b></button>' for x in AREAS)
    mx = max(b)
    bars = "".join(
        f'<button type="button" class="x-hbar" data-set="bucket" data-val="{i}" aria-pressed="false" title="{e(n)}: {b[i]} {"company" if b[i] == 1 else "companies"}">'
        f'<span class="x-hfill" style="--v:{b[i] / mx:.3f}"><b>{b[i]}</b></span><span class="x-hlab">{e(n)}</span></button>' for i, (n, _) in enumerate(BUCKETS) if b[i])  # an empty range offers nothing to pick
    return (f'<div class="x-filter f3" data-variation-part="3"><div class="x-tabs" role="group" aria-label="Category">{tabs}</div>'
            f'<div class="x-f3body"><div class="x-hist"><span class="x-flabel">Funds Raised</span><div class="x-hbars">{bars}</div></div>'
            f'<div class="x-f3side"><button type="button" class="x-chip" data-toggle="fit50" aria-pressed="false">50%+ Fit</button>'
            f'<button type="button" class="x-chip" data-toggle="newonly" aria-pressed="false"><i class="x-dot"></i>New This Week</button>'
            f'<span class="x-fcount" data-count></span><button type="button" class="x-fclear" data-clear>Clear Filters</button></div></div></div>')


# ---------------------------------------------------------------- Deal Sheet (company page)
def fit_panel(c):
    bars = "".join(
        f'<div class="x-bar"><span class="lbl">{e(n)}</span><span class="tr"><i style="--w:{v / mx * 100:.0f}%"></i></span><span class="n">{v}<small>/{mx}</small></span></div>'
        for n, v, mx in c["breakdown"])
    return (f'<section class="x-kpanel fitp"><div class="x-khead"><span class="x-flabel">Thesis Fit</span>'
            f'<a class="x-howlink" href="#" title="Open Settings › Scoring">How Scout Scores</a></div>'
            f'<div class="x-fitwrap"><div class="x-tl static">{fit_ring(c, "xl")}{ov_pin(c)}</div><div class="x-bars">{bars}</div></div>'
            f'<p class="x-hint">Low on signal, culture and team: it rises as more independent stories arrive, as creators and shows mention it, and as founders show up in filings.</p></section>')


def funds_panel(c):
    segs = ""
    total = sum(float(a.strip("$M")) for _, a, _, _ in c["rounds"])
    for st, a, dt, inv in reversed(c["rounds"]):
        v = float(a.strip("$M"))
        segs += f'<span class="seg" style="flex:{v}"><b>{e(a)}</b><span>{e(st)}</span></span>'
    return f'<section class="x-kpanel fundp">{funds(c, "xxl")}<div class="x-stack" title="${total:.1f}M across {len(c["rounds"])} rounds">{segs}</div></section>'


def rounds_table(c):
    rows = "".join(f'<tr><td class="r-st">{e(st)}</td><td class="r-amt">{e(a)}</td><td class="r-date">{e(dt)}</td><td>{e(inv)}</td></tr>' for st, a, dt, inv in c["rounds"])
    return ('<section class="x-rounds"><h2 class="x-h2">Funds Raised History</h2><table><thead><tr><th>Round</th><th>Amount</th><th>Date</th><th>Investors</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></section>')


def deal_sheet(c):
    return (f'<header class="x-deal"><div class="x-dl">'
            f'<div class="x-dtitle">{logo(c, "x-logo big")}<div><h1 class="x-dname">{e(c["name"])}</h1><div class="x-tags">{area(c)}{new_chip(c)}'
            f'<span class="x-area">Angel: Nigel Eccles, FanDuel</span></div></div></div>'
            f'{ov_panel(c)}<div class="x-kpis">{fit_panel(c)}{funds_panel(c)}</div>'
            f'<p class="x-why big">{e(c["why"])}</p>'
            f'<div class="x-acts">{site_btn(c, "cta big")}{track()}{more()}{votes()}</div></div>'
            f'<div class="x-dr"><div class="x-dmedia">{media_html(c)}{play_bar(c)}</div>'
            f'<div class="x-latest"><span class="x-flabel">Latest Signal</span>{signals(c)}</div></div></header>')


# ---------------------------------------------------------------- live chrome
def body_of(name):
    s = (SRC / name).read_text()
    return re.sub(r"<script.*?</script>", "", s[s.find("<body"):], flags=re.S)


TODAY_BODY = body_of("live-today.html")
CO_BODY = body_of("live-company-292.html")
BRIEF_BODY = body_of("live-brief.html")
TRACK_BODY = body_of("live-tracking.html")


def live_main(body):
    m = body[body.index('<main id="main">') + len('<main id="main">'):body.index("</main>")]
    # times the live site fills in by script
    m = re.sub(r'(data-live="ago"[^>]*)></span>', r'\1>5h ago</span>', m)
    m = re.sub(r'(data-live="until"[^>]*)></span>', r'\1>in 6d</span>', m)
    return re.sub(r'href="/[^"]*"', 'href="#"', m.replace("btn red", "btn"))  # red stays for Visit Website


def cut(s, start, end, incl_end=True):
    i = s.index(start)
    j = s.index(end, i)
    return s[i:j + (len(end) if incl_end else 0)]


def header(active):
    h = cut(TODAY_BODY, '<header class="top">', "</header>")
    for key, name, href, page in (("today", "Today", "/", "today.html"), ("pipeline", "Pipeline", "/pipeline", "pipeline.html"),
                                  ("brief", "IC Meeting", "/brief", "brief.html"), ("tracking", "Tracking", "/tracking", "tracking.html")):
        h = h.replace(f'<a class="" href="{href}">{name}</a>', f'<a class="{"on" if active == key else ""}" href="{page}">{name}</a>')
    return re.sub(r'href="/[^"]*"', 'href="#"', h)


def ticker():
    t = cut(TODAY_BODY, '<div class="ticker"', "<main", incl_end=False)
    t = re.sub(r'<a [^>]*>Kling 4\.0.*?</a>', "", t, flags=re.S)  # not a startup: the filter drops it
    return re.sub(r'href="/[^"]*"', 'href="#"', t)


def mast():
    m = cut(TODAY_BODY, '<div class="mast">', '<div class="glowframe"', incl_end=False)
    m = m.replace('data-live="ago">Updated </span>', '>Updated 1h ago</span>')  # filled by script on the live site
    return re.sub(r'href="/[^"]*"', 'href="#"', m)


def footer():
    return re.sub(r'href="/[^"]*"', 'href="#"', cut(TODAY_BODY, '<footer class="foot">', "</footer>"))


NAV = [("today.html", "Today"), ("pipeline.html", "Pipeline"), ("company.html", "Company Page"), ("brief.html", "IC Meeting"), ("tracking.html", "Tracking")]


def strip(current):
    links = "".join(f'<a href="{f}"{" aria-current=page" if f == current else ""}>{n}</a>' for f, n in NAV)
    sw = ""
    return (f'<div class="x-preview"><span class="x-pv">Scout V2 Preview</span><nav>{links}</nav><span class="x-sws">{sw}</span>'
            f'<span class="x-modes"><button type="button" data-theme="dark" aria-pressed="true">Dark</button><button type="button" data-theme="light" aria-pressed="false">Light</button></span>'
            f'<span class="x-pvnote" id="pvnote"></span></div>')


THEATER = (f'<div class="x-theater" hidden role="dialog" aria-modal="true" aria-label="Video"><div class="x-thpanel">'
           f'<div class="x-thhead"><span class="x-thco"></span><button class="x-thclose" type="button" title="Close (Esc)">{ico("x")}<span>Close</span></button></div>'
           f'<div class="x-thstage"></div><div class="x-thbar"><button class="x-thplay" type="button">{ico("pause", "x-ico fill")}<span>Pause</span></button>'
           f'<button class="x-thsound" type="button">{ico("sound")}<span>Mute</span></button><span class="x-thnote"></span>'
           f'<a class="x-btn site cta x-thsite" href="#" target="_blank" rel="noopener">{ico("ext")}<span>Visit Website</span></a></div></div></div>')

CSS_LINKS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
             '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bruno+Ace&family=Oswald:wght@500;600;700&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap">'
             '<link rel="stylesheet" href="source/scout-live.css"><link rel="stylesheet" href="v2.css">')


def media_json():
    return json.dumps({c["k"]: dict(name=c["name"], site=c.get("site"), kind=c["media"]["kind"], yt=c["media"].get("yt"), mp4=c["media"].get("mp4"),
                                    poster=IMG + c["media"].get("poster", ""), fit=c["media"].get("fit", "cover"), play=c["media"].get("play", ""),
                                    logo=(IMG + c["logo"]) if c.get("logo") else "") for c in CO})


def doc(fname, title, body, note, manifest=None):
    dflt = " ".join(f'data-{k}="{v}"' for k, v in DEFAULTS.items())
    man = f'<script type="application/json" id="variation-manifest">{json.dumps(manifest)}</script>' if manifest else ""
    return (f'<!doctype html><html lang="en" data-theme="dark" {dflt}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>{e(title)}</title>{CSS_LINKS}</head><body data-note="{e(note)}">{strip(fname)}{body}'
            f'{THEATER}<script type="application/json" id="x-media">{media_json()}</script>{man}<script src="v2.js"></script></body></html>')


def site_page(fname, title, active, main, note):
    return doc(fname, title, f'<div id="app-root"><div class="app">{header(active)}{ticker()}<main id="main">{main}</main>{footer()}</div></div>', note)


# ---------------------------------------------------------------- pages
def today_main():
    radar = [c for c in RANKED if c is not MUST]
    return (f'{mast()}<section class="x-sec"><div class="x-sech"><h2 class="x-h2">Must See</h2><span class="x-count">The Highest Thesis-Fit Startup Recently in the News</span></div>{hero(MUST)}</section>'
            f'{race()}'
            f'<section class="x-sec"><div class="x-sech"><h2 class="x-h2">On the Radar</h2><span class="x-count" data-count2>{len(radar)} Companies by Fit</span></div>'
            f'<div class="x-fwrap" id="fbar">{filter2()}</div><div class="x-grid3" id="radar">{"".join(tile(c) for c in radar)}</div><p class="x-empty" id="empty" hidden>No company matches these filters.</p></section>')


def pipeline_main():
    def sel(label, key, opts):
        o = "".join(f'<option value="{v}">{e(n)}</option>' for v, n in opts)
        return f'<label class="fsel">{label}<select aria-label="{label}" data-psel="{key}"><option value="">All</option>{o}</select></label>'
    new_n = sum(1 for c in CO if c["new"])
    head = (f'<div class="ph"><h1>Pipeline</h1><span class="count">{len(CO)} companies inside the thesis · {new_n} new this week · sorted by thesis fit</span>'
            f'<div class="views" role="group" aria-label="View"><button aria-pressed="true">List</button><button aria-pressed="false">Board</button></div></div>'
            f'<div class="filters x-pfilters"><label class="fsearch">{ico("search", "ico")}<input placeholder="Search the Pipeline" aria-label="Search the Pipeline" data-psearch autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>'
            + sel("Funds Raised", "bucket", [(str(i), n) for i, (n, _) in enumerate(BUCKETS)])
            + sel("Category", "area", [(x.lower(), x) for x in AREAS])
            + sel("Fit", "fit", [("50", "50%+"), ("45", "45%+")])
            + sel("Signal", "signal", [("yc", "Y Combinator"), ("news", "News"), ("appstore", "App Store"), ("formd", "Form D")])
            + sel("Seen", "seen", [("week", "This Week"), ("month", "This Month")])
            + sel("Rating", "rating", [("up", "Voted Up"), ("down", "Voted Down")])
            + f'<button class="fclear" data-pclear>Clear Filters</button></div>')
    rows = "".join(row(c, i + 1) for i, c in enumerate(RANKED))
    return f'{head}<div class="x-rows" id="prows">{rows}</div><p class="x-empty" id="pempty" hidden>No company matches these filters.</p>'


def company_main():
    c = BY["topdog"]
    crumb = f'<nav class="crumb" aria-label="Breadcrumb"><a href="pipeline.html">Pipeline</a><span>›</span><span>{e(c["name"])}</span></nav>'
    secs = re.findall(r"<section.*?</section>", CO_BODY[CO_BODY.index('<div class="dbody"'):], flags=re.S)
    pick = {}
    for s in secs:
        lab = re.search(r'aria-label="([^"]+)"', s).group(1)
        s = re.sub(r'href="/[^"]*"', 'href="#"', s.replace("btn red", "btn")).replace("International Dance League", c["name"])
        pick[lab] = s
    sim = [BY[k] for k in ("spill", "melty", "spash", "tash")]
    sim_html = ('<section class="sec" aria-label="Similar in the Pipeline"><div class="h"><h2>Similar in the Pipeline</h2></div><div class="x-sim">'
                + "".join(f'<a href="#">{logo(s, "x-logo sm")}<span><b>{e(s["name"])}</b><span>{e(s["why"])}</span></span>{fit_ring(s, "sm")}</a>' for s in sim) + "</div></section>")
    near = [("Eloelo", "eloelo.png", "A live social gaming app that brings together live streaming, community-based gaming and creator-hosted rooms."),
            ("Kolex", "kolex.png", "Trading cards rebuilt as a bridge between physical and digital collections."),
            ("Wizard", None, "AI that simplifies making and distributing game videos."),
            ("Storycraft", None, "A mobile multiplayer simulation game where players craft worlds and bond with characters.")]
    near_html = ('<section class="sec" aria-label="Nearby in the Portfolio"><div class="h"><h2>Nearby in the Portfolio</h2></div><div class="x-sim">'
                 + "".join(f'<a href="#">{pf_logo(n, "x-logo sm")}<span><b>{e(n)}</b><span>{e(t)}</span></span></a>' for n, f, t in near) + "</div></section>")
    record = ('<section class="sec" aria-label="Record"><div class="h"><h2>Record</h2></div><dl class="kv"><dt>Area</dt><dd>Gaming</dd>'
              '<dt>Funds Raised</dt><dd>$4.1M · Seed · 2 Rounds</dd><dt>Thesis Fit</dt><dd>47%</dd><dt>Overlaps with</dt><dd>Eloelo</dd>'
              '<dt>First seen</dt><dd>09-24-26</dd><dt>Last signal</dt><dd>10-02-26</dd><dt>Status</dt><dd>New</dd><dt>Tracked by</dt><dd>Not tracked</dd></dl></section>')
    body = (f'<div class="dbody"><div class="dcol">{pick["Team Notes"]}{pick["Draft Investment Memo"]}</div>'
            f'<div class="dcol">{sim_html}{near_html}{record}</div></div>')
    return f'<div>{crumb}{deal_sheet(c)}{rounds_table(c)}<div class="rule"></div>{body}</div>'


# ---------------------------------------------------------------- IC Meeting
FRAGS = {}  # the parts we write on pages that are otherwise the live page (the Title Case guard checks these)


def neighborhood(m):
    """Neighborhood Deals: one entry per story. Two headlines about the same funder and amount are one story;
    the extra coverage sits behind a Sources button instead of repeating the deal."""
    sec = m[m.index('<h2 id="neighborhood">'):m.index('<h2 id="formd">')]
    items = re.findall(r'<li><a href="([^"]+)"[^>]*>(.*?)</a>\s*(?:<!-- -->)?·\s*(?:<!-- -->)?(.*?)</li>', sec, flags=re.S)
    groups = {}
    for url, title, funder in items:
        title, funder = html.unescape(title).strip(), html.unescape(funder).strip()
        amt = re.search(r"\$\s?(\d+(?:\.\d+)?)\s?(M|Million|B|Billion)", title, flags=re.I)
        key = (funder, f"{amt.group(1)}{amt.group(2)[0].upper()}" if amt else title.lower())
        groups.setdefault(key, []).append((url, title))
    lis = ""
    for (funder, _), stories in groups.items():
        url, title = stories[0]
        more = ""
        if len(stories) > 1:
            items_html = "".join(f'<li><a href="{e(u)}" target="_blank" rel="noopener">{e(t)}</a></li>' for u, t in stories)
            more = (f' <span class="x-pop"><button class="x-srcbtn" type="button" aria-expanded="false">{ico("info")}<span>{len(stories)} Sources</span>{ico("down")}</button>'
                    f'<span class="x-popbox" hidden><b>Every Story About This Deal</b><ul>{items_html}</ul></span></span>')
        lis += f'<li><a href="{e(url)}" target="_blank" rel="noopener noreferrer" title="Opens the story in a new window">{e(title)}</a> · {e(funder)}{more}</li>'
    out = f'<h2 id="neighborhood">Neighborhood Deals</h2><ul class="x-nlist">{lis}</ul>'
    FRAGS.setdefault("brief.html", "")
    FRAGS["brief.html"] += out
    return out, len(items) - len(groups)


def brief_main():
    m = live_main(BRIEF_BODY)
    top = RANKED[:5]
    rows = f'<h2 id="startups">Top 5 Startups This Week</h2><div class="x-rows brief">{"".join(row(c, i + 1) for i, c in enumerate(top))}</div>'
    FRAGS["brief.html"] = rows
    m = m[:m.index('<h2 id="startups">')] + rows + m[m.index('<h2 id="trends">'):]
    nb, merged = neighborhood(m)
    m = m[:m.index('<h2 id="neighborhood">')] + nb + m[m.index('<h2 id="formd">'):]
    m = m.replace(">Top 5 new startups<", ">Top 5 startups this week<")
    return m, merged


# ---------------------------------------------------------------- Tracking
NIKE_SIG = [(html.unescape(re.sub(r"<[^>]+>", "", w)).strip(), html.unescape(re.sub(r"^Opens | in a new window$", "", t)), "", u)
            for u, t, w in re.findall(r'<a [^>]*href="([^"]+)"[^>]*title="([^"]*)"[^>]*>(.*?)</a>', TRACK_BODY[TRACK_BODY.index('<article class="t1"'):TRACK_BODY.index("</article>", TRACK_BODY.index('<article class="t1"'))])
            if u.startswith("https://news.google")]
NIKE = dict(k="nike", name="Nike", area="Outside the Thesis", fit=28, logo="nike-fav.png", site="nike.com", media=dict(kind="site", img="nike-og.jpg"),
            funds=dict(amt="Unknown", n=None, stage=None, note="", src=[]), new=False, ov=None,
            why="Added by the team; Scout checks news, filings and shows for it every morning.", sig=NIKE_SIG)


def tracking_main():
    m = live_main(TRACK_BODY)
    tracked = [NIKE, BY["axo"], BY["topdog"]]
    rows = f'<div class="x-rows track">{"".join(row(c, i + 1, tracked=True) for i, c in enumerate(tracked))}</div>'
    FRAGS["tracking.html"] = rows
    i = m.index('id="panel-companies"')
    j = m.index('<div role="tabpanel" id="panel-trends"')
    seg = re.sub(r'<article class="t1".*?</article>', rows, m[i:j], count=1, flags=re.S)
    m = m[:i] + seg + m[j:]
    return m.replace('title="Show Companies">Companies<b>1</b>', f'title="Show Companies">Companies<b>{len(tracked)}</b>')


# ---------------------------------------------------------------- option pages (taste manifests)
def option_page(fname, title, lede, subject, options, rec, compares, render):
    cards = ""
    for oid, name, desc, motion, tokens in options:
        cards += (f'<article class="x-opt" data-variation="{oid}"><div class="x-ophead"><span class="x-letter">{oid}</span><div><h2 class="x-h2">{e(name)}</h2>'
                  f'<p>{e(desc)}</p>{f"<p class=x-motion>{e(motion)}</p>" if motion else ""}</div>'
                  f'<a class="x-btn ghost" href="today.html?{fname[0]}={oid}">{ico("arrow")}<span>See It on the Homepage</span></a></div>'
                  f'<div class="x-opbody">{render(oid)}</div></article>')
    manifest = {"project": "Courtside Ventures", "subject": subject, "surface": "layout" if fname != "hover.html" else "motion", "claude_rec": rec,
                "compares": compares, "options": [{"id": o[0], "name": o[1], "desc": o[2], "tokens": o[4]} for o in options]}
    body = (f'<main class="x-optpage"><h1 class="x-h1">{e(title)}</h1><p class="x-lede">{lede}</p>{cards}</main>')
    return doc(fname, title, body, "", manifest)


def website_page():
    pair = [BY["axo"], BY["snag"]]
    opts = [("1", "Filled or Ghost Globe", "A globe in a solid red circle when the official site is known; the same globe in a dashed, see-through circle when Scout would search for it.", "",
             {"visual": {"ornament": "icon", "accent": ["#cc003d"]}, "ux": {"state_signal": "fill"}}),
            ("2", "Globe with a Corner Badge", "One dark globe button everywhere. A small red arrow badge means it opens the company's site; a grey magnifier badge means it searches the web.", "",
             {"visual": {"ornament": "badge", "accent": ["#cc003d"]}, "ux": {"state_signal": "badge"}}),
            ("3", "Their Logo or a Search Globe", "When the site is known, the button IS the company's logo, ringed in red with an arrow: you see whose site opens. When it isn't, a globe with a magnifier.", "",
             {"visual": {"ornament": "logo", "accent": ["#cc003d"]}, "ux": {"state_signal": "identity"}}),
            ("4", "Browser Window", "A small browser window instead of a globe: with a red arrow badge it opens the site, with a magnifier badge it searches.", "",
             {"visual": {"ornament": "badge", "accent": ["#cc003d"]}, "ux": {"state_signal": "badge"}})]

    def render(o):
        side = "".join(f'<div class="x-wdemo"><span class="x-wbig">{web_icon(c)}</span><span class="x-wcap">{"Official Site Known" if c.get("site") else "No Site Yet: Searches the Web"}</span></div>' for c in pair)
        return f'<div class="x-wopt" data-only-w="{o}"><div class="x-grid3 two">{"".join(tile(c) for c in pair)}</div><div class="x-wside">{side}</div></div>'
    return option_page("website.html", "Website Icon Options", "Visit Website and Find Website without words. Each option shows a company whose official site is known (Axo Longevity) beside one where it isn't (Snag). Hover an icon for its name.",
                       "Scout V2 website icon", opts, "3", ["visual.ornament", "ux.state_signal"], render)


def filters_page():
    opts = [("1", "Labeled Rows", "Two clearly labeled rows: Funds Raised as one connected control, Category as chips. The extras and the count sit on a third row.", "",
             {"ux": {"structure": "labeled-rows", "density": "roomy", "filters": "inline"}, "visual": {"layout": "rows"}}),
            ("2", "Dropdown Bar", "One compact bar: a Funds Raised menu and a Category menu, each with counts, plus the two quick toggles. Matches the Pipeline's filters.", "",
             {"ux": {"structure": "dropdowns", "density": "compact", "filters": "menus"}, "visual": {"layout": "bar"}}),
            ("3", "Tabs and Funds Chart", "Category becomes tabs; Funds Raised becomes a small bar chart you click, so you see where the money sits before you filter.", "",
             {"ux": {"structure": "tabs-plus-chart", "density": "balanced", "filters": "visual"}, "visual": {"layout": "chart"}})]
    renders = {"1": filter1(), "2": filter2(), "3": filter3()}
    return option_page("filters.html", "Filter Options", "Three ways to filter On the Radar by <b>Funds Raised</b> and <b>Category</b>, kept apart so they never read as one list. See It on the Homepage opens each one working above the cards.",
                       "Scout V2 homepage filter", opts, "2", ["ux.structure", "visual.layout"], lambda o: f'<div class="x-fwrap demo" data-only="{o}">{renders[o]}</div>')


def hover_page():
    sample = [BY["tash"], BY["axo"], BY["spash"]]
    opts = [("1", "Veil", "The picture dims under a frosted veil and a clear button reads Click to View More Details.", "Motion: the veil fades in over 180 ms on hover.",
             {"motion": [{"element": "card", "kind": "fade", "duration_ms": 180, "reactivity": "event", "trigger": "hover", "pace": "fast", "text_moves": False}]}),
            ("2", "Rising Bar", "A bar slides up from the bottom of the picture with Click to View More Details and an arrow.", "Motion: the bar slides up over 220 ms on hover.",
             {"motion": [{"element": "card", "kind": "slide", "duration_ms": 220, "reactivity": "event", "trigger": "hover", "pace": "fast", "text_moves": True, "path": "line"}]}),
            ("3", "Side Tab", "The card lifts and a tab slides in from the right edge: Click to View More Details, with an arrow that nudges forward.", "Motion: the card lifts 6 px and the tab slides in over 200 ms on hover.",
             {"motion": [{"element": "card", "kind": "lift", "duration_ms": 200, "reactivity": "event", "trigger": "hover", "pace": "fast", "text_moves": True, "path": "line"}]})]
    return option_page("hover.html", "Hover Options", "Hovering a card on the radar now only says where a click goes: the company page. The why, signals and actions live there. Each option is shown hovered; hover the cards to see it move.",
                       "Scout V2 card hover", opts, "1", ["motion", "ux.feedback"],
                       lambda o: f'<div class="x-grid3 demo" data-only-h="{o}">' + "".join(tile(c, forced_hover=o if i == 0 else None) for i, c in enumerate(sample)) + "</div>")


def overlap_page():
    sample = [BY["tash"], BY["axo"], BY["imperfect"]]
    opts = [("1", "Portfolio Ribbon", "A violet ribbon across the card with the portfolio company's logo: Overlaps with Kolex · Courtside Portfolio. On the company page it becomes a full-width callout.", "",
             {"visual": {"ornament": "ribbon", "accent": ["#a48bff"]}, "ux": {"attention_cue": "color"}}),
            ("2", "Logo Pair", "Two logos side by side, the startup's and the portfolio company's, next to Overlaps with Kolex. You recognize the portfolio company at a glance.", "",
             {"visual": {"ornament": "badge", "accent": ["#a48bff"]}, "ux": {"attention_cue": "icon"}}),
            ("3", "Pinned Badge", "The portfolio company's logo pinned to the fit ring, plus a quiet Overlaps with Kolex line. The quietest of the three.", "",
             {"visual": {"ornament": "badge", "accent": ["#a48bff"]}, "ux": {"attention_cue": "icon", "detail": "one-line"}})]
    return option_page("overlap.html", "Overlap Options", "One term everywhere: <b>Overlaps with</b>. Each option marks a startup that overlaps with a Courtside portfolio company; the company page carries the same design at page size.",
                       "Scout V2 portfolio overlap", opts, "2", ["visual.ornament", "ux.attention_cue"],
                       lambda o: f'<div class="x-grid3 demo" data-only-o="{o}">' + "".join(tile(c) for c in sample) + "</div>"
                       f'<div class="x-ovdemo" data-only-o="{o}">{ov_panel(BY["topdog"])}</div>')


# ---------------------------------------------------------------- Title Case guard
SMALL = {"and", "for", "of", "the", "a", "an", "to", "in", "on", "at", "with", "or", "by"}  # same list as titleCase() in src/lib/format.ts
NAMES = {"tash", "citybiz", "md", "est."}  # brand names written in lowercase, file extensions


class Labels(HTMLParser):
    """Collects the text of every label-like element: buttons, links styled as buttons, chips,
    headings, table heads. Times, headlines (.x-headline) and prose are not labels."""
    TAGS = {"button", "h1", "h2", "h3", "h4", "th"}
    CLS = {"x-btn", "x-chip", "x-seg", "x-tab", "x-area", "x-new", "x-flabel", "x-stage", "x-note", "x-count", "x-sigbtn", "lane-chip", "x-howlink", "x-ov", "x-hov"}
    VOID = {"img", "br", "input", "meta", "link", "path", "circle", "rect", "polygon", "i"}

    def __init__(self):
        super().__init__()
        self.stack, self.found = [], []

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            return
        cls = set((dict(attrs).get("class") or "").split())
        skip = tag in ("time", "small", "svg", "select", "option", "textarea") or "x-headline" in cls or "callout" in cls
        self.stack.append([tag, tag in self.TAGS or bool(cls & self.CLS), "", skip])

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        while self.stack:
            t, lab, txt, skip = self.stack.pop()
            if self.stack and not skip:
                self.stack[-1][2] += txt
            if lab and not skip and txt.strip():
                self.found.append(" ".join(txt.split()))
            if t == tag:
                break

    def handle_data(self, data):
        if self.stack and not self.stack[-1][3]:
            self.stack[-1][2] += data


def title_case_errors(fragment):
    p = Labels()
    p.feed(fragment)
    bad = []
    for label in set(p.found):
        for i, tok in enumerate(label.split()):
            m = re.search(r"[A-Za-z][A-Za-z'’.]*", tok)
            if not m or m.start() > 0 and tok[0] not in "(\"'":
                continue  # numbers, money, symbols: "$22M", "5d", "+"
            w = m.group(0)
            if w in NAMES or (len(w) == 1 and w.isupper() and i > 0):  # "Series A"
                continue
            if i > 0 and w.lower() in SMALL:
                if w != w.lower():
                    bad.append(label)
                    break
            elif w[0].islower():
                bad.append(label)
                break
    return sorted(set(bad))


# ---------------------------------------------------------------- build
def main():
    global BRIEF
    BRIEF = brief_main()
    pages = {
        "today.html": site_page("today.html", "Scout · Today", "today", today_main(),
                                "Every card opens the Topdog page in this mockup."),
        "pipeline.html": site_page("pipeline.html", "Scout · Pipeline", "pipeline", pipeline_main(),
                                   "Funds Raised, Category and Fit filter the rows."),
        "company.html": site_page("company.html", "Scout · Topdog", None, company_main(), ""),
        "brief.html": site_page("brief.html", "Scout · IC Meeting", "brief", BRIEF[0],
                                f"Top 5 as Tile rows; Neighborhood Deals merges repeated stories ({BRIEF[1]} merged here)."),
        "tracking.html": site_page("tracking.html", "Scout · Tracking", "tracking", tracking_main(),
                                   "Nike is the one company tracked today; Axo Longevity and Topdog are shown as tracked to fill the tab."),
    }
    errors = {}
    for f, html_ in pages.items():
        mine = FRAGS[f] if f in FRAGS else re.sub(r'<header class="top">.*?</header>', "", html_[html_.index("<main"):] if "<main" in html_ else "", flags=re.S)
        bad = title_case_errors(html_[html_.index("<body"):].split('<div id="app-root">')[0] + mine)
        if bad:
            errors[f] = bad
        (HERE / f).write_text(html_)
    css = (HERE / "v2.css").read_text()
    optout = css[css.index("/* links: no live underline */"):].split("{", 1)[0]
    link_classes = set()
    for html_ in pages.values():
        for cls in re.findall(r'<a class="([^"]+)"', html_):
            first = next((k for k in cls.split() if k.startswith("x-")), None)
            if first:
                link_classes.add(first)
    missing = sorted(k for k in link_classes if f"a.{k}" not in optout)
    if missing:
        raise SystemExit(f"❌ These link classes would get the live site's red dotted hover underline: {missing}. Add them to the /* links: no live underline */ rule in v2.css.")
    if errors:
        raise SystemExit("❌ Labels not in Title Case:\n" + "\n".join(f"  {f}: {b}" for f, b in errors.items()))
    print(f"✅ wrote {', '.join(pages)} · {len(CO)} companies (cap drops: {', '.join(DROPPED)}) · every label is Title Case")


if __name__ == "__main__":
    main()
