#!/bin/bash
# One-off, a ship step: clears the unit tests' old writes from the live Settings › Sources (scripts/clean-test-health.ts).
# It cds to its own root, so the Run block can call it from anywhere.
set -u
cd "$(dirname "$0")/.." || exit 1
npx tsx scripts/clean-test-health.ts --write
