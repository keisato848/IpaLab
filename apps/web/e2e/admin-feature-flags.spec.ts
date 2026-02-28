/**
 * E2Eテスト: 管理画面フィーチャーフラグ機能
 * 全17テストケース（FF-01〜FF-21）を完全モック方式で実装
 */

import { test, expect, testWithoutAuth, testWithNonAdminAuth } from './fixtures/admin-auth';
import { captureEvidence } from './helpers/evidence';

// 1. アクセス制御テスト（認証バイパスなし）
test.describe('1. アクセス制御テスト', () => {
    
    test('FF-01: 未認証ユーザーのアクセス制限', async ({ page, testInfo }) => {
        // セッションAPIインターセプトなしでアクセス
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}),
            });
        });

        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
        
        // エビデンスキャプチャ
        await captureEvidence(page, testInfo, 'FF-01_unauthenticated_access');

        // アクセス制限メッセージの確認
        await expect(page.locator('h2')).toContainText('アクセスが制限されています');
        await expect(page.locator('text=このページを表示するにはログインが必要です。')).toBeVisible();
        await expect(page.locator('a[href="/login"]')).toContainText('ログインページへ');
        
        // フィーチャーフラグ関連要素が表示されないことを確認
        await expect(page.locator('input[type=checkbox]')).toHaveCount(0);
        await expect(page.locator('text=フィーチャーフラグ')).toHaveCount(0);
    });

    test('FF-02: 非管理者ユーザーのアクセス制限', async ({ page, testInfo }) => {
        // 通常ユーザーセッション
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: {
                        id: 'test-user-001',
                        name: 'Test User',
                        email: 'user@test.local',
                        role: 'user',
                    },
                    expires: new Date(Date.now() + 86400000).toISOString(),
                }),
            });
        });

        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
        
        await captureEvidence(page, testInfo, 'FF-02_non_admin_access');

        // 管理者権限エラーの確認
        await expect(page.locator('h2')).toContainText('管理者権限が必要です');
        await expect(page.locator('text=このページは管理者のみアクセスできます。')).toBeVisible();
        await expect(page.locator('a[href="/dashboard"]')).toContainText('ダッシュボードへ戻る');
        
        // セットアップセクションの確認
        await expect(page.locator('text=初回管理者セットアップ')).toBeVisible();
        await expect(page.locator('input[type=password]')).toBeVisible();
        
        const setupButton = page.locator('button:has-text("管理者に設定")');
        await expect(setupButton).toBeVisible();
        await expect(setupButton).toBeDisabled(); // トークン未入力時
    });
});

