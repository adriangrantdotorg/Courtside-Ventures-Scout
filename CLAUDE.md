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

## Map
- `src/lib/jobs/`: the 11 cron jobs (`index.ts` registry, `runner.ts` = job_runs rows, 240 s time box, resumable cursor). Routes: `src/app/api/cron/[job]`.
- `src/lib/sources/`: `http.ts` (one User-Agent, per-host gaps, back-off, source health), `parse.ts` (pure parsers, tested on `tests/fixtures/`), `fetchers.ts`.
- `src/lib/queries.ts`: every page read. `src/lib/score.ts` + `thesis.ts` + `companies.ts`: scoring, thesis rules, one company per domain.
- `src/components/`: `Shell.tsx` (nav, ⌘K, shortcuts, flag mode), `ui.tsx` (Overlay, toasts, error cards, confirm, Phase II door), `cards.tsx` (Dossier, Vote, Gauge).

## Gotchas
- Screen words: never "lane", "voices", "pattern", "Key Insight", "Context only", "thesis area" in prose; `cleanCopy()` in `src/lib/copy.ts` cleans seed text. A Playwright test fails on them.
- No `confirm()`/`alert()`, no errors through `toast()`, no ellipsis/line-clamp, no self-reloading pages: `tests/unit/rules.test.ts` greps the source.
- Every shown date goes through `src/lib/format.ts` (New York time); live times through `<Ago>/<Until>/<Clock>` in `src/components/Live.tsx`.
- A server component can't call a function exported from a `"use client"` module: shared helpers live in `src/lib/` (e.g. `labels.ts`).
- Live Playwright runs must stay read-only: the click test skips switches and `data-act` controls on `LIVE_URL`.
- YouTube's keyless feeds rate-limit with 404; `http.ts` backs off for 60 s. Google News links are redirects; the backtest never stores them.
- The SEC requires a contact email in the User-Agent (`SEC_CONTACT_EMAIL`).
- `scripts/step.ts` drives the build-progress page (`~/.courtside-ventures-scout/`) and `settings.build_progress`; `done: true` turns the Building page off.
- `RECURRING.md` is the defect ledger: add one line per fix.
