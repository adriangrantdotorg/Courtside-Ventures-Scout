# Courtside Ventures Scout

**Live:** https://courtside-ventures-scout.vercel.app

Deal sourcing for Courtside Ventures: startups, trends, sponsors, culture and funds inside Courtside's thesis (Sports, Gaming, Lifestyle, Health, Media), found every morning from free public sources. Every fact links to its source.

A non-commercial demo built by Adrian Grant to show what's possible. No payments, no ads.

## Three things to try

1. **Today:** the Spotlight (the day's one call, picked by rules) and the top five picks, each with its thesis-fit gauge, signals and a one-line "why it fits Courtside".
2. **Sponsor Radar:** every brand buying ads on the shows Courtside's world listens to.
3. **Press `?`** for the keyboard shortcuts (`j`/`k` to move, `u`/`d` to vote, `⌘K` to search everything).

## What runs each day (New York mornings)

| Job | When |
|---|---|
| Co-investor watch (the Neighborhood) | 2 AM ET |
| Synergistic funder watch | 3 AM ET |
| Creators and shows (YouTube and podcast feeds), people | 4 AM ET |
| Startup signals: SEC Form D and Form C, Hacker News, Y Combinator, Product Hunt, App Store charts, funding and industry news, Google Trends, Courtside's posts | 5 AM ET |
| Scoring, "why it fits", portfolio check | 6 AM ET |
| Alerts | 7 AM ET |
| Culture (mentions and stance) | 8 AM ET |
| Trends | 9 AM ET |
| Sponsor Radar | 10 AM ET |
| The Monday brief | Mondays, 11 AM ET |
| Weekly upkeep: portfolio, link checks, the 90-day podcast rule, new Courtside posts into the backtest | Sundays, 2 AM ET |

**Refresh Now** (on Today) pulls the fastest sources any time, once an hour for everyone. Vercel's free plan runs each job once a day, within the hour.

## Sources

SEC EDGAR (daily form index, filing details, full-text search), Hacker News, Y Combinator's open company list, Product Hunt, App Store charts, Google News, Google Trends' daily feed, Front Office Sports, Sportico, TechCrunch, Crunchbase News, Passionfruit, Tubefilter, Variety, Deadline, Puck, GamesIndustry.biz, The Verge, 100+ creators and shows (YouTube channel feeds and podcast feeds), fund news, blogs, newsletters and Form D filings for 106 funds, and Courtside's own Medium, portfolio page and The 4th Quarter. GitHub and GDELT are "extra sources", off by default (Settings › Sources).

## How to change anything

Most things change in **Settings** on the site (shared settings are saved for everyone, with a change log and Undo). For anything else, ask your agent, for example:

- "Add a creator or show to Scout" (or paste a YouTube channel URL, podcast name or RSS URL in Settings › Creators and Shows)
- "Turn off a source"
- "Change the scoring weights"

## Optional extras

- **AI drafting** (memo drafts, written summaries, plain-English alerts): runs on Vercel's free AI credit, which asks for a card on file; nothing is charged on the free credit. Say "turn on AI" to your agent.
- **Slack** (alert hits and the Monday brief in a channel): about 4 clicks, once. Say "set up Slack".

## Limits of the free edition

- Jobs run once a day each (Vercel Hobby); real-time is Phase II.
- YouTube's keyless channel feeds sometimes rate-limit; Scout backs off and the podcast feeds cover those creators meanwhile.
- Many shows insert ads automatically and leave them out of show notes, so Sponsor Radar sees part of the picture.
- X, Instagram, TikTok, Twitch, Kick, LinkedIn and PitchBook are links only; reading them needs the firm's accounts.

## Phase II

Phase I is a quick prototype; Phase II is the production-ready version we build together: team-only access, trusted ratings, real-time updates, email alerts, social networks through the firm's accounts, PitchBook and Crunchbase, and LinkedIn.

## Credit

Designed and specified by Adrian Grant ([LinkedIn](https://www.linkedin.com/in/adriangrant3/)). Built by an AI coding agent from his prompt.

---

## Build notes (for the agent and for Adrian)

- **Accounts:** Vercel `adriangrantdotorg` (team `adriangrantdotorgs-projects`); GitHub `adriangrantdotorg` (not used: the repo is local only). The site, the Neon database (`courtside-ventures-scout-3-db`, free plan, iad1) and the 11 cron jobs live on that Vercel account.
- **Name:** this build started as `courtside-ventures-scout-3` (two stopped runs held the plain name). On 10-14-26 those two projects were deleted and this project renamed to `courtside-ventures-scout`; the database keeps its first name, `courtside-ventures-scout-3-db`, and the local folder is still `courtside-ventures-scout-3`.
- **Stack:** Next.js 16 App Router (Cache Components turned off; pages use 5-minute ISR and are revalidated after every write and job), Drizzle ORM on Neon, plain CSS on the tokens from the six mockups in `design/`. Where the brief's color table and the mockups differ, the mockups' values are used (as the brief says).
- **Launch seed:** loaded from the Gist (73 portfolio, 143 creators and shows, 83 sponsors, 118 companies, 6 backtests, 19 trends, 106 funds, 350 fund items, 400 mentions). Older wording in the seed ("lane", "pattern", "Context only") is cleaned on screen. Backtest evidence that only had a Google News redirect URL was dropped (the brief requires the article's own URL).
- **Hand-verified backtest links:** Entrackr and World Soccer Talk load for scripts; Axios (403) and Business Wire block automated requests but open in a browser.
- **YouTube fixture:** YouTube's feeds were rate-limiting (404) during the build, so `tests/fixtures/youtube.xml` is written to the documented feed shape; every other fixture is a recorded real response.
- **Quality rules beyond the brief:** developer and B2B tools, incumbents (Google, Apple, …), pharma, and Form D filings under $250K never become pipeline cards; "Future", "Jump" and other portfolio names that are everyday words only count as a mention in a product context.
- **Free tiers (re-checked 10-14-26):** Vercel Hobby allows 100 cron jobs, each once a day, timing within the hour; Neon Free gives 1 GB per project and 100 CU-hours a month and sleeps after 5 idle minutes. Unchanged from the brief; nothing here uses a paid plan or key.
- **Commands:** `npm run check` (typecheck, lint, unit, integration, end-to-end), `npm run verify:live -- <url>`, `npm run smoke`, `npm run pipeline:all`, `npm run seed`, `npm run db:migrate`.