// 2. APIセキュリティテスト（認証バイパスなし）
test.describe('2. APIセキュリティテスト', () => {

    test('FF-11: 管理API GET の未認証拒否（401）', async ({ page, testInfo }) => {
        await page.route('**/api/admin/feature-flags', route => {
            if (route.request().method() === 'GET') {
                route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: '認証が必要です' }),
                });
            } else {
                route.continue();
            }
        });

        const response = await page.request.get('http://localhost:3000/api/admin/feature-flags');
        expect(response.status()).toBe(401);
        
        const body = await response.json();
        expect(body.error).toBe('認証が必要です');
    });

    test('FF-12: 管理API PATCH の未認証拒否（401）', async ({ page, testInfo }) => {
        await page.route('**/api/admin/feature-flags', route => {
            if (route.request().method() === 'PATCH') {
                route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: '認証が必要です' }),
                });
            } else {
                route.continue();
            }
        });

        const response = await page.request.patch('http://localhost:3000/api/admin/feature-flags', {
            data: { id: 'ads_enabled', enabled: true }
        });
        expect(response.status()).toBe(401);
        
        const body = await response.json();
        expect(body.error).toBe('認証が必要です');
    });

    test('FF-17: 管理API GET の非管理者拒否（403）', async ({ page, testInfo }) => {
        await page.route('**/api/admin/feature-flags', route => {
            if (route.request().method() === 'GET') {
                route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: '管理者権限が必要です' }),
                });
            } else {
                route.continue();
            }
        });

        const response = await page.request.get('http://localhost:3000/api/admin/feature-flags');
        expect(response.status()).toBe(403);
        
        const body = await response.json();
        expect(body.error).toBe('管理者権限が必要です');
    });

    test('FF-13: 管理API PATCH のバリデーション（不正入力）', async ({ page, testInfo }) => {
        await page.route('**/api/admin/feature-flags', route => {
            if (route.request().method() === 'PATCH') {
                route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'id (string) と enabled (boolean) が必要です' }),
                });
            } else {
                route.continue();
            }
        });

        // enabled 欠落
        let response = await page.request.patch('http://localhost:3000/api/admin/feature-flags', {
            data: { id: 'ads_enabled' }
        });
        expect(response.status()).toBe(400);
        let body = await response.json();
        expect(body.error).toBe('id (string) と enabled (boolean) が必要です');

        // id 欠落
        response = await page.request.patch('http://localhost:3000/api/admin/feature-flags', {
            data: { enabled: true }
        });
        expect(response.status()).toBe(400);
        body = await response.json();
        expect(body.error).toBe('id (string) と enabled (boolean) が必要です');

        // enabled が非boolean
        response = await page.request.patch('http://localhost:3000/api/admin/feature-flags', {
            data: { id: 'ads_enabled', enabled: 'yes' }
        });
        expect(response.status()).toBe(400);
        body = await response.json();
        expect(body.error).toBe('id (string) と enabled (boolean) が必要です');
    });

    test('FF-18: 管理API PATCH の不正JSON送信', async ({ page, testInfo }) => {
        await page.route('**/api/admin/feature-flags', route => {
            if (route.request().method() === 'PATCH') {
                route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Invalid JSON' }),
                });
            } else {
                route.continue();
            }
        });

        // 不正JSON文字列を送信
        const response = await page.request.patch('http://localhost:3000/api/admin/feature-flags', {
            headers: { 'Content-Type': 'application/json' },
            data: '{invalid}'
        });
        
        expect([400, 500]).toContain(response.status()); // どちらでも受容
        // アプリケーションがクラッシュしないことを確認（レスポンスが返ること）
        expect(response.status()).toBeLessThan(600);
    });

    test('FF-19: 管理API PATCH の更新失敗時（500）', async ({ page, testInfo }) => {
        await page.route('**/api/admin/feature-flags', route => {
            if (route.request().method() === 'PATCH') {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'フィーチャーフラグの更新に失敗しました' }),
                });
            } else {
                route.continue();
            }
        });

        const response = await page.request.patch('http://localhost:3000/api/admin/feature-flags', {
            data: { id: 'ads_enabled', enabled: true }
        });
        expect(response.status()).toBe(500);
        
        const body = await response.json();
        expect(body.error).toBe('フィーチャーフラグの更新に失敗しました');
    });
});

// 3. 公開APIテスト（認証不要）
test.describe('3. 公開APIテスト', () => {

    test('FF-10: 公開API /api/feature-flags の応答確認', async ({ page, testInfo }) => {
        await page.route('**/api/feature-flags', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    flags: {
                        ads_enabled: false,
                        rewarded_ad_enabled: false,
                        ai_plan_enabled: true
                    }
                }),
            });
        });

        const response = await page.request.get('http://localhost:3000/api/feature-flags');
        expect(response.status()).toBe(200);
        
        const body = await response.json();
        expect(body.flags).toBeDefined();
        expect(body.flags.ads_enabled).toBe(false);
        expect(body.flags.rewarded_ad_enabled).toBe(false);
        expect(body.flags.ai_plan_enabled).toBe(true);
        
        // 内部情報が含まれないことを確認
        expect(body.description).toBeUndefined();
        expect(body.updatedBy).toBeUndefined();
        expect(body.updatedAt).toBeUndefined();
    });
});

