import { test, expect } from '@playwright/test';

/**
 * E2Eテスト: トップページ → ログイン画面 の一連フロー検証
 *
 * テスト対象:
 * 1. トップページの表示・主要要素の確認
 * 2. ヘッダー「ログイン / 登録」リンクからログイン画面への遷移
 * 3. 「履歴を保存して始める」ボタンからログイン画面への遷移
 * 4. ログイン画面の各要素の表示確認
 * 5. ログイン画面からゲストモード・利用規約・プライバシーポリシーへの遷移
 */

test.describe('トップページ → ログイン フロー', () => {

  test.describe('トップページの表示確認', () => {

    test('トップページが正常に表示される', async ({ page }) => {
      await page.goto('/');

      // ページタイトルの確認
      await expect(page).toHaveTitle(/シカクノ/);

      // ヘッダーのロゴが表示される
      const logo = page.getByRole('link', { name: 'シカクノ' }).first();
      await expect(logo).toBeVisible();

      // メインヒーローセクションの見出し
      await expect(
        page.getByRole('heading', { level: 1 })
      ).toContainText('データ駆動型');
    });

    test('ヘッダーに「ログイン / 登録」リンクが表示される', async ({ page }) => {
      await page.goto('/');

      const loginLink = page.getByRole('link', { name: 'ログイン / 登録' });
      await expect(loginLink).toBeVisible();
      await expect(loginLink).toHaveAttribute('href', '/api/auth/signin');
    });

    test('CTAボタンが正しく表示される', async ({ page }) => {
      await page.goto('/');

      // 「登録なしで、実力を試す (無料)」ボタン
      const guestCta = page.getByRole('link', { name: /登録なしで/ });
      await expect(guestCta).toBeVisible();
      await expect(guestCta).toHaveAttribute('href', '/dashboard');

      // 「履歴を保存して始める」ボタン
      const loginCta = page.getByRole('link', { name: /履歴を保存して/ });
      await expect(loginCta).toBeVisible();
      await expect(loginCta).toHaveAttribute('href', '/api/auth/signin');
    });

    test('フィーチャーカードが3つ表示される', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('heading', { name: /スキマ時間を得点源に/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: /「苦手」をAIが特定/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: /本番のプレッシャーを攻略/ })).toBeVisible();
    });

    test('フッターが表示される', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText('© 2025-2026 シカクノ')).toBeVisible();
    });
  });

  test.describe('ログイン画面への遷移', () => {

    test('ヘッダーの「ログイン / 登録」リンクからログイン画面へ遷移する', async ({ page }) => {
      await page.goto('/');

      // 「ログイン / 登録」リンクをクリック
      await page.getByRole('link', { name: 'ログイン / 登録' }).click();

      // ログイン画面に遷移したことを確認（/login にリダイレクトされる）
      await expect(page).toHaveURL(/\/login/);

      // ログイン画面の見出しが表示される
      await expect(
        page.getByRole('heading', { name: 'ログイン / 新規登録' })
      ).toBeVisible();
    });

    test('「履歴を保存して始める」ボタンからログイン画面へ遷移する', async ({ page }) => {
      await page.goto('/');

      // 「履歴を保存して始める」リンクをクリック
      await page.getByRole('link', { name: /履歴を保存して/ }).click();

      // ログイン画面に遷移
      await expect(page).toHaveURL(/\/login/);

      // ログイン画面の見出しを確認
      await expect(
        page.getByRole('heading', { name: 'ログイン / 新規登録' })
      ).toBeVisible();
    });
  });

  test.describe('ログイン画面の表示確認', () => {

    test.beforeEach(async ({ page }) => {
      // 各テスト前にログイン画面へ直接アクセス
      await page.goto('/login');
    });

    test('ログイン画面の見出しと説明文が表示される', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: 'ログイン / 新規登録' })
      ).toBeVisible();

      await expect(
        page.getByText('学習履歴を保存して、効率的に学習を進めましょう。')
      ).toBeVisible();
    });

    test('Google ログインボタンが表示される', async ({ page }) => {
      const googleButton = page.getByRole('button', { name: /Google で続ける/ });
      await expect(googleButton).toBeVisible();
      await expect(googleButton).toBeEnabled();
    });

    test('GitHub ログインボタンが表示される', async ({ page }) => {
      const githubButton = page.getByRole('button', { name: /GitHub で続ける/ });
      await expect(githubButton).toBeVisible();
      await expect(githubButton).toBeEnabled();
    });

    test('利用規約とプライバシーポリシーのリンクが表示される', async ({ page }) => {
      const termsLink = page.getByRole('link', { name: '利用規約' });
      await expect(termsLink).toBeVisible();
      await expect(termsLink).toHaveAttribute('href', '/terms');

      const privacyLink = page.getByRole('link', { name: 'プライバシーポリシー' });
      await expect(privacyLink).toBeVisible();
      await expect(privacyLink).toHaveAttribute('href', '/privacy');
    });

    test('「ゲストとして利用する」ボタンが表示される', async ({ page }) => {
      const guestButton = page.getByRole('button', { name: 'ゲストとして利用する' });
      await expect(guestButton).toBeVisible();
      await expect(guestButton).toBeEnabled();
    });

    test('同意テキストが正しく表示される', async ({ page }) => {
      await expect(
        page.getByText(/ログインすることで、.*利用規約.*プライバシーポリシー.*に同意したものとみなします/)
      ).toBeVisible();
    });
  });

  test.describe('ログイン画面からの遷移', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });

    test('「ゲストとして利用する」ボタンクリックで試験ページへ遷移する', async ({ page }) => {
      await page.getByRole('button', { name: 'ゲストとして利用する' }).click();

      // /exam ページへ遷移
      await expect(page).toHaveURL(/\/exam/);
    });

    test('利用規約リンクが新しいタブで開く設定になっている', async ({ page }) => {
      const termsLink = page.getByRole('link', { name: '利用規約' });
      await expect(termsLink).toHaveAttribute('target', '_blank');
      await expect(termsLink).toHaveAttribute('rel', /noopener/);
    });

    test('プライバシーポリシーリンクが新しいタブで開く設定になっている', async ({ page }) => {
      const privacyLink = page.getByRole('link', { name: 'プライバシーポリシー' });
      await expect(privacyLink).toHaveAttribute('target', '_blank');
      await expect(privacyLink).toHaveAttribute('rel', /noopener/);
    });
  });

  test.describe('エンドツーエンド: トップ → ログイン → ゲスト利用 フロー', () => {

    test('トップページからログイン画面を経由してゲスト利用できる', async ({ page }) => {
      // Step 1: トップページにアクセス
      await page.goto('/');
      await expect(page).toHaveTitle(/シカクノ/);

      // Step 2: 「ログイン / 登録」をクリック
      await page.getByRole('link', { name: 'ログイン / 登録' }).click();
      await expect(page).toHaveURL(/\/login/);

      // Step 3: ログイン画面が表示される
      await expect(
        page.getByRole('heading', { name: 'ログイン / 新規登録' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Google で続ける/ })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /GitHub で続ける/ })
      ).toBeVisible();

      // Step 4: ゲストとして利用する
      await page.getByRole('button', { name: 'ゲストとして利用する' }).click();
      await expect(page).toHaveURL(/\/exam/);
    });

    test('トップページの「登録なしで試す」ボタンからダッシュボードへ遷移できる', async ({ page }) => {
      // Step 1: トップページにアクセス
      await page.goto('/');

      // Step 2: 「登録なしで、実力を試す」をクリック
      const guestCta = page.getByRole('link', { name: /登録なしで/ });
      await expect(guestCta).toBeVisible();
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 15000 }),
        guestCta.click(),
      ]);

      // Step 3: ダッシュボードに遷移
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('コンソールエラーの確認', () => {

    test('トップページでJavaScriptエラーが発生しない', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      // ページ読み込み完了を待つ
      await page.waitForLoadState('domcontentloaded');

      expect(errors).toHaveLength(0);
    });

    test('ログイン画面でJavaScriptエラーが発生しない', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      expect(errors).toHaveLength(0);
    });
  });
});
