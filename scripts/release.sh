#!/bin/bash
# npm run release: the only way main moves (Adrian's side). Every check green, the launch seed re-exported
# from this database so a fresh launch starts as current as this push, then commit and push.
set -u
cd "$(dirname "$0")/.." || exit 1
fail() { printf '\n❌ %s\n' "$1"; exit 1; }
printf '▶ The full check\n'
npm run -s check > .logs/release-check.log 2>&1 || { grep -E 'failed|✗|error' .logs/release-check.log | tail -12; fail "the check is not green (see .logs/release-check.log); nothing was pushed"; }
printf '▶ Re-exporting the launch seed\n'
npx tsx scripts/export-seed.ts seed/scout-launch-seed.json > .logs/seed-export.log 2>&1 || fail "the seed export failed (see .logs/seed-export.log); nothing was pushed"
tail -1 .logs/seed-export.log
git add -A
if git diff --cached --quiet; then printf 'nothing to release\n'; exit 0; fi
MSG=${1:-"Release $(date +%m-%d-%y)"}
git commit -q -m "$MSG" && git push origin main && printf '\n✅ released: %s\n' "$MSG"