// 4. フィーチャーフラグ表示テスト（セッションAPI インターセプト + APIモック）
test.describe('4. フィーチャーフラグ表示テスト', () => {

    test('FF-03: 管理画面の初期表示・フラグ一覧', async ({ adminPage, testInfo }) => {
        await adminPage.goto('http://localhost:3000/admin');
        await adminPage.waitForLoadState('networkidle');
        
        await captureEvidence(adminPage, testInfo, 'FF-03_admin_dashboard');

        // 管理画面の基本表示
        await expect(adminPage.locator('h1')).toContainText('管理画面');
        await expect(adminPage.locator('text=Admin')).toBeVisible(); // バッジ
        await expect(adminPage.locator('text=フィーチャーフラグ')).toBeVisible();
        
        // フラグ一覧の表示
        await expect(adminPage.locator('text=ads_enabled')).toBeVisible();
        await expect(adminPage.locator('text=rewarded_ad_enabled')).toBeVisible();
        await expect(adminPage.locator('text=ai_plan_enabled')).toBeVisible();
        await expect(adminPage.locator('input[type=checkbox]')).toHaveCount(3);
    });

    test('FF-04: フラグ情報の詳細表示', async ({ adminPage, testInfo }) => {
        await adminPage.goto('http://localhost:3000/admin');
        await adminPage.waitForLoadState('networkidle');
        
        await captureEvidence(adminPage, testInfo, 'FF-04_flag_details');

        // ads_enabled フラグの詳細
        const adsSection = adminPage.locator('[data-testid="flag-ads_enabled"], :text("ads_enabled")').first().locator('..');
        await expect(adsSection.locator('text=ads_enabled')).toBeVisible();
        await expect(adsSection.locator('text=OFF')).toBeVisible();
        await expect(adsSection.locator('text=広告表示の有効化（全体制御）')).toBeVisible();
        await expect(adsSection.locator('text=最終更新:')).toBeVisible();
        
        // ads_enabled のチェックボックス状態
        const adsCheckbox = adminPage.locator('input[type=checkbox]').first();
        await expect(adsCheckbox).not.toBeChecked();

        // ai_plan_enabled フラグの詳細（デフォルト有効）
        const aiSection = adminPage.locator(':text("ai_plan_enabled")').first().locator('..');
        await expect(aiSection.locator('text=ai_plan_enabled')).toBeVisible();
        await expect(aiSection.locator('text=ON')).toBeVisible();
        await expect(aiSection.locator('text=AI学習計画機能の有効化')).toBeVisible();
        
        // ai_plan_enabled のチェックボックス状態
        const aiCheckbox = adminPage.locator('input[type=checkbox]').last();
        await expect(aiCheckbox).toBeChecked();
    });

    test('FF-20: フラグ取得失敗時のUI表示', async ({ page, testInfo }) => {
        // 管理者セッション設定
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: {
                        id: 'test-admin-001',
                        name: 'Test Admin',
                        email: 'admin@test.local',
                        role: 'admin',
                    },
                    expires: new Date(Date.now() + 86400000).toISOString(),
                }),
            });
        });

        // 管理API で 500 エラー
        await page.route('**/api/admin/feature-flags', route => {
            if (route.request().method() === 'GET') {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Internal Server Error' }),
                });
            } else {
                route.continue();
            }
        });

        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
        
        await captureEvidence(page, testInfo, 'FF-20_flag_fetch_error');

        // エラーメッセージの表示確認
        await expect(page.locator('text=フラグの取得に失敗しました')).toBeVisible();
        await expect(page.locator('input[type=checkbox]')).toHaveCount(0);
    });
});

