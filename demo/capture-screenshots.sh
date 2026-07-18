#!/usr/bin/env bash
set -euo pipefail

PWCLI_PATH="${PWCLI_PATH:-/Users/wenhanding/.codex/skills/playwright/scripts/playwright_cli.sh}"
BASE_URL="${ROOM50_DEMO_URL:-http://127.0.0.1:4173/demo/}"

mkdir -p demo/screenshots
"$PWCLI_PATH" open "${BASE_URL}#fail"
"$PWCLI_PATH" resize 1440 960
"$PWCLI_PATH" press Home
"$PWCLI_PATH" screenshot --filename=demo/screenshots/fail.png
"$PWCLI_PATH" goto "${BASE_URL}#pass"
"$PWCLI_PATH" press Home
"$PWCLI_PATH" screenshot --filename=demo/screenshots/pass.png
"$PWCLI_PATH" close
