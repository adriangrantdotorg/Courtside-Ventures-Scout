# Courtside Ventures Scout

A deal-sourcing site for Courtside Ventures, a prototype by Adrian Grant. Live: https://courtside-ventures-scout.vercel.app

## Audience and voice (Adrian, 10-15-26)
- *Trigger:* you write or edit any words a person reads: page copy, labels, tooltips, empty states, alerts, the Monday brief, Slack posts, the README.
- *Who reads it:* busy venture capitalists at Courtside Ventures, who invest in pre-seed and seed startups in the entertainment space (sports, gaming, lifestyle, health, media).
- *Voice:* professional and concise, with a casual startup vibe. Lead with the value to an investor: what they learn or can act on in seconds.
- *Discrimination:* code comments, commit messages, CLAUDE.md and test names are for developers and keep their own plain style. Existing copy is not rewritten just to match; the rule applies to copy you write or touch from now on.

## Stack
- Next.js 16 App Router + TypeScript (`src/app`), Cache Components OFF: pages use `export const revalidate = 300` and every write calls `revalidatePath("/", "layout")`.
- Drizzle ORM on Neon Postgres (`src/db/schema.ts`, migrations in `drizzle/`). Plain CSS on tokens (`src/app/globals.css`); the look of record is `design/*.html`.
- A Vercel Hobby project named `courtside-ventures-scout` (or the next free name), deployed from the CLI by `npm run launch` and `npm run update`, never from git.

## Commands
- `npm run check`: typecheck, lint, vitest, `next build`, Playwright (starts its own server on :4601; kill stray servers by PID first).
- `npm run verify:live -- <url>`: live checks, read-only browser suite, then a residue query (votes, trackers, change_log must be 0).
- `npm run pipeline:all [-- job ...]`: run the daily jobs locally against the real database (long: run in the background to `.logs/`).
- `npm run db:migrate` after `npx drizzle-kit generate --name <x>`; `npm run seed` loads `seed/scout-launch-seed.json`.
- Deploy: `npx vercel@latest deploy --prod --yes`, then POST `/api/revalidate` with `Authorization: Bearer $CRON_SECRET`.
- `npx tsx scripts/q.ts "<sql>"`: one-off SQL against the database in `.env.local` (`vercel env pull .env.local`).
- `npx tsx scripts/local-db.ts`: a local copy of the data in the current schema (`.local-db/scout.tar.gz`, read-only on the shared database). Then `SCOUT_PGLITE=.local-db/scout.tar.gz` in front of `npx tsx scripts/pipeline-all.ts <job>`, `npx next build`, `npx next start -p 4601` or `npx playwright test` runs everything on the copy. Use it to check a schema change before the shared database is migrated (migrating it is a production change: ask first).
- `npm run check:ai`: a real call to each AI model Scout uses (the daily on/off check on Gemini 2.5 Flash-Lite, the AI Thesis Check on GPT-5 mini, memo drafts on GPT-5), through AI Gateway; writes nothing. Every model must stay on AI Gateway's free tier (no Claude model is on it), which allows 5 calls a minute per model. Refresh `.env.local` first: the local OIDC token expires.
- AI budget: the caps in `src/lib/ai.ts` (4 memo drafts, 60 thesis checks a day, plus one launch day a month of up to 300 more) keep a month that hits them all under the free $5; a unit test does the sum. Every AI call has a time limit (`TIMEOUTS`), and a check never runs past the room its job has left; a unit test stalls a fake model to prove it. The thesis-check backlog after a backfill: `npm run pipeline:all -- thesis-check` (60 a day, best scores first), or on ship day `npm run pipeline:all -- thesis-check-all --rounds=20` (every waiting card, about 20 per 270 s round).
- Ship day for V2, in this order (Adrian, 10-26-26: the live site complete the moment it ships; shipped 10-27-26, about 1.5 hours; the recipe for any release that changes the schema):
  1. `npx vercel@latest env pull .env.local` (the local AI token expires), then the full check on a fresh local copy: `npx tsx scripts/local-db.ts .local-db/ship.tar.gz`, and with `SCOUT_PGLITE=.local-db/ship.tar.gz` the typecheck, lint, vitest, `next build` and `playwright test` (the shared database has no new columns yet, so `npm run check` against it would fail).
  2. `npm run db:migrate` on the shared database (additive: V1 keeps working).
  3. Fill the live data in the background with the Mac kept awake (about 1.5 hours; a sleeping Mac pauses it): `npm run pipeline:all -- backfill library score enrich --rounds=5`, then `npm run pipeline:all -- thesis-check-all --rounds=20`.
  4. Hide Sprocket Sports (`/api/hidden` keep: false; the AI check lets it in).
  5. `npm run update` (builds, deploys V2, light live check), then POST `/api/revalidate`.
  6. `npm run verify:live -- <url>` and `npm run check:ai`.
  7. The launch seed: `scripts/export-seed.ts` and the loader in `src/lib/seed.ts` carry V2's company fields (rounds, total raised, media, the startup filter's verdicts, AI checks), then `npm run seed:export` from the filled live data, so a fresh install looks like V2 on day one.
  8. The README for V2: a new Today screenshot `docs/today.png` from the live site (it still shows V1's Spotlight, top picks, Velocity and Sponsor Radar), the Today line ("Top 5 cos"), and "Try first" (the Spotlight and today's top picks).
  9. Commit the seed and the README; Adrian presses the push.
