#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { get } from 'node:https';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composePath = resolve(root, 'langfuse/docker-compose.yml');
const collectorConfigPath = resolve(root, 'otel-collector/generated/config.yml');
const envPath = resolve(root, '.env');
const langfuseComposeRef = 'v3.99.0';
const composeUrl = `https://raw.githubusercontent.com/langfuse/langfuse/${langfuseComposeRef}/docker-compose.yml`;

function randomBase64() {
  return randomBytes(32).toString('base64');
}

function randomHex() {
  return randomBytes(32).toString('hex');
}

function basicAuthHeader(publicKey, secretKey) {
  return `Authorization=Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;
}

function authHeaderValue(header) {
  const match = header.match(/^Authorization=(.+)$/i);
  return match ? match[1] : header;
}

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      }),
  );
}

function appendMissingEnv(path, entries) {
  const current = parseEnvFile(path);
  const missingLines = Object.entries(entries)
    .filter(([key]) => !(key in current))
    .map(([key, value]) => `${key}=${value}`);

  if (missingLines.length === 0) {
    return;
  }

  const currentText = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const separator = currentText.endsWith('\n') || currentText.length === 0 ? '' : '\n';
  writeFileSync(path, `${currentText}${separator}\n# ===== OTLP Collector / Remote Export =====\n${missingLines.join('\n')}\n`, 'utf8');
  console.log(`[setup] .env に不足していた OTLP Collector 設定を ${missingLines.length} 件追加しました。`);
}

function renderCollectorConfig(env) {
  const remoteEndpoint = (env.OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT || '').trim();
  const remoteExporter = remoteEndpoint
    ? `
  otlphttp/remote:
    endpoint: ${remoteEndpoint}
    headers:
      Authorization: "\${env:OTEL_REMOTE_AUTH_HEADER}"
`
    : '';
  const exporters = remoteEndpoint ? '[otlphttp/langfuse, otlphttp/remote]' : '[otlphttp/langfuse]';

  return `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch: {}

exporters:
  otlphttp/langfuse:
    endpoint: http://langfuse-web:3000/api/public/otel
    headers:
      Authorization: "\${env:OTEL_LANGFUSE_AUTH_HEADER}"
${remoteExporter}
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: ${exporters}
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: ${exporters}
`;
}

async function downloadFile(url, outputPath) {
  await new Promise((resolveDownload, rejectDownload) => {
    const request = get(url, response => {
      if (response.statusCode !== 200) {
        rejectDownload(new Error(`HTTP ${response.statusCode} while downloading ${url}`));
        response.resume();
        return;
      }

      const output = createWriteStream(outputPath);
      response.pipe(output);
      output.on('finish', () => {
        output.close(resolveDownload);
      });
      output.on('error', rejectDownload);
    });

    request.on('error', rejectDownload);
  });
}

mkdirSync(dirname(composePath), { recursive: true });
mkdirSync(dirname(collectorConfigPath), { recursive: true });

if (!existsSync(composePath) || statSync(composePath).size === 0) {
  console.log(`[setup] 公式 Langfuse docker-compose.yml (${langfuseComposeRef}) を取得します。`);
  await downloadFile(composeUrl, composePath);
} else {
  console.log('[setup] langfuse/docker-compose.yml は既に存在するため取得を省略します。');
}

if (!existsSync(envPath)) {
  console.log('[setup] ローカル監視用 .env を生成します。');
  const publicKey = 'pk-lf-local';
  const secretKey = 'sk-lf-local';
  const header = basicAuthHeader(publicKey, secretKey);
  const envText = `# ===== Langfuse コアシークレット（ローカル開発専用・コミット禁止） =====
NEXTAUTH_SECRET=${randomBase64()}
SALT=${randomBase64()}
ENCRYPTION_KEY=${randomHex()}
NEXTAUTH_URL=http://localhost:3000

# ===== Langfuse 初回自動作成: 組織 / プロジェクト / API キー / ユーザー =====
LANGFUSE_INIT_ORG_ID=local-org
LANGFUSE_INIT_ORG_NAME=LocalOrg
LANGFUSE_INIT_PROJECT_ID=copilot-otel
LANGFUSE_INIT_PROJECT_NAME=copilot-otel
LANGFUSE_INIT_PROJECT_PUBLIC_KEY=${publicKey}
LANGFUSE_INIT_PROJECT_SECRET_KEY=${secretKey}
LANGFUSE_INIT_USER_EMAIL=dev@example.com
LANGFUSE_INIT_USER_NAME=Dev
LANGFUSE_INIT_USER_PASSWORD=changeme123

# ===== Copilot Chat が使用する OTLP 認証ヘッダー =====
# Basic base64("<public_key>:<secret_key>")
OTEL_EXPORTER_OTLP_HEADERS=${header}
OTEL_LANGFUSE_AUTH_HEADER=${authHeaderValue(header)}

# ===== OTLP Collector / Remote Export =====
OTEL_LOCAL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_DEVCONTAINER_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT=
OTEL_REMOTE_AUTH_HEADER=
`;
  writeFileSync(envPath, envText, 'utf8');
  console.log('[setup] .env を生成しました。');
} else {
  console.log('[setup] .env は既に存在するため変更しません。');
}

const env = parseEnvFile(envPath);
const langfuseHeader = env.OTEL_LANGFUSE_AUTH_HEADER || authHeaderValue(env.OTEL_EXPORTER_OTLP_HEADERS || basicAuthHeader('pk-lf-local', 'sk-lf-local'));
appendMissingEnv(envPath, {
  OTEL_LANGFUSE_AUTH_HEADER: langfuseHeader,
  OTEL_LOCAL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
  OTEL_DEVCONTAINER_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318',
  OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT: '',
  OTEL_REMOTE_AUTH_HEADER: '',
});

const refreshedEnv = parseEnvFile(envPath);
writeFileSync(collectorConfigPath, renderCollectorConfig(refreshedEnv), 'utf8');
console.log('[setup] OTel Collector 設定を生成しました。');

console.log('[setup] 完了しました。');