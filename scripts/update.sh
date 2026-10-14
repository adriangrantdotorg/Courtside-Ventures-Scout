#!/bin/bash
# npm run update: pull the newest version of Scout, migrate, build, deploy the tested build, check it.
set -u
cd "$(dirname "$0")/.." || exit 1
LOG=.logs; mkdir -p "$LOG"
fail() { printf '\n❌ %s\n   The way past it: %s\n' "$1" "$2"; exit 1; }
V() { npx --yes vercel@latest "$@"; }
[ -f .vercel/project.json ] || fail "this folder is not linked to a Vercel project yet" "run npm run launch first"
printf '▶ Pulling the newest version\n'
git pull --ff-only > "$LOG/pull-git.log" 2>&1 || fail "git pull did not fast-forward (see .logs/pull-git.log)" "git stash, then npm run update"
npm ci --no-audit --no-fund > "$LOG/npm.log" 2>&1 || fail "npm install failed (see .logs/npm.log)" "rm -rf node_modules && npm run update"
V env pull .env.local --yes > "$LOG/env.log" 2>&1
printf '▶ Migrating\n'
npm run -s db:migrate > "$LOG/migrate.log" 2>&1 || fail "the migration failed (see .logs/migrate.log)" "npm run update"
printf '▶ Building\n'
V pull --yes --environment=production > "$LOG/pull.log" 2>&1
V build --prod > "$LOG/build.log" 2>&1 || fail "the build failed (see .logs/build.log)" "fix what the log names, then npm run update"
printf '▶ Deploying the build\n'
V deploy --prebuilt --prod --yes > "$LOG/deploy.log" 2>&1 || fail "the deploy failed (see .logs/deploy.log)" "npm run update"
URL=$(grep '^SITE_URL=' .env.local | cut -d= -f2 | tr -d '"')
printf '▶ Checking %s\n' "$URL"
npx tsx scripts/verify-live.ts "$URL" --light > "$LOG/verify.log" 2>&1 || { tail -12 "$LOG/verify.log"; fail "a live check failed (see .logs/verify.log)" "fix what it names, then npm run update"; }
printf '\n✅ Scout is up to date: %s\n' "$URL"
