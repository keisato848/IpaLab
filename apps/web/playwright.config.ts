import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2Eテスト設定
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* テストの最大タイムアウト（90秒：pre-pushフック時の並列実行・devserver初回コンパイル対応） */
  timeout: 90_000,
  /* expect() のタイムアウト */
  expect: {
    timeout: 10_000,
    /* ビジュアル比較の閾値 */
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
  },
  /* CI環境ではリトライを2回、ローカルでは0回 */
  retries: process.env.CI ? 2 : 0,
  /* テストレポーター: HTML + エビデンス用カスタム出力 */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  /* テスト結果・エビデンスの出力先 */
  outputDir: path.join(__dirname, 'e2e', 'test-results'),
  /* 共通設定 */
  use: {
    /* ベースURL（開発サーバー） */
    baseURL: 'http://localhost:3000',
    /* 全テストでスクリーンショットを取得（エビデンス用） */
    screenshot: 'on',
    /* トレースを失敗時のみ取得（Windows EBUSYエラー回避） */
    trace: 'retain-on-failure',
    /* ビデオは失敗時のみ記録（Windows EBUSYエラー回避） */
    video: 'retain-on-failure',
  },
  /* テスト対象ブラウザ */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* 開発サーバーの自動起動（既に起動済みの場合はスキップ） */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
