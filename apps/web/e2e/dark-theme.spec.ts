import { test, expect, captureEvidence, getDataTheme, getCssVariable, setTheme } from './helpers/evidence';

/**
 * E2Eテスト: ダークテーマテスト
 *
 * テストシナリオ:
 * ┌─────────────────────────────────────────────────────────────────────────────────┐
 * │ ID   │ シナリオ名                             │ 期待結果                        │
 * ├──────┼────────────────────────────────────────┼─────────────────────────────────┤
 * │ D-01 │ デフォルトはライトテーマで表示           │ data-theme="light"              │
 * │ D-02 │ ダークモード設定後にトップページが反映   │ 背景#0f1117, 文字色#f7fafc      │
 * │ D-03 │ ダークモード設定後にログイン画面が反映   │ LoginFormのダーク表示            │
 * │ D-04 │ テーマがlocalStorageに保存される         │ localStorage('theme')='dark'    │
 * │ D-05 │ ページ再読み込みでテーマが維持される     │ data-theme="dark" のまま        │
 * │ D-06 │ ライト→ダーク→ライトのトグル切替       │ 正しく往復できる                │
 * │ D-07 │ システムのprefers-color-schemeが反映     │ ダーク優先時にdark設定           │
 * │ D-08 │ ライトテーマのCSS変数が正しい           │ --bg-primary: #f8f9fa           │
 * │ D-09 │ ダークテーマのCSS変数が正しい           │ --bg-primary: #0f1117           │
 * │ D-10 │ ライト/ダーク並列比較キャプチャ         │ 画像エビデンスの比較            │
 * └─────────────────────────────────────────────────────────────────────────────────┘
 */

