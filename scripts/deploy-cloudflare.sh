#!/usr/bin/env bash
# ============================================
# Genesis Studio — Cloudflare Deploy Script
# ============================================
# Builds with OpenNext, fixes Windows path issues, and deploys.
# Usage: bash scripts/deploy-cloudflare.sh

set -euo pipefail

echo "=== Step 1: Prepare middleware ==="
cp src/proxy.ts src/proxy.ts.bak
cp src/proxy.ts src/middleware.ts
sed -i 's/export const proxy = handler;/export const middleware = handler;/' src/middleware.ts
rm src/proxy.ts
echo "✓ proxy.ts → middleware.ts"

echo ""
echo "=== Step 2: Build with OpenNext ==="
npx opennextjs-cloudflare build
echo "✓ OpenNext build complete"

echo ""
echo "=== Step 3: Restore proxy.ts ==="
mv src/proxy.ts.bak src/proxy.ts
rm -f src/middleware.ts
echo "✓ proxy.ts restored"

echo ""
echo "=== Step 4: Fix Windows path issues ==="
node -e "
const fs = require('fs');

// Fix WASM imports in handler.mjs (Windows absolute paths → relative)
const handlerPath = '.open-next/server-functions/default/handler.mjs';
let handler = fs.readFileSync(handlerPath, 'utf8');
const wasmBefore = (handler.match(/import\(['\"]C:/g) || []).length;
handler = handler.replace(/import\(['\"]C:[^'\"]*?resvg\.wasm['\"]\)/g,
  'import(\"./node_modules/next/dist/compiled/@vercel/og/resvg.wasm\")');
handler = handler.replace(/import\(['\"]C:[^'\"]*?yoga\.wasm['\"]\)/g,
  'import(\"./node_modules/next/dist/compiled/@vercel/og/yoga.wasm\")');
fs.writeFileSync(handlerPath, handler);
console.log('Fixed', wasmBefore, 'WASM imports in handler.mjs');

// Inline cloudflare submodules into worker.js (wrangler --no-bundle can't resolve them)
const path = require('path');
const base = '.open-next';
const nextEnv = fs.readFileSync(path.join(base, 'cloudflare/next-env.mjs'), 'utf8');
const initJs = fs.readFileSync(path.join(base, 'cloudflare/init.js'), 'utf8');
const imagesJs = fs.readFileSync(path.join(base, 'cloudflare/images.js'), 'utf8');
const skewJs = fs.readFileSync(path.join(base, 'cloudflare/skew-protection.js'), 'utf8');

let worker = fs.readFileSync(path.join(base, 'worker.js'), 'utf8');

// Remove cloudflare/ imports
worker = worker.replace(/\/\/@ts-expect-error:.*\nimport\s*\{[^}]*\}\s*from\s*\"\.\/cloudflare\/images\.js\";\n/g, '');
worker = worker.replace(/\/\/@ts-expect-error:.*\nimport\s*\{[^}]*\}\s*from\s*\"\.\/cloudflare\/init\.js\";\n/g, '');
worker = worker.replace(/\/\/@ts-expect-error:.*\nimport\s*\{[^}]*\}\s*from\s*\"\.\/cloudflare\/skew-protection\.js\";\n/g, '');

// Process init.js — replace next-env.mjs import with inlined content
let processedInit = initJs.replace(
  /import\s*\*\s*as\s*nextEnvVars\s*from\s*\"\.\/next-env\.mjs\";\n?/,
  nextEnv.replace(/^export\s+const\s+/gm, 'const __nev_') +
  '\nconst nextEnvVars = { production: typeof __nev_production !== \"undefined\" ? __nev_production : {}, development: typeof __nev_development !== \"undefined\" ? __nev_development : {}, test: typeof __nev_test !== \"undefined\" ? __nev_test : {} };\n'
);

function stripExportBlock(code) { return code.replace(/\nexport\s*\{[^}]*\};\s*$/m, ''); }

const inlined = [
  '// ===== INLINED CLOUDFLARE MODULES =====',
  nextEnv.replace(/^export /gm, ''),
  stripExportBlock(processedInit).replace(/^export /gm, ''),
  stripExportBlock(imagesJs).replace(/^export /gm, ''),
  stripExportBlock(skewJs).replace(/^export /gm, ''),
  '// ===== END INLINED =====',
].join('\n');

worker = inlined + '\n' + worker;

// Deduplicate imports
const seenImports = new Set();
const lines = worker.split('\n');
const deduped = lines.filter(line => {
  const m = line.match(/^import\s+.*from\s+['\"]([^'\"]+)['\"];?\s*$/);
  if (m) { const k = line.trim(); if (seenImports.has(k)) return false; seenImports.add(k); }
  return true;
});
worker = deduped.join('\n');

fs.writeFileSync(path.join(base, 'worker.js'), worker);
console.log('Inlined cloudflare modules, worker size:', (Buffer.byteLength(worker)/1024).toFixed(1), 'KB');
"
echo "✓ Post-build fixes applied"

echo ""
echo "=== Step 5: Deploy ==="
npx wrangler deploy .open-next/worker.js
echo ""
echo "✓ Deployment complete!"
