#!/usr/bin/env bash
set -euo pipefail

standalone_dir="apps/web/.next/standalone"

if [[ ! -d "$standalone_dir" ]]; then
  echo "ERROR: $standalone_dir not found. Run npm run build:standalone first." >&2
  exit 1
fi

cd "$standalone_dir"

echo "=== Original standalone structure ==="
ls -la

if [[ -d "apps/web" ]]; then
  ls -la apps/web/
  cp -r apps/web/* .

  mkdir -p .next
  cp -r apps/web/.next/* .next/ 2>/dev/null || true
else
  echo "apps/web directory not found; assuming deployment package is already flattened"
fi

mkdir -p .next

echo "=== Copying .next/static from parent ==="
if [[ -d "../static" ]]; then
  cp -r ../static .next/
  echo "Copied .next/static successfully"
  ls -la .next/static/ | head -20
else
  echo "WARNING: ../static not found!"
  echo "Checking parent structure:"
  ls -la ../
fi

echo "=== Copying public directory ==="
if [[ -d "../../public" ]]; then
  cp -r ../../public .
  echo "Copied public directory"
else
  echo "No public directory found"
fi

rm -rf apps 2>/dev/null || true

echo "=== Final deployment structure ==="
ls -la
echo "=== node_modules check (must contain 'next') ==="
ls node_modules/next/package.json && echo "OK: next module found" || echo "ERROR: next module missing!"
echo "=== .next directory ==="
ls -la .next/
echo "=== .next/static check ==="
ls -la .next/static/ 2>/dev/null || echo ".next/static not found!"