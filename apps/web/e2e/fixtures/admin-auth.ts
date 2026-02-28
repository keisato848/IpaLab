/**
 * フィクスチャ: 管理者認証用のテストヘルパー
 * Page.route() によるAPI インターセプトで管理者セッションと管理APIを完全モック制御
 */

import { test as base, Page, TestInfo } from '@playwright/test';
import { captureEvidence } from '../helpers/evidence';

// モックAPIの状態管理
interface MockApiState {
    flags: Array<{
        id: string;
        enabled: boolean;
        description: string;
        updatedAt: string;
        updatedBy: string;
    }>;
}

// デフォルトのモック状態
const getDefaultMockState = (): MockApiState => ({
    flags: [
        {
            id: 'ads_enabled',
            enabled: false,
            description: '広告表示の有効化（全体制御）',
            updatedAt: '2026-02-27T12:00:00Z',
            updatedBy: 'system'
        },
        {
            id: 'rewarded_ad_enabled',
            enabled: false,
            description: 'リワード広告の有効化（試験開始時）',
            updatedAt: '2026-02-27T12:00:00Z',
            updatedBy: 'system'
        },
        {
            id: 'ai_plan_enabled',
            enabled: true,
            description: 'AI学習計画機能の有効化',
            updatedAt: '2026-02-27T12:00:00Z',
            updatedBy: 'system'
        }
    ]
});

// 管理者認証フィクスチャ
export interface AdminFixtures {
    adminPage: Page;
    mockApiState: MockApiState;
    testInfo: TestInfo;
}

export const test = base.extend<AdminFixtures>({
    // モックAPI状態の管理
    mockApiState: async ({}, use) => {
        const mockState = getDefaultMockState();
        await use(mockState);
    },

    // TestInfo の受け渡し用
    testInfo: async ({}, use: (r: TestInfo) => Promise<void>, testInfo: TestInfo) => {
        await use(testInfo);
    },

    // 管理者認証済みページ
    adminPage: async ({ page, mockApiState }, use) => {
        // セッションAPI のインターセプト（管理者セッション返却）
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

        // 管理API GET のインターセプト
        await page.route('**/api/admin/feature-flags', async (route, request) => {
            if (request.method() === 'GET') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ flags: mockApiState.flags }),
                });
            } else if (request.method() === 'PATCH') {
                try {
                    const body = await request.postDataJSON();
                    const { id, enabled } = body;

                    if (!id || typeof enabled !== 'boolean') {
                        route.fulfill({
                            status: 400,
                            contentType: 'application/json',
                            body: JSON.stringify({ error: 'id (string) と enabled (boolean) が必要です' }),
                        });
                        return;
                    }

                    // モック状態を更新
                    const flagIndex = mockApiState.flags.findIndex(f => f.id === id);
                    if (flagIndex !== -1) {
                        mockApiState.flags[flagIndex] = {
                            ...mockApiState.flags[flagIndex],
                            enabled,
                            updatedAt: new Date().toISOString(),
                            updatedBy: 'test-admin-001',
                        };

                        route.fulfill({
                            status: 200,
                            contentType: 'application/json',
                            body: JSON.stringify({ flag: mockApiState.flags[flagIndex] }),
                        });
                    } else {
                        route.fulfill({
                            status: 500,
                            contentType: 'application/json',
                            body: JSON.stringify({ error: 'フィーチャーフラグの更新に失敗しました' }),
                        });
                    }
                } catch (error) {
                    route.fulfill({
                        status: 400,
                        contentType: 'application/json',
                        body: JSON.stringify({ error: 'Invalid JSON' }),
                    });
                }
            } else {
                route.continue();
            }
        });

        // 公開API のインターセプト
        await page.route('**/api/feature-flags', route => {
            const flagMap: Record<string, boolean> = {};
            for (const flag of mockApiState.flags) {
                flagMap[flag.id] = flag.enabled;
            }

            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ flags: flagMap }),
            });
        });

        await use(page);
    },
});

// セキュリティテスト用（認証無効）フィクスチャ
export const testWithoutAuth = base.extend<{ unauthPage: Page }>({
    unauthPage: async ({ page }, use) => {
        // セッションAPI で未認証状態を返す
        await page.route('**/api/auth/session', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}),
            });
        });

        // 管理API で401エラーを返す
        await page.route('**/api/admin/feature-flags', route => {
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: '認証が必要です' }),
            });
        });

        await use(page);
    },
});

// 非管理者テスト用フィクスチャ
export const testWithNonAdminAuth = base.extend<{ nonAdminPage: Page }>({
    nonAdminPage: async ({ page }, use) => {
        // セッションAPI で通常ユーザーセッションを返す
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

        // 管理API で403エラーを返す
        await page.route('**/api/admin/feature-flags', route => {
            route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: JSON.stringify({ error: '管理者権限が必要です' }),
            });
        });

        await use(page);
    },
});

export { expect } from '@playwright/test';