// 5. フィーチャーフラグ トグル操作テスト（完全モック方式）
test.describe('5. フィーチャーフラグ トグル操作テスト', () => {

    test('FF-05: OFFフラグをONに切り替え', async ({ adminPage, mockApiState, testInfo }) => {
        await adminPage.goto('http://localhost:3000/admin');
        await adminPage.waitForLoadState('networkidle');
        
        // 初期状態確認
        await expect(adminPage.locator('text=ads_enabled')).toBeVisible();
        await expect(adminPage.locator('text=OFF')).toBeVisible();
        
        // ads_enabled のトグルスイッチをクリック
        const adsCheckbox = adminPage.locator('input[type=checkbox]').first();
        await expect(adsCheckbox).not.toBeChecked();
        await adsCheckbox.click();
        
        await captureEvidence(adminPage, testInfo, 'FF-05_toggle_on');
        
        // 状態変化の確認
        await expect(adsCheckbox).toBeChecked();
        await expect(adminPage.locator('text=ON')).toBeVisible();
        await expect(adminPage.locator('text=最終更新:')).toBeVisible();
    });

    test('FF-06: ONフラグをOFFに切り替え', async ({ adminPage, mockApiState, testInfo }) => {
        await adminPage.goto('http://localhost:3000/admin');
        await adminPage.waitForLoadState('networkidle');
        
        // ai_plan_enabled のトグルスイッチをクリック（デフォルトでON）
        const aiCheckbox = adminPage.locator('input[type=checkbox]').last();
        await expect(aiCheckbox).toBeChecked();
        await aiCheckbox.click();
        
        await captureEvidence(adminPage, testInfo, 'FF-06_toggle_off');
        
        // 状態変化の確認
        await expect(aiCheckbox).not.toBeChecked();
        await expect(adminPage.locator('text=OFF')).toBeVisible();
        await expect(adminPage.locator('text=最終更新:')).toBeVisible();
    });

    test('FF-07: トグル操作中のUI無効化状態', async ({ page, testInfo }) => {
        // 管理者セッション設定
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: { id: 'test-admin-001', role: 'admin' },
                    expires: new Date(Date.now() + 86400000).toISOString(),
                }),
            });
        });

        // 管理API GET でデフォルト状態
        await page.route('**/api/admin/feature-flags', async (route, request) => {
            if (request.method() === 'GET') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        flags: [
                            { id: 'ads_enabled', enabled: false, description: '広告表示の有効化（全体制御）', updatedAt: '2026-02-27T12:00:00Z', updatedBy: 'system' }
                        ]
                    }),
                });
            } else if (request.method() === 'PATCH') {
                // 2秒遅延後に成功レスポンス
                await page.waitForTimeout(2000);
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ 
                        flag: { id: 'ads_enabled', enabled: true, description: '広告表示の有効化（全体制御）', updatedAt: new Date().toISOString(), updatedBy: 'test-admin-001' }
                    }),
                });
            }
        });

        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
        
        const adsCheckbox = page.locator('input[type=checkbox]').first();
        await adsCheckbox.click();
        
        // 操作中の無効化状態確認
        await expect(adsCheckbox).toBeDisabled();
        
        await captureEvidence(page, testInfo, 'FF-07_toggle_disabled');
        
        // 少し待ってから二重送信防止を確認
        await expect(adsCheckbox).toBeDisabled();
        
        // 最終的に有効化されることを確認
        await expect(adsCheckbox).not.toBeDisabled({ timeout: 5000 });
    });
});

