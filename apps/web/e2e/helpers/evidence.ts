import { test as base, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * エビデンス出力ヘルパー
 *
 * テスト実行時にスクリーンショット画像を所定のフォルダに保存し、
 * テストアタッチメントとしても追加することで、HTMLレポートから閲覧可能にする。
 */

// エビデンス格納ディレクトリ（apps/web/e2e/evidence に保存）
const EVIDENCE_DIR = path.resolve(process.cwd(), 'e2e', 'evidence');

// テスト開始前にエビデンスディレクトリを作成
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

/**
 * スクリーンショットをエビデンスとして保存する関数
 * 環境変数 SKIP_EVIDENCE=1 を設定するとファイル保存をスキップする。
 * @param page Playwright Page
 * @param testInfo テスト情報
 * @param name スクリーンショットの名前（ファイル名に使用）
 * @param options スクリーンショットオプション（fullPage等）
 */
export async function captureEvidence(
  page: Page,
  testInfo: { attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void> },
  name: string,
  options: { fullPage?: boolean } = {}
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // Windows互換: ファイル名はASCII安全な文字のみ使用
  const sanitizedName = name
    .replace(/[^\w\-]/g, '_')     // 英数字・アンダースコア・ハイフン以外を_に変換
    .replace(/_+/g, '_')          // 連続アンダースコアを1つにまとめる
    .replace(/^_|_$/g, '');       // 先頭・末尾のアンダースコアを除去
  const fileName = `${timestamp}_${sanitizedName || 'screenshot'}.png`;
  const filePath = path.join(EVIDENCE_DIR, fileName);

  const screenshot = await page.screenshot({
    fullPage: options.fullPage ?? true,
    path: filePath,
  });

  // HTMLレポートへのアタッチメント
  await testInfo.attach(name, {
    body: screenshot,
    contentType: 'image/png',
  });

  return screenshot;
}

/**
 * ページのCSS変数値を取得するヘルパー
 */
export async function getCssVariable(page: Page, variableName: string): Promise<string> {
  return page.evaluate((varName) => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }, variableName);
}

/**
 * data-theme 属性値を取得するヘルパー
 */
export async function getDataTheme(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
}

/**
 * テーマを設定するヘルパー（localStorageとdata-theme属性の両方）
 */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
}

// エクスポート
export { base as test, expect };
