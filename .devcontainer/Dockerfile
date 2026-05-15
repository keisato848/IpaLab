# Shikakuno 開発用 devcontainer。
# Node.js 24 系で monorepo を扱い、Langfuse 検証用の軽量 CLI を追加する。
FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl jq ca-certificates chromium \
    && rm -rf /var/lib/apt/lists/*