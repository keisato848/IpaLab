# Langfuse ローカル監視

このディレクトリには、`scripts/setup-copilot-otel.sh` が取得する公式 Langfuse `docker-compose.yml` を配置します。

- `docker-compose.yml` は生成物のため git 管理対象外です。
- 実行時の秘密値はリポジトリルートの未追跡 `.env` に生成します。
- 手動起動は `npm run otel:compose` を使い、Docker Desktop、Rancher Desktop、Podman などの Compose 互換 CLI で実行します。
- Copilot Chat の OTel 送信先は devcontainer では `http://otel-collector:4318`、手動起動では `http://localhost:4318` です。
- OTel Collector がローカル Langfuse (`http://langfuse-web:3000/api/public/otel`) と任意のリモート OTLP へ転送します。