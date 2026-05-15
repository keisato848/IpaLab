#!/usr/bin/env bash
# Node.js 版セットアップの互換ラッパー。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "[setup] node が必要です。" >&2
  exit 1
fi

node scripts/setup-copilot-otel.mjs