#!/usr/bin/env bash
# Langfuse と Copilot Chat OTel 環境変数の状態を確認する。
set -euo pipefail

HOSTS=("http://langfuse-web:3000" "http://localhost:3000")
COLLECTOR_HOSTS=("http://otel-collector:4318" "http://localhost:4318")

echo "[verify] Langfuse の起動を確認します（最大約5分）。"
READY=""
for _ in $(seq 1 60); do
  for host in "${HOSTS[@]}"; do
    if curl -fsS "${host}/api/public/health" >/dev/null 2>&1; then
      READY="$host"
      break 2
    fi
  done
  sleep 5
done

if [ -n "$READY" ]; then
  echo "[verify] Langfuse は起動しています: ${READY}"
  echo "[verify] ブラウザ: http://localhost:3000"
else
  echo "[verify] WARNING: Langfuse に到達できません。"
  echo "[verify] ログ確認例: npm run otel:compose -- logs langfuse-web"
fi

COLLECTOR_READY=""
for host in "${COLLECTOR_HOSTS[@]}"; do
  if curl -fsS "${host}" >/dev/null 2>&1 || [ "$?" -eq 22 ]; then
    COLLECTOR_READY="$host"
    break
  fi
done

if [ -n "$COLLECTOR_READY" ]; then
  echo "[verify] OTel Collector は到達可能です: ${COLLECTOR_READY}"
else
  echo "[verify] WARNING: OTel Collector に到達できません。"
fi

echo "[verify] Copilot OTel 関連環境変数:"
if env | grep -E 'OTEL_|COPILOT_OTEL' >/dev/null 2>&1; then
  env | grep -E 'OTEL_|COPILOT_OTEL' | sed -E 's/(HEADER|SECRET|TOKEN|KEY|PASSWORD|AUTHORIZATION)([^=]*)=.*/\1\2=[redacted]/I'
else
  echo "  (未設定。手動起動では .vscode/settings.json と OTEL_EXPORTER_OTLP_HEADERS を確認してください)"
fi

echo "[verify] 次に Copilot Chat Agent mode で会話し、Langfuse の project 'copilot-otel' の Tracing を確認してください。"