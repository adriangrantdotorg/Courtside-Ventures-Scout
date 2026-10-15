#!/bin/bash
# npm run launch [-- --from <step>]
# One command from a fresh clone to a live, filled, verified Courtside Ventures Scout.
# Five steps, each reported to the progress page and printed as the chat block:
#   1 Setup      the person first (Vercel sign-in, database terms), then install and environment alone
#   2 Database   migrate, load the launch seed
#   3 Build      one production build, the unit tests, the browser suite against that build
#   4 Deploy     upload the build that was just tested (no second build on Vercel)
#   5 Open       the live checks, the site opens, the first pull runs behind it
# Every failure prints what went wrong and the way past it, then stops. Rerun with --from <step> to resume.
set -u
cd "$(dirname "$0")/.." || exit 1
LOG=.logs; mkdir -p "$LOG"
FROM=1
while [ $# -gt 0 ]; do case "$1" in --from) FROM="$2"; shift 2 ;; --help|-h) sed -n '2,10p' "$0"; exit 2 ;; *) echo "unknown option: $1" >&2; exit 2 ;; esac; done
say() { printf '\n▶ %s\n' "$1"; }
openurl() { case "$(uname -s)" in Darwin) open "$1" ;; Linux) xdg-open "$1" > /dev/null 2>&1 || true ;; *) true ;; esac; }
fail() { printf '\n❌ %s\n   The way past it: %s\n' "$1" "$2"; exit 1; }
step() { npx tsx scripts/step.ts "$@"; }
pre() { bash scripts/prestart.sh state "$@"; }   # the plain page's moments before the full page exists
V() { npx --yes vercel@latest "$@"; }

# ---------- pre-flight (every run) ----------
command -v node >/dev/null 2>&1 || fail "Node.js is not installed" "install Node 20 or newer from nodejs.org, then run npm run launch again"
NODEV=$(node -p 'Number(process.versions.node.split(".")[0])')
[ "$NODEV" -ge 20 ] || fail "Node $NODEV is too old" "install Node 20 or newer from nodejs.org, then run npm run launch again"
command -v git >/dev/null 2>&1 || fail "git is not installed" "install git (on a Mac: xcode-select --install), then run npm run launch again"
for port in 4601 4602; do
  for pid in $(lsof -ti tcp:$port 2>/dev/null); do kill "$pid" 2>/dev/null; done
done