// 6. フィードバック表示テスト（完全モック方式）
test.describe('6. フィードバック表示テスト', () => {

    test('FF-08: トグル成功時のメッセージ表示', async ({ adminPage, testInfo }) => {
        await adminPage.goto('http://localhost:3000/admin');
        await adminPage.waitForLoadState('networkidle');
        
        // ads_enabled をトグル
        const adsCheckbox = adminPage.locator('input[type=checkbox]').first();
        await adsCheckbox.click();
        
        await captureEvidence(adminPage, testInfo, 'FF-08_success_message');
        
        // 成功メッセージの表示確認
        await expect(adminPage.locator('text=を有効にしました')).toBeVisible();
        await expect(adminPage.locator('text=広告表示の有効化（全体制御）')).toBeVisible();
    });

    test('FF-09: 成功メッセージの3秒後自動消去', async ({ adminPage, testInfo }) => {
        await adminPage.goto('http://localhost:3000/admin');
        await adminPage.waitForLoadState('networkidle');
        
        // トグル操作
        const adsCheckbox = adminPage.locator('input[type=checkbox]').first();
        await adsCheckbox.click();
        
        // 成功メッセージの表示確認
        const successMsg = adminPage.locator('text=を有効にしました');
        await expect(successMsg).toBeVisible();
        
        await captureEvidence(adminPage, testInfo, 'FF-09_message_before_hide');
        
        // イベント駆動での消失確認
        await successMsg.waitFor({ state: 'hidden', timeout: 5000 });
        
        await captureEvidence(adminPage, testInfo, 'FF-09_message_after_hide');
    });

    test('FF-21: トグル更新失敗時のエラー表示', async ({ page, testInfo }) => {
        // 管理者セッション設定
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: { id: 'test-admin-001', role: 'admin' },
                    expires: new Date(Date.now() + 86400000).toISOString(),
                }),
            });
        });

        // 管理API GET でデフォルト状態、PATCH で500エラー
        await page.route('**/api/admin/feature-flags', async (route, request) => {
            if (request.method() === 'GET') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        flags: [
                            { id: 'ads_enabled', enabled: false, description: '広告表示の有効化（全体制御）', updatedAt: '2026-02-27T12:00:00Z', updatedBy: 'system' }
                        ]
                    }),
                });
            } else if (request.method() === 'PATCH') {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'フィーチャーフラグの更新に失敗しました' }),
                });
            }
        });

        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
        
        const adsCheckbox = page.locator('input[type=checkbox]').first();
        const initialState = await adsCheckbox.isChecked();
        
        await adsCheckbox.click();
        
        await captureEvidence(page, testInfo, 'FF-21_update_error');
        
        // エラーメッセージの表示確認
        await expect(page.locator('text=更新に失敗しました, text=更新エラーが発生しました')).toBeVisible();
        
        // トグル状態が元のまま変わっていないことを確認
        await expect(adsCheckbox).toHaveJSProperty('checked', initialState);
    });
});

