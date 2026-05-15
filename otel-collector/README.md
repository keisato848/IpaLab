# OTel Collector ローカル設定

このディレクトリは Copilot Chat OTel をローカル Langfuse と任意のリモート OTLP へ転送する Collector 設定を扱います。

- `generated/config.yml` は `scripts/setup-copilot-otel.mjs` が生成します。
- `generated/config.yml` は `.env` の `OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT` を見て、リモート転送の有無を切り替えます。
- 認証値は `.env` から Collector に注入し、生成設定ファイルには秘密値を直接書きません。

リモートにも転送する場合は、未追跡 `.env` に以下を設定してから Dev Container を再ビルドしてください。

```env
OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT=https://otel.example.com/v1/traces
OTEL_REMOTE_AUTH_HEADER=Bearer xxxxx
```

手動でスタックを起動する場合は `npm run otel:compose` を使用します。このラッパーは `docker compose`、`docker-compose`、`nerdctl compose`、`podman compose` を検出するため、Rancher Desktop などの Compose 互換ランタイムでも同じ手順を使えます。