# ---------- 1 Setup: everything that needs a person comes FIRST, then the rest runs alone ----------
if [ "$FROM" -le 1 ]; then
  # Installing takes about a minute and needs nobody, so it runs in the background while the person signs in (10-14-26).
  npm ci --no-audit --no-fund > "$LOG/npm.log" 2>&1 &
  NPM_PID=$!
  bash scripts/prestart.sh open   # the progress page, from second zero: it says whose turn it is
  export SCOUT_STARTED_AT; SCOUT_STARTED_AT=$(cat "$HOME/.courtside-ventures-scout/started-at" 2>/dev/null || echo "")
  say "Checking what needs you first: the progress page opens in your browser now"
  if V whoami > "$LOG/whoami.log" 2>&1; then
    # Say so: on the fourth dry run (10-14-26) the agent read the launch script to learn why no sign-in page came
    say "Already signed in to Vercel as $(tail -1 "$LOG/whoami.log"): no sign-in page"
  else
    # No sign-in on this machine. The CLI opens Vercel's device page and waits; that page signs in an existing account
    # or creates a free one (email code, or GitHub / GitLab / Bitbucket). Nothing else to do here (10-14-26).
    say "Vercel needs you once: sign in on the page that opens (no account yet? the same page lets you create a free one)"
    pre signin
    V login > "$LOG/login.log" 2>&1 &
    LOGIN_PID=$!
    # While the CLI waits for the person, pick the sign-in link and code out of its output for the progress page
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      LURL=$(grep -oE 'https://vercel\.com/[^ ]+' "$LOG/login.log" 2>/dev/null | head -1)
      [ -n "$LURL" ] && break
      sleep 1
    done
    LCODE=$(printf '%s' "$LURL" | grep -oE 'code=[A-Za-z0-9-]+' | cut -d= -f2)
    [ -n "$LURL" ] && pre signin "$LURL" "$LCODE"
    wait "$LOGIN_PID" || fail "Vercel login did not complete (see .logs/login.log)" "run: npx vercel@latest login, sign in or create a free account on the page, then npm run launch again"
    pre start
    say "Signed in to Vercel"
  fi
  ACCOUNT=$(V whoami 2>/dev/null | tail -1)
  NAME=courtside-ventures-scout
  if [ -f .vercel/project.json ]; then
    NAME=$(node -p 'require("./.vercel/project.json").projectName' 2>/dev/null || echo "$NAME")
  else
    # Ask Vercel about each name. CLI 64 prints `project ls` to stderr, so parsing it saw no projects and the
    # 10-14-26 dry run linked the live reference project. Free only on project_not_found; any other answer stops.
    taken() {
      V project inspect "$1" > "$LOG/name.log" 2>&1 && return 0
      grep -q 'project_not_found' "$LOG/name.log" && return 1
      fail "Vercel could not say whether the project name $1 is free (see .logs/name.log)" "check the network, then npm run launch again"
    }
    BASE=$NAME; i=2
    while taken "$NAME"; do NAME="$BASE-$i"; i=$((i + 1)); done
    V link --yes --project "$NAME" > "$LOG/link.log" 2>&1 || fail "Vercel could not create or link the project $NAME (see .logs/link.log)" "run: npx vercel link --yes --project $NAME, then npm run launch again"
  fi
  V env pull .env.local --yes > "$LOG/env.log" 2>&1
  if ! grep -q '^DATABASE_URL=' .env.local 2>/dev/null; then
    neon_add() { V integration add neon --plan free_v3 --name "$NAME-db" -m region=iad1 -m auth=false --no-claim < /dev/null > "$LOG/neon.log" 2>&1; }
    say "Creating the free Neon database $NAME-db"
    if neon_add; then
      say "Database created; the terms were already accepted on this account, so no terms page"
    else
      # An account that never used Neon must accept its terms once. Run by an agent, the CLI does not wait: it prints the
      # accept-terms page and exits. So the launch opens that page itself and retries until the terms are in (10-14-26).
      TERMS=$(grep -oE 'https://vercel\.com/[^" ]*accept-terms[^" ]*' "$LOG/neon.log" | head -1)
      [ -n "$TERMS" ] || fail "the free Neon database was not created (see .logs/neon.log)" "read .logs/neon.log; if Vercel asks for a payment card, add none and say so in the handoff; otherwise run: npx vercel@latest integration add neon --plan free_v3 --name $NAME-db -m region=iad1 -m auth=false --no-claim, then npm run launch again"
      say "Neon needs you once: accept its terms on the page that opens ($TERMS)"
      pre terms "$TERMS"
      openurl "$TERMS"
      tries=0
      while ! neon_add; do
        tries=$((tries + 1))
        [ "$tries" -lt 30 ] || fail "the database terms were not accepted within 5 minutes (see .logs/neon.log)" "open $TERMS, accept the terms, then npm run launch again"
        sleep 10
      done
      pre start
      say "Terms accepted"
    fi
    V env pull .env.local --yes > "$LOG/env.log" 2>&1
    grep -q '^DATABASE_URL=' .env.local || fail "DATABASE_URL did not arrive from Neon (see .logs/env.log)" "open the project on vercel.com, Storage, connect the Neon database to all environments, then npm run launch again"
  fi
  pre walk
  printf '\n🚶 Nothing more is needed from you. You can walk away: the site opens in your browser by itself in a few minutes.\n'
  wait "$NPM_PID" || fail "npm install failed (see .logs/npm.log)" "rm -rf node_modules && npm run launch"
  (npx playwright install chromium > "$LOG/playwright.log" 2>&1 &)
  step 1 Setup --note "signed in, project $NAME linked, database created; setting the environment"
  ENVS=$(V env ls 2>/dev/null)
  SITE_URL="https://$NAME.vercel.app"
  if ! printf '%s' "$ENVS" | grep -q 'CRON_SECRET'; then CS=$(openssl rand -hex 24); for e in production preview development; do printf %s "$CS" | V env add CRON_SECRET "$e" > /dev/null 2>&1; done; fi
  if ! printf '%s' "$ENVS" | grep -q 'SEC_CONTACT_EMAIL'; then EM=$(V api /v2/user 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).user.email)}catch{console.log("hello@courtsidevc.com")}})'); for e in production preview development; do printf %s "$EM" | V env add SEC_CONTACT_EMAIL "$e" > /dev/null 2>&1; done; fi
  if ! printf '%s' "$ENVS" | grep -q 'SITE_URL'; then for e in production preview development; do printf %s "$SITE_URL" | V env add SITE_URL "$e" > /dev/null 2>&1; done; fi
  V env pull .env.local --yes > "$LOG/env.log" 2>&1
  step 1 Setup --note "project, database and environment ready (account: $ACCOUNT)"
fi

