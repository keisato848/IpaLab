#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(root, 'docs/04_reports/otel-sessions');
const envPath = resolve(root, '.env');
const sourceIndex = process.argv.indexOf('--source');
const source = sourceIndex >= 0 ? process.argv[sourceIndex + 1] || 'manual' : 'manual';
const timestamp = new Date();
const timestampText = timestamp.toISOString().replace(/[:.]/g, '-');
const reportPath = resolve(outputDir, `${timestampText}_langfuse-session.md`);
const screenshotName = `${timestampText}_langfuse-dashboard.png`;
const screenshotPath = resolve(outputDir, screenshotName);
const healthHosts = ['http://langfuse-web:3000', 'http://localhost:3000'];

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

async function resolveHealthyHost() {
  for (const host of healthHosts) {
    if (await isHealthy(host)) {
      return host;
    }
  }
  return '';
}

async function captureScreenshot(host, env) {
  try {
    const { chromium } = await import('playwright');
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    const browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(host, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const email = env.LANGFUSE_INIT_USER_EMAIL;
    const password = env.LANGFUSE_INIT_USER_PASSWORD;
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    if (email && password && (await emailInput.count()) > 0 && (await passwordInput.count()) > 0) {
      await emailInput.fill(email);
      await passwordInput.fill(password);
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first();
      if ((await submitButton.count()) > 0) {
        await Promise.allSettled([
          page.waitForLoadState('networkidle', { timeout: 10000 }),
          submitButton.click(),
        ]);
      }
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await browser.close();
    return { ok: true, message: `./${screenshotName}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

mkdirSync(outputDir, { recursive: true });
const env = parseEnvFile(envPath);
const healthyHost = await resolveHealthyHost();
const screenshot = healthyHost ? await captureScreenshot(healthyHost, env) : { ok: false, message: 'Langfuse health check failed' };
const remoteEnabled = Boolean((env.OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT || '').trim());
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_DEVCONTAINER_EXPORTER_OTLP_ENDPOINT || env.OTEL_LOCAL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const report = `# Copilot OTel / Langfuse セッションレポート

## エグゼクティブサマリー

| 項目 | 値 |
|------|------|
| 実行日時 (UTC) | ${timestamp.toISOString()} |
| 実行元 | ${source} |
| Langfuse Health | ${healthyHost ? `OK (${healthyHost})` : 'NG'} |
| Copilot OTLP Endpoint | ${otlpEndpoint} |
| Remote OTLP Push | ${remoteEnabled ? 'Enabled' : 'Disabled'} |

## ダッシュボードエビデンス

${screenshot.ok ? `![Langfuse Dashboard](${screenshot.message})` : `スクリーンショット取得なし: ${screenshot.message}`}

## 確認事項

- Langfuse は devcontainer 起動時に Compose 互換ランタイムで自動起動します。
- Copilot Chat の OTel は OTel Collector に送信され、Collector からローカル Langfuse へ転送されます。
- \`OTEL_REMOTE_EXPORTER_OTLP_ENDPOINT\` を設定した場合、Collector は同じデータをリモート OTLP へも転送します。
`;

writeFileSync(reportPath, report, 'utf8');
console.log(`[otel-report] セッションレポートを生成しました: ${reportPath}`);