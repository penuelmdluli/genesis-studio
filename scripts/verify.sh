#!/usr/bin/env bash
# ============================================
# Genesis Studio — pre-merge verification gate
# ============================================
# Usage:
#   bash scripts/verify.sh              # typecheck, lint, test, build
#   bash scripts/verify.sh --health     # also probe live provider health
#
# Runs the checks that would have caught what the 2026-09-09 audit found:
# a stale endpoint id reaching production, a dead provider, a claim in the
# copy that no longer matched the code.
#
# Deliberately does NOT fail on the pre-existing test failures. The suite had
# 32 failing tests before any of this work began (unrelated drift in
# db.test.ts, credits.test.ts and brain.test.ts). Gating on zero failures
# would mean the gate could never pass, so it is ignored and every commit
# gets checked instead of none. It DOES fail if the count grows — a new
# failure is a regression and must block.

set -uo pipefail
cd "$(dirname "$0")/.."

# Update these as the pre-existing debt is actually paid down. Measured
# 2026-09-09 on a clean checkout.
BASELINE_FAILURES=32
BASELINE_LINT_ERRORS=226

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
FAILED=0

step() { printf "\n%s==> %s%s\n" "$YELLOW" "$1" "$RESET"; }
ok()   { printf "%s  PASS%s  %s\n" "$GREEN" "$RESET" "$1"; }
bad()  { printf "%s  FAIL%s  %s\n" "$RED" "$RESET" "$1"; FAILED=1; }

# ── 1. Types ───────────────────────────────────────────────────────────
step "Typecheck"
# Stale generated route types survive a deleted route and produce phantom
# errors, so clear them first.
rm -rf .next/types .next/dev/types 2>/dev/null || true
if npx tsc --noEmit -p tsconfig.json; then
  ok "no type errors"
else
  bad "type errors"
fi

# ── 2. Lint ────────────────────────────────────────────────────────────
step "Lint"
# Same reasoning as the test baseline: src carries 226 pre-existing lint
# errors, almost all no-explicit-any and prefer-const. Demanding zero would
# mean the gate never passes and therefore never runs; demanding "no worse
# than before" catches the regression that actually matters.
LINT_OUT="$(npx eslint src 2>&1 || true)"
LINT_ERRORS="$(printf '%s' "$LINT_OUT" | grep -cE '^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+error' || true)"
if [ "${LINT_ERRORS:-0}" -le "$BASELINE_LINT_ERRORS" ]; then
  ok "$LINT_ERRORS lint errors (baseline $BASELINE_LINT_ERRORS)"
else
  printf '%s\n' "$LINT_OUT" | grep -E '^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+error' | head -20
  bad "$LINT_ERRORS lint errors, above the baseline of $BASELINE_LINT_ERRORS - regression"
fi

# ── 3. Tests ───────────────────────────────────────────────────────────
step "Tests"
TEST_OUT="$(npx vitest run 2>&1 || true)"
# Read the "Tests  N failed | M passed" summary line specifically. Matching
# the first "N failed" anywhere picked up the Test Files line and reported 3
# failures when there were 32 - a gate that lies is worse than no gate.
FAILING="$(printf '%s' "$TEST_OUT" | grep -E '^[[:space:]]+Tests[[:space:]]' | tail -1 | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' || echo 0)"
if [ "${FAILING:-0}" -le "$BASELINE_FAILURES" ]; then
  ok "$FAILING failing (baseline $BASELINE_FAILURES)"
else
  printf '%s\n' "$TEST_OUT" | grep -E '^ FAIL' | head -20
  bad "$FAILING failing, above the baseline of $BASELINE_FAILURES — this is a regression"
fi

# ── 4. Build ───────────────────────────────────────────────────────────
step "Build"
if npm run build >/tmp/genesis-build.log 2>&1; then
  ok "build succeeded"
else
  tail -30 /tmp/genesis-build.log
  bad "build failed"
fi

# ── 5. Live provider health (opt-in) ───────────────────────────────────
# Off by default because it needs CRON_SECRET and hits third-party APIs.
if [ "${1:-}" = "--health" ]; then
  step "Provider health (production)"
  SECRET="${CRON_SECRET:-$(grep -E '^CRON_SECRET=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"\r ')}"
  URL="${APP_URL:-https://ivideostudio.ai}/api/health/providers"

  if [ -z "$SECRET" ]; then
    printf "  %sSKIP%s  CRON_SECRET not available\n" "$YELLOW" "$RESET"
  else
    BODY="$(curl -s -m 45 "$URL" -H "Authorization: Bearer $SECRET" || true)"
    if printf '%s' "$BODY" | grep -q '"canGenerate":true'; then
      ok "a hosted provider can accept work"
      printf '%s' "$BODY" | grep -oE '"detail":"[^"]*"' | sed 's/^/       /'
    else
      printf '%s\n' "$BODY" | head -20
      bad "no hosted provider can currently generate"
    fi
  fi
fi

# ── Verdict ────────────────────────────────────────────────────────────
printf "\n"
if [ "$FAILED" -eq 0 ]; then
  printf "%s✓ verify passed%s\n" "$GREEN" "$RESET"
  exit 0
fi
printf "%s✗ verify failed%s\n" "$RED" "$RESET"
exit 1
