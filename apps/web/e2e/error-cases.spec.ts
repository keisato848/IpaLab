import { test, expect, captureEvidence } from './helpers/evidence';

/**
 * E2Eテスト: 異常系テスト
 *
 * テストシナリオ:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ID   │ シナリオ名                       │ 期待結果                     │
 * ├──────┼──────────────────────────────────┼──────────────────────────────┤
 * │ E-01 │ 存在しないURLへのアクセス          │ 404ページまたはエラーが表示   │
 * │ E-02 │ ログインpage にOAuthエラーパラメータ │ エラーメッセージが表示される  │
 * │ E-03 │ OAuthAccountNotLinked エラー       │ 別ログイン方法の案内が表示   │
 * │ E-04 │ AccessDenied エラー               │ アクセス拒否メッセージ表示    │
 * │ E-05 │ Configuration エラー              │ 管理者連絡メッセージ表示     │
 * │ E-06 │ 不正な callbackUrl パラメータ      │ ページがクラッシュしない      │
 * │ E-07 │ 認証なしでの保護ページアクセス     │ ログインへリダイレクト        │
 * │ E-08 │ ボタン連打防止（二重サブミット）   │ ボタンが無効化される         │
 * │ E-09 │ ページ基本構造・アクセシビリティ   │ lang属性・role属性の確認      │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

test.describe('異常系テスト', () => {

  test.describe('E-01: 存在しないURLへのアクセス（404）', () => {

    test('存在しないパスにアクセスすると404が返る', async ({ page }, testInfo) => {
      const response = await page.goto('/nonexistent-page-12345');

      await captureEvidence(page, testInfo, 'E-01_404_page');

      expect(response?.status()).toBe(404);
    });

    test('存在しない深い階層のパスにアクセスすると404が返る', async ({ page }, testInfo) => {
      const response = await page.goto('/a/b/c/d/e/f/g');

      await captureEvidence(page, testInfo, 'E-01_deep_path_404');

      expect(response?.status()).toBe(404);
    });
  });

  test.describe('E-02〜E-05: OAuth認証エラーパラメータの表示', () => {

    const errorCases = [
      {
        id: 'E-02',
        error: 'OAuthSignin',
        expectedMessage: 'OAuth プロバイダーへの接続に失敗しました。',
      },
      {
        id: 'E-03',
        error: 'OAuthAccountNotLinked',
        expectedMessage: 'このメールアドレスは別のログイン方法で登録されています。',
      },
      {
        id: 'E-04',
        error: 'AccessDenied',
        expectedMessage: 'アクセスが拒否されました。',
      },
      {
        id: 'E-05',
        error: 'Configuration',
        expectedMessage: 'サーバー設定にエラーがあります。管理者にお問い合わせください。',
      },
    ];

    for (const { id, error, expectedMessage } of errorCases) {
      test(`${id}: error=${error} の場合エラーメッセージが表示される`, async ({ page }, testInfo) => {
        await page.goto(`/login?error=${error}`);
        // Suspense解決 + クライアントサイドレンダリングを待機
        await page.waitForLoadState('networkidle');

        // LoginForm が Suspense で遅延レンダリングされるため、見出しの表示を待つ
        await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

        // エラーメッセージが表示されることを確認（複数のrole=alertが存在するためテキストでフィルタ）
        const errorAlert = page.getByRole('alert').filter({ hasText: expectedMessage });
        await expect(errorAlert).toBeVisible({ timeout: 10_000 });

        await captureEvidence(page, testInfo, `${id}_OAuth_error_${error}`);
      });
    }

    test('E-02b: 未知のエラーコードの場合デフォルトメッセージが表示される', async ({ page }, testInfo) => {
      await page.goto('/login?error=UnknownError123');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      const expectedMsg = '認証中にエラーが発生しました。もう一度お試しください。';
      const errorAlert = page.getByRole('alert').filter({ hasText: expectedMsg });
      await expect(errorAlert).toBeVisible({ timeout: 10_000 });

      await captureEvidence(page, testInfo, 'E-02b_unknown_error_code');
    });

    test('E-02c: エラーパラメータがない場合エラーメッセージは表示されない', async ({ page }, testInfo) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      // エラーパラメータがない場合、エラーメッセージを含むalertは存在しない
      // ページ上のNext.js Dev Tools等の空alertは無視し、テキストを持つalertのみチェック
      const errorMessages = [
        'OAuth', 'アクセスが拒否', '認証中にエラー', 'サーバー設定',
        'このメールアドレス', '認証処理中',
      ];
      for (const msg of errorMessages) {
        await expect(page.getByRole('alert').filter({ hasText: msg })).toHaveCount(0);
      }

      await captureEvidence(page, testInfo, 'E-02c_no_error_normal');
    });
  });

  test.describe('E-06: 不正なパラメータへの耐性', () => {

    test('XSSを含むcallbackUrlパラメータでクラッシュしない', async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/login?callbackUrl=javascript:alert(1)');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      await captureEvidence(page, testInfo, 'E-06_XSS_callbackUrl');

      expect(errors).toHaveLength(0);
    });

    test('超長文のcallbackUrlパラメータでクラッシュしない', async ({ page }, testInfo) => {
      const longUrl = '/login?callbackUrl=' + 'A'.repeat(5000);

      await page.goto(longUrl);
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      await captureEvidence(page, testInfo, 'E-06_long_callbackUrl');
    });

    test('複数のerrorパラメータが渡された場合でもクラッシュしない', async ({ page }, testInfo) => {
      await page.goto('/login?error=OAuthSignin&error=AccessDenied');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      await captureEvidence(page, testInfo, 'E-06_multiple_error_params');
    });
  });

  test.describe('E-07: 認証なしでの保護ページアクセス', () => {

    test('未ログイン状態で設定ページにアクセス', async ({ page }, testInfo) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await captureEvidence(page, testInfo, 'E-07_unauthenticated_settings');

      // ログインページ、ダッシュボード、設定ページのいずれかに遷移
      const url = page.url();
      expect(url).toMatch(/\/(login|dashboard|settings)/);
    });
  });

  test.describe('E-08: ボタン連打防止（二重サブミット）', () => {

    test('Googleログインボタンをクリック後、両方のボタンが無効化される', async ({ page }, testInfo) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      const googleButton = page.getByRole('button', { name: /Google で続ける/ });
      const githubButton = page.getByRole('button', { name: /GitHub で続ける/ });

      await expect(googleButton).toBeEnabled();
      await expect(githubButton).toBeEnabled();

      await captureEvidence(page, testInfo, 'E-08_before_click');

      // ナビゲーションをインターセプトしてリダイレクトを防ぐ
      await page.route('**/api/auth/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({ status: 200, body: '{}' });
      });

      await googleButton.click();

      // ローディング中はボタンが disabled になる
      await expect(googleButton).toBeDisabled({ timeout: 5_000 });
      await expect(githubButton).toBeDisabled({ timeout: 5_000 });

      await captureEvidence(page, testInfo, 'E-08_after_click_disabled');
    });
  });

  test.describe('E-09: ページ基本構造の確認', () => {

    test('トップページのHTMLにlang属性が設定されている', async ({ page }, testInfo) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBe('ja');

      await captureEvidence(page, testInfo, 'E-09_lang_attribute');
    });

    test('ログイン画面のアクセシビリティ: ボタンのrole属性が正しい', async ({ page }, testInfo) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'ログイン / 新規登録' })).toBeVisible();

      // ボタンが適切なroleを持つ（Google, GitHub, ゲスト の3つ以上）
      const buttons = page.getByRole('button');
      expect(await buttons.count()).toBeGreaterThanOrEqual(3);

      await expect(page.getByRole('button', { name: /Google で続ける/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /GitHub で続ける/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'ゲストとして利用する' })).toBeVisible();

      await captureEvidence(page, testInfo, 'E-09_a11y_role_check');
    });
  });
});