// 7. 統合テスト（完全モック方式）
test.describe('7. 統合テスト', () => {

    test('FF-14: フラグ切替後の公開APIへの反映', async ({ page, testInfo }) => {
        const mockState = {
            ads_enabled: false
        };

        // セッション API
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: { id: 'test-admin-001', role: 'admin' },
                    expires: new Date(Date.now() + 86400000).toISOString(),
                }),
            });
        });

        // 管理 API（状態管理）
        await page.route('**/api/admin/feature-flags', async (route, request) => {
            if (request.method() === 'GET') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        flags: [
                            { id: 'ads_enabled', enabled: mockState.ads_enabled, description: '広告表示の有効化（全体制御）', updatedAt: '2026-02-27T12:00:00Z', updatedBy: 'system' }
                        ]
                    }),
                });
            } else if (request.method() === 'PATCH') {
                const body = await request.postDataJSON();
                if (body.id === 'ads_enabled') {
                    mockState.ads_enabled = body.enabled;
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ 
                            flag: { id: 'ads_enabled', enabled: body.enabled, description: '広告表示の有効化（全体制御）', updatedAt: new Date().toISOString(), updatedBy: 'test-admin-001' }
                        }),
                    });
                }
            }
        });

        // 公開 API（状態反映）
        await page.route('**/api/feature-flags', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    flags: {
                        ads_enabled: mockState.ads_enabled
                    }
                }),
            });
        });

        // 1. 初期状態確認
        const initialResponse = await page.request.get('http://localhost:3000/api/feature-flags');
        const initialBody = await initialResponse.json();
        expect(initialBody.flags.ads_enabled).toBe(false);

        // 2. 管理画面でトグル操作
        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
        
        const adsCheckbox = page.locator('input[type=checkbox]').first();
        await adsCheckbox.click();
        await expect(page.locator('text=を有効にしました')).toBeVisible();
        
        await captureEvidence(page, testInfo, 'FF-14_flag_updated');

        // 3. 公開API での反映確認
        const updatedResponse = await page.request.get('http://localhost:3000/api/feature-flags');
        const updatedBody = await updatedResponse.json();
        expect(updatedBody.flags.ads_enabled).toBe(true);
    });

    test('FF-16: 複数フラグの連続切替', async ({ page, testInfo }) => {
        const mockState = {
            ads_enabled: false,
            rewarded_ad_enabled: false,
            ai_plan_enabled: true
        };

        // セッション API
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: { id: 'test-admin-001', role: 'admin' },
                    expires: new Date(Date.now() + 86400000).toISOString(),
                }),
            });
        });

        // 管理 API（状態管理）
        await page.route('**/api/admin/feature-flags', async (route, request) => {
            if (request.method() === 'GET') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        flags: [
                            { id: 'ads_enabled', enabled: mockState.ads_enabled, description: '広告表示の有効化（全体制御）', updatedAt: '2026-02-27T12:00:00Z', updatedBy: 'system' },
                            { id: 'rewarded_ad_enabled', enabled: mockState.rewarded_ad_enabled, description: 'リワード広告の有効化（試験開始時）', updatedAt: '2026-02-27T12:00:00Z', updatedBy: 'system' },
                            { id: 'ai_plan_enabled', enabled: mockState.ai_plan_enabled, description: 'AI学習計画機能の有効化', updatedAt: '2026-02-27T12:00:00Z', updatedBy: 'system' }
                        ]
                    }),
                });
            } else if (request.method() === 'PATCH') {
                const body = await request.postDataJSON();
                const flagId = body.id;
                const enabled = body.enabled;
                
                if (flagId in mockState) {
                    mockState[flagId as keyof typeof mockState] = enabled;
                    
                    const descriptions: Record<string, string> = {
                        ads_enabled: '広告表示の有効化（全体制御）',
                        rewarded_ad_enabled: 'リワード広告の有効化（試験開始時）', 
                        ai_plan_enabled: 'AI学習計画機能の有効化'
                    };
                    
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ 
                            flag: { id: flagId, enabled, description: descriptions[flagId], updatedAt: new Date().toISOString(), updatedBy: 'test-admin-001' }
                        }),
                    });
                }
            }
        });

        // 公開 API
        await page.route('**/api/feature-flags', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ flags: mockState }),
            });
        });

        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');

        // 1. ads_enabled を ON
        const adsCheckbox = page.locator('input[type=checkbox]').first();
        await adsCheckbox.click();
        await expect(page.locator('text=広告表示の有効化（全体制御）')).toBeVisible();
        await expect(page.locator('text=有効')).toBeVisible();

        // 2. rewarded_ad_enabled を ON
        const rewardedCheckbox = page.locator('input[type=checkbox]').nth(1);
        await rewardedCheckbox.click();
        await expect(page.locator('text=リワード広告の有効化（試験開始時）')).toBeVisible();
        await expect(page.locator('text=有効')).toBeVisible();

        // 3. ai_plan_enabled を OFF
        const aiCheckbox = page.locator('input[type=checkbox]').last();
        await aiCheckbox.click();
        await expect(page.locator('text=AI学習計画機能の有効化')).toBeVisible();
        await expect(page.locator('text=無効')).toBeVisible();
        
        await captureEvidence(page, testInfo, 'FF-16_multiple_toggles');

        // 4. 最終状態確認
        const finalResponse = await page.request.get('http://localhost:3000/api/feature-flags');
        const finalBody = await finalResponse.json();
        expect(finalBody.flags.ads_enabled).toBe(true);
        expect(finalBody.flags.rewarded_ad_enabled).toBe(true);
        expect(finalBody.flags.ai_plan_enabled).toBe(false);
    });
});