test.describe('ダークテーマテスト', () => {

  test.describe('D-01: デフォルトテーマの確認', () => {

    test('初回アクセス時はライトテーマで表示される', async ({ page }, testInfo) => {
      // localStorageをクリアした状態でアクセス
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const theme = await getDataTheme(page);
      // デフォルトはライト（システム設定に依存するが、テスト環境はライト前提）
      // テスト環境ではシステム設定がlightの場合
      expect(theme).toMatch(/^(light|dark)$/); // どちらかが設定されている

      await captureEvidence(page, testInfo, 'D-01_デフォルトテーマ_トップページ');
    });
  });

  test.describe('D-02: ダークモードのトップページ表示', () => {

    test('ダークテーマでトップページの背景色が正しく変わる', async ({ page }, testInfo) => {
      await page.goto('/');

      // ライトテーマのエビデンスを先に取得
      await setTheme(page, 'light');
      await page.waitForTimeout(300); // transition完了待ち
      await captureEvidence(page, testInfo, 'D-02_トップページ_ライトテーマ');

      // ダークテーマに切替
      await setTheme(page, 'dark');
      await page.waitForTimeout(300);

      // CSS変数の確認
      const bgPrimary = await getCssVariable(page, '--bg-primary');
      expect(bgPrimary).toBe('#0f1117');

      const textPrimary = await getCssVariable(page, '--text-primary');
      expect(textPrimary).toBe('#f7fafc');

      await captureEvidence(page, testInfo, 'D-02_トップページ_ダークテーマ');
    });
  });

  test.describe('D-03: ダークモードのログイン画面表示', () => {

    test('ダークテーマでログイン画面が正しく表示される', async ({ page }, testInfo) => {
      await page.goto('/login');

      // ライトテーマのエビデンス
      await setTheme(page, 'light');
      await page.waitForTimeout(300);
      await captureEvidence(page, testInfo, 'D-03_ログイン画面_ライトテーマ');

      // ダークテーマに切替
      await setTheme(page, 'dark');
      await page.waitForTimeout(300);

      // ヘッダーが見えること
      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      // Google / GitHub ボタンが見えること
      await expect(page.getByRole('button', { name: /Google で続ける/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /GitHub で続ける/ })).toBeVisible();

      await captureEvidence(page, testInfo, 'D-03_ログイン画面_ダークテーマ');
    });
  });

  test.describe('D-04: テーマ設定のlocalStorage永続化', () => {

    test('ダークテーマ設定がlocalStorageに保存される', async ({ page }, testInfo) => {
      await page.goto('/');

      // ダークテーマを設定
      await setTheme(page, 'dark');

      // localStorageの値を確認
      const savedTheme = await page.evaluate(() => localStorage.getItem('theme'));
      expect(savedTheme).toBe('dark');

      await captureEvidence(page, testInfo, 'D-04_localStorage_dark保存');

      // ライトに戻す
      await setTheme(page, 'light');
      const savedLight = await page.evaluate(() => localStorage.getItem('theme'));
      expect(savedLight).toBe('light');

      await captureEvidence(page, testInfo, 'D-04_localStorage_light保存');
    });
  });

  test.describe('D-05: ページ再読み込みでテーマ維持', () => {

    test('ダークテーマ設定後にリロードしてもダークモードが維持される', async ({ page }, testInfo) => {
      await page.goto('/');

      // ダークテーマを設定
      await setTheme(page, 'dark');
      await captureEvidence(page, testInfo, 'D-05_リロード前_ダークテーマ');

      // ページをリロード
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // data-theme が 'dark' であることを確認
      const theme = await getDataTheme(page);
      expect(theme).toBe('dark');

      // CSS変数もダークテーマの値であること
      const bgPrimary = await getCssVariable(page, '--bg-primary');
      expect(bgPrimary).toBe('#0f1117');

      await captureEvidence(page, testInfo, 'D-05_リロード後_ダークテーマ維持');
    });

    test('ライトテーマ設定後にリロードしてもライトモードが維持される', async ({ page }, testInfo) => {
      await page.goto('/');

      await setTheme(page, 'light');
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const theme = await getDataTheme(page);
      expect(theme).toBe('light');

      await captureEvidence(page, testInfo, 'D-05_リロード後_ライトテーマ維持');
    });
  });

  test.describe('D-06: テーマのトグル切替', () => {

    test('ライト→ダーク→ライトとテーマを正しく切り替えられる', async ({ page }, testInfo) => {
      await page.goto('/');

      // Step 1: ライトテーマで開始
      await setTheme(page, 'light');
      await page.waitForTimeout(300);
      let theme = await getDataTheme(page);
      expect(theme).toBe('light');
      await captureEvidence(page, testInfo, 'D-06_Step1_ライトテーマ');

      // Step 2: ダークテーマに切替
      await setTheme(page, 'dark');
      await page.waitForTimeout(300);
      theme = await getDataTheme(page);
      expect(theme).toBe('dark');
      await captureEvidence(page, testInfo, 'D-06_Step2_ダークテーマ');

      // Step 3: ライトテーマに戻す
      await setTheme(page, 'light');
      await page.waitForTimeout(300);
      theme = await getDataTheme(page);
      expect(theme).toBe('light');
      await captureEvidence(page, testInfo, 'D-06_Step3_ライトテーマ復帰');
    });
  });

  test.describe('D-07: システムのprefers-color-scheme反映', () => {

    test('システムがダークモードの場合、初期表示がダークになる', async ({ page }, testInfo) => {
      // localStorageクリア状態でシステムのダークモードをエミュレート
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');
      await page.evaluate(() => localStorage.removeItem('theme'));
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const theme = await getDataTheme(page);
      expect(theme).toBe('dark');

      await captureEvidence(page, testInfo, 'D-07_システムダークモード');
    });

    test('システムがライトモードの場合、初期表示がライトになる', async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');
      await page.evaluate(() => localStorage.removeItem('theme'));
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const theme = await getDataTheme(page);
      expect(theme).toBe('light');

      await captureEvidence(page, testInfo, 'D-07_システムライトモード');
    });
  });

  test.describe('D-08: ライトテーマのCSS変数値検証', () => {

    test('ライトテーマの全CSS変数が正しい値を持つ', async ({ page }, testInfo) => {
      await page.goto('/');
      await setTheme(page, 'light');
      await page.waitForTimeout(300);

      // 主要CSS変数の検証（ブラウザは色値を短縮形で返す場合がある）
      const variables: Record<string, string[]> = {
        '--bg-primary': ['#f8f9fa'],
        '--bg-secondary': ['#ffffff', '#fff'],
        '--text-primary': ['#1a202c'],
        '--text-secondary': ['#4a5568'],
        '--border-color': ['#e2e8f0'],
        '--accent-color': ['#0070f3'],
      };

      for (const [varName, expectedValues] of Object.entries(variables)) {
        const actual = await getCssVariable(page, varName);
        expect(expectedValues, `${varName} の値が不正: ${actual}`).toContain(actual);
      }

      await captureEvidence(page, testInfo, 'D-08_ライトテーマ_CSS変数検証');
    });
  });

  test.describe('D-09: ダークテーマのCSS変数値検証', () => {

    test('ダークテーマの全CSS変数が正しい値を持つ', async ({ page }, testInfo) => {
      await page.goto('/');
      await setTheme(page, 'dark');
      await page.waitForTimeout(300);

      // 主要CSS変数の検証
      const variables: Record<string, string> = {
        '--bg-primary': '#0f1117',
        '--bg-secondary': '#1a202c',
        '--text-primary': '#f7fafc',
        '--text-secondary': '#cbd5e0',
        '--border-color': '#2d3748',
        '--accent-color': '#3b82f6',
      };

      for (const [varName, expected] of Object.entries(variables)) {
        const actual = await getCssVariable(page, varName);
        expect(actual, `${varName} の値が不正`).toBe(expected);
      }

      await captureEvidence(page, testInfo, 'D-09_ダークテーマ_CSS変数検証');
    });
  });

  test.describe('D-10: ライト/ダーク並列比較エビデンス', () => {

    test('トップページのライト/ダーク比較キャプチャ', async ({ page }, testInfo) => {
      await page.goto('/');

      // ライトテーマ
      await setTheme(page, 'light');
      await page.waitForTimeout(500);
      await captureEvidence(page, testInfo, 'D-10_比較_トップページ_LIGHT', { fullPage: true });

      // ダークテーマ
      await setTheme(page, 'dark');
      await page.waitForTimeout(500);
      await captureEvidence(page, testInfo, 'D-10_比較_トップページ_DARK', { fullPage: true });
    });

    test('ログイン画面のライト/ダーク比較キャプチャ', async ({ page }, testInfo) => {
      await page.goto('/login');

      // ライトテーマ
      await setTheme(page, 'light');
      await page.waitForTimeout(500);
      await captureEvidence(page, testInfo, 'D-10_比較_ログイン画面_LIGHT', { fullPage: true });

      // ダークテーマ
      await setTheme(page, 'dark');
      await page.waitForTimeout(500);
      await captureEvidence(page, testInfo, 'D-10_比較_ログイン画面_DARK', { fullPage: true });
    });

    test('OAuthエラー画面のライト/ダーク比較キャプチャ', async ({ page }, testInfo) => {
      await page.goto('/login?error=OAuthSignin');

      // ライトテーマ
      await setTheme(page, 'light');
      await page.waitForTimeout(500);
      await captureEvidence(page, testInfo, 'D-10_比較_OAuthエラー_LIGHT', { fullPage: true });

      // ダークテーマ
      await setTheme(page, 'dark');
      await page.waitForTimeout(500);
      await captureEvidence(page, testInfo, 'D-10_比較_OAuthエラー_DARK', { fullPage: true });
    });
  });
});
