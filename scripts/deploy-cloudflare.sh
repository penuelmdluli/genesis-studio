#!/usr/bin/env bash
# ============================================
# Genesis Studio — One-Command Cloudflare Deploy
# ============================================
# Usage: bash scripts/deploy-cloudflare.sh
#
# Handles the proxy.ts ↔ middleware.ts swap required by
# Next.js 16 (proxy.ts) vs OpenNext (middleware.ts).

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Genesis Studio Deploy ==="
echo ""

# Step 1: Swap proxy.ts → middleware.ts for OpenNext
echo "[1/4] Preparing middleware..."
if [ -f src/proxy.ts ]; then
  cp src/proxy.ts src/proxy.ts.bak
  rm src/proxy.ts
  echo "  proxy.ts backed up, middleware.ts will be used"
fi

# Step 2: Clean build with webpack (Turbopack chunks break Workers)
echo "[2/4] Building with OpenNext + webpack..."
rm -rf .open-next
npx opennextjs-cloudflare build
echo "  Build complete"

# Step 3: Deploy via OpenNext (handles no-bundle, modules, assets)
echo "[3/4] Deploying to Cloudflare Workers..."
npx opennextjs-cloudflare deploy
echo "  Deploy complete"

# Step 4: Restore proxy.ts
echo "[4/4] Restoring proxy.ts..."
if [ -f src/proxy.ts.bak ]; then
  mv src/proxy.ts.bak src/proxy.ts
  echo "  proxy.ts restored"
fi

echo ""
echo "=== Deploy finished ==="
echo "  Site: https://ivideostudio.ai"
echo "  Health: https://ivideostudio.ai/api/health"
