#!/usr/bin/env node
const hosts = ['http://langfuse-web:3000', 'http://localhost:3000'];
const collectorHosts = ['http://otel-collector:4318', 'http://localhost:4318'];
const maxAttempts = 60;
const intervalMs = 5000;

async function isHealthy(host) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${host}/api/public/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function isReachable(host) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(host, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function redactValue(key, value) {
  if (/HEADER|SECRET|TOKEN|KEY|PASSWORD|AUTHORIZATION/i.test(key)) {
    return value ? '[redacted]' : '';
  }
  return value;
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

console.log('[verify] Langfuse の起動を確認します（最大約5分）。');

let readyHost = '';
for (let attempt = 0; attempt < maxAttempts && !readyHost; attempt += 1) {
  for (const host of hosts) {
    if (await isHealthy(host)) {
      readyHost = host;
      break;
    }
  }

  if (!readyHost) {
    await sleep(intervalMs);
  }
}

if (readyHost) {
  console.log(`[verify] Langfuse は起動しています: ${readyHost}`);
  console.log('[verify] ブラウザ: http://localhost:3000');
} else {
  console.warn('[verify] WARNING: Langfuse に到達できません。');
  console.warn('[verify] ログ確認例: npm run otel:compose -- logs langfuse-web');
}

let readyCollector = '';
for (const host of collectorHosts) {
  if (await isReachable(host)) {
    readyCollector = host;
    break;
  }
}

if (readyCollector) {
  console.log(`[verify] OTel Collector は到達可能です: ${readyCollector}`);
} else {
  console.warn('[verify] WARNING: OTel Collector に到達できません。');
}

console.log('[verify] Copilot OTel 関連環境変数:');
const entries = Object.entries(process.env).filter(([key]) => key.startsWith('OTEL_') || key.startsWith('COPILOT_OTEL'));
if (entries.length === 0) {
  console.log('  (未設定。手動起動では .vscode/settings.json と OTEL_EXPORTER_OTLP_HEADERS を確認してください)');
} else {
  for (const [key, value] of entries) {
    console.log(`${key}=${redactValue(key, value)}`);
  }
}

console.log("[verify] 次に Copilot Chat Agent mode で会話し、Langfuse の project 'copilot-otel' の Tracing を確認してください。");