# ---------- 2 Database ----------
if [ "$FROM" -le 2 ]; then
  step 2 Database --note "creating the tables"
  npm run -s db:migrate > "$LOG/migrate.log" 2>&1 || fail "the database migration failed (see .logs/migrate.log)" "check DATABASE_URL in .env.local answers (npx tsx scripts/q.ts 'select 1'), then npm run launch -- --from 2"
  step 2 Database --note "loading the launch seed"
  npm run -s seed > "$LOG/seed.log" 2>&1 || fail "the launch seed did not load (see .logs/seed.log)" "npm run launch -- --from 2"
fi

# ---------- 3 Build and tests ----------
if [ "$FROM" -le 3 ]; then
  step 3 "Build and tests" --note "one production build (about a minute)"
  V pull --yes --environment=production > "$LOG/pull.log" 2>&1
  V build --prod > "$LOG/build.log" 2>&1 || fail "the production build failed (see .logs/build.log)" "fix the error the log names, then npm run launch -- --from 3"
  step 3 "Build and tests" --note "unit tests"
  npx vitest run > "$LOG/unit.log" 2>&1 || fail "a unit test failed (see .logs/unit.log)" "fix the test the log names, then npm run launch -- --from 3"
  if [ "${LAUNCH_SKIP_E2E:-}" = "1" ]; then
    step 3 "Build and tests" --note "browser suite skipped on request (LAUNCH_SKIP_E2E=1)"
  else
    step 3 "Build and tests" --note "browser suite against the build (about two minutes)"
    for pid in $(lsof -ti tcp:4601 2>/dev/null); do kill "$pid" 2>/dev/null; done
    npx playwright test > "$LOG/e2e.log" 2>&1 || fail "a browser test failed (see .logs/e2e.log)" "rerun once with npm run launch -- --from 3; if the same test fails again on this machine, LAUNCH_SKIP_E2E=1 npm run launch -- --from 3"
  fi
fi

# ---------- 4 Deploy ----------
if [ "$FROM" -le 4 ]; then
  step 4 Deploy --note "uploading the build that was just tested"
  [ -d .vercel/output ] || { V pull --yes --environment=production > "$LOG/pull.log" 2>&1; V build --prod > "$LOG/build.log" 2>&1 || fail "the production build failed (see .logs/build.log)" "fix the error the log names, then npm run launch -- --from 3"; }
  V deploy --prebuilt --prod --yes > "$LOG/deploy.log" 2>&1 || fail "the deploy failed (see .logs/deploy.log)" "npm run launch -- --from 4"
fi

# ---------- 5 Open ----------
NAME=$(node -p 'require("./.vercel/project.json").projectName' 2>/dev/null || echo courtside-ventures-scout)
# The PUBLIC address only (scripts/live-url.sh). The per-deploy address is behind Vercel's login wall: the third dry
# run (10-14-26) checked it, every page answered 302 to vercel.com, and the wall's address leaked into SITE_URL.
URL=$(bash scripts/live-url.sh "$LOG/deploy.log" .vercel/project.json)
step 5 Open --live "$URL" --note "waiting for the address to answer"
for _ in $(seq 1 30); do [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/")" = "200" ] && break; sleep 3; done
[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/")" = "200" ] || fail "the site at $URL is not answering yet (see .logs/deploy.log)" "wait a minute, then npm run launch -- --from 4"
if ! grep -q "SITE_URL=\"\\?$URL" .env.local 2>/dev/null; then
  for e in production preview development; do V env rm SITE_URL "$e" --yes > /dev/null 2>&1; printf %s "$URL" | V env add SITE_URL "$e" > /dev/null 2>&1; done
fi
step 5 Open --live "$URL" --note "checking the live site"
CS=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2 | tr -d '"')
CRON=$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $CS" "$URL/api/cron/alerts")
[ "$CRON" = "200" ] || printf '⚠️ the alerts job answered %s on the live site; the daily jobs may need a look (vercel.com, the project, Crons)\n' "$CRON"
npx tsx scripts/verify-live.ts "$URL" --light > "$LOG/verify.log" 2>&1 || { tail -12 "$LOG/verify.log"; fail "a live check failed (see .logs/verify.log)" "fix what it names, then npm run launch -- --from 4"; }
step 5 Open --live "$URL" --note "live and verified; opening it" --done
openurl "$URL"
nohup npm run -s pipeline:all > "$LOG/pipeline.log" 2>&1 &
ACCOUNT=$(V whoami 2>/dev/null | tail -1)
printf '\n✅ Courtside Ventures Scout is live: %s\n   Vercel account: %s · project: %s\n   The first pull of fresh sources is running behind the site (.logs/pipeline.log); the daily jobs take over tomorrow.\n   Later, to get the newest version: npm run update\n' "$URL" "$ACCOUNT" "$NAME"
