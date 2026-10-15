#!/bin/bash
# npm run watch [-- <log>]: prints every new line of the launch log as it lands and stops when the launch is done.
# The agent that runs the prompt starts this ONCE as its background watcher (Claude Code: the Monitor tool) and relays
# each block to the chat. Two dry runs (10-14-26) improvised their own watcher command; this is the fixed one, so the
# third permission ask is always the same command. Exit 0 on the ✅ line, 1 on a ❌ line, 3 after WATCH_MINUTES
# (default 30) if the launch is still running (then run it again).
set -u
cd "$(dirname "$0")/.." || exit 1
F="${1:-.logs-launch.txt}"
MAX=$(( ${WATCH_MINUTES:-30} * 60 )); T0=$(date +%s); n=0
for _ in $(seq 1 60); do [ -f "$F" ] && break; sleep 1; done
[ -f "$F" ] || { echo "no launch log at $F yet: run npm run launch first"; exit 2; }
while :; do
  t=$(wc -l < "$F" | tr -d ' ')
  if [ "$t" -gt "$n" ]; then sed -n "$((n + 1)),${t}p" "$F"; n=$t; fi
  if grep -qE '^✅ ' "$F"; then exit 0; fi
  if grep -qE '^❌ ' "$F"; then sleep 1; t=$(wc -l < "$F" | tr -d ' '); [ "$t" -gt "$n" ] && sed -n "$((n + 1)),${t}p" "$F"; exit 1; fi
  [ $(( $(date +%s) - T0 )) -lt "$MAX" ] || { echo "still running after ${WATCH_MINUTES:-30} minutes: run npm run watch again"; exit 3; }
  sleep 2
done