- `npx tsx scripts/media-check.ts [--recheck]`: which cards' saved website pictures, videos and logos no longer load (read-only; `--recheck` queues them for the next enrich run). The enrich job itself drops links that don't load (`mediaLoads()` in `src/lib/sources/http.ts`).
- `npm run brand:backfill [-- --limit=80 --all]`: Brand Sky's parts (hero art, header logo, colors) for cards that lack them, best fit first; writes only `media.brand`, then refreshes the live pages. Run once after the Brand Sky deploy; the daily enrich keeps them current.
- `SCOUT_PGLITE=<copy> npx tsx scripts/local-promote.ts <id>`: on a local copy only, make one startup Must See (to see how the masthead draws it); then restart `next start` on the copy and POST `/api/revalidate`.
- `npx tsx scripts/coverage.ts`: the coverage check (the startups the team saved: is each in Scout, and which step missed it). Read-only.
- The Library backfill (`library` job, `src/lib/jobs/library.ts`): the startups the team saved (`src/lib/library.ts`: the Library of Links and the Consumer / AI thesis page, pulled from Notion 10-26-26; Scout can't read Notion, so re-pull when they change) get a name search for a funding story from the last two years, and the AI Thesis Check is the screen; a startup the team wants in Scout goes in as `team("<name>")`.
- Second Look (`secondLook` in `src/lib/jobs/collect-signals.ts`, daily search and backfill): a headline that names a startup but no money gets one name search for its raise, and only an AI Thesis Check YES makes a card (Adrian, 10-26-26). No AI or no checks left today means no card. (Adrian, 10-26-26: "only for companies that are synergistic to Courtside"). Ship day only.
- `python3 design/v2/build.py`: regenerate the V2 mockups in `design/v2/` (fails on a label that isn't Title Case or a link that would take the live red hover underline); `design/v2/NOTES.md` holds the picks and the live-site behaviors to build.

## Map
- `src/lib/jobs/`: the 12 cron jobs (V2 added `enrich`: Funds Raised from every round, the website finder, the card's picture, the startup filter, duplicate cards) plus on demand: `backfill` (12 months of funding news, with Second Look), `library` (the startups the team saved), `thesis-check` and `thesis-check-all` (the AI backlog; the launch run) (`index.ts` registry, `runner.ts` = job_runs rows, 240 s time box, resumable cursor). Routes: `src/app/api/cron/[job]`.
- `src/lib/sources/`: `http.ts` (one User-Agent, per-host gaps, back-off, source health), `parse.ts` (pure parsers, tested on `tests/fixtures/`), `fetchers.ts`.
- `src/lib/queries.ts`: every page read. `src/lib/score.ts` + `thesis.ts` + `companies.ts`: scoring, thesis rules, one company per domain.
- `src/components/`: `Shell.tsx` (nav, ⌘K, shortcuts, flag mode, scroll-to-top, the video player), `ui.tsx` (Overlay, toasts, error cards, confirm, Phase II door), `cards.tsx` (Vote, the six actions), `V2.tsx` (Tile, Hero, Row, The Combine, Radar + Dropdown Bar, Deal Sheet, Theater). Styles: `src/app/v2.css`, ported from `design/v2/v2.css`.
- `src/lib/v2.ts` (the $15M cap, Funds Raised text and ranges, New, buckets) and `src/lib/enrich.ts` (rounds, the startup filter, duplicates, the website check, the picture order): pure, tested in `tests/unit/v2.test.ts`.

## Gotchas
- Screen words: never "lane", "voices", "Key Insight", "Context only", "thesis area" in prose, nor Scout's own "the X pattern", nor "near / close to / next to X in the portfolio" (a tie is only the Overlaps With tag, 10-30-26); `cleanCopy()` in `src/lib/copy.ts` cleans seed text. A company's own words stay ("nightly sleep patterns" once read "sleep play", 10-27-26). A Playwright test fails on the banned words.
- No `confirm()`/`alert()`, no errors through `toast()`, no ellipsis/line-clamp, no self-reloading pages: `tests/unit/rules.test.ts` greps the source.
- Every shown date goes through `src/lib/format.ts` (New York time); live times through `<Ago>/<Until>/<Clock>` in `src/components/Live.tsx`.
- A server component can't call a function exported from a `"use client"` module: shared helpers live in `src/lib/` (e.g. `labels.ts`).
- Live Playwright runs must stay read-only: the click test skips switches and `data-act` controls on `LIVE_URL`.
- YouTube's keyless feeds rate-limit with 404; `http.ts` backs off for 60 s. Google News links are redirects; the backtest never stores them.
- The SEC requires a contact email in the User-Agent (`SEC_CONTACT_EMAIL`).
- `scripts/step.ts` drives the build-progress page (`~/.courtside-ventures-scout/`) and `settings.build_progress`; `done: true` turns the Building page off.
- `RECURRING.md` is the defect ledger: add one line per fix.
- A local run that stalls for minutes (a job round far past its 270 s, a gap in `thesis_check->>'at'` times): check whether the Mac slept before blaming the code, `pmset -g log | grep -E ' Sleep |DarkWake'` against the stall's start and end. A sleeping Mac freezes the run, and on wake the job sees its time box as used (10-26-26: two "AI stalls" were sleep).
- Security upgrades: read `npm audit --omit=dev`, then `npm install --save-exact <pkg>@<fixed>`. Never `npm audit fix --omit=dev`: it removes the dev tools from `node_modules` (and `npx` then quietly runs downloaded copies); `npm install` restores them (10-26-26, Next.js 16.4.0 → 16.4.3).
- Labels are Title Case, in the app AND in every design mockup (*Trigger:* you write a button, chip, menu row, tab or heading, including in `design/`; *Discrimination:* prose, headlines and tooltips stay sentences): `titleCase()` in `src/lib/format.ts` (small words lowercase); `design/v2/build.py` fails on a label that isn't. Reported twice (10-12-26, 10-26-26).
- V2 redesign (10-26-26): red is the main call to action only (Visit Website); thesis fit is the headline number, then Funds Raised; videos play in Scout's own player, never on YouTube. Decisions and live-site behaviors: `design/v2/NOTES.md`.
- A picture with a fallback is `<Img onFail>` (`V2.tsx`), never `<img onError>`: a server-rendered image can fail before React attaches onError and then stays broken; `Img` re-checks after hydration with `decode()` (an SVG with no size reports naturalWidth 0 yet decodes). A rules test greps for it (10-30-26).
- Images are measured with sharp (`src/lib/jobs/brand.ts`). `npm run update` builds on the Mac, so sharp's Mac engine ships; on Vercel it falls back to its WebAssembly engine, which `next.config.ts` traces into the cron function (`outputFileTracingIncludes`). If neither loads, the enrich run logs an error and keeps the saved Brand Sky parts (10-30-26).
- Playwright's headless Chrome gets a 403 bot page from some image hosts (Vercel Blob's `*.public.blob.vercel-storage.com`; Chrome then blocks it as ORB), though Safari, curl and real visitors get the image. Tests never assume an outside image loads: they check what IS shown decodes, and the fallback covers the rest (10-30-26).
- Every Undo goes through `ui.undoable(label, save, undo)` (`src/components/ui.tsx`): it is on the stack the moment the action starts, so a fast ⌘Z never undoes the wrong thing. `pushUndo` is private; a rules test fails on it elsewhere.
- Every picture with no product picture (Must See, On the Radar, Pipeline rows, the company page) draws Brand Sky (`src/lib/brand.ts`, `BrandSky` in `V2.tsx`, parts found by `src/lib/jobs/brand.ts` during enrich): the startup's art and logo, else a sky in its colors with its icon and name, else its area's sky with a letter tile. Never a share image, never a gray letter (Adrian, 10-30-26). Decisions: `design/v2/NOTES.md`.
- Recommendations read `recommendable()` in `src/lib/queries.ts` (`companyCards("recommend")`): not a blog, big company's product or placeholder (`not_startup`), not a duplicate (`merged_into`), under the cap (`total_raised`). The team hides a stray with Not a Fit (every card's More menu) and restores one in Settings › Hidden Startups (`keep`).
- Scout never recommends a company that has raised $15M or more in total (Today, Pipeline, company pages, IC Meeting; Sponsor Radar and context pages are exempt). Unknown funding reads "Unknown". A tie to a portfolio company is always "Overlaps with …", never "Near", and only real competitors get it: a loose keyword match never shows on any page.
