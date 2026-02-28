# 管理画面フィーチャーフラグ機能 E2Eテスト計画 v3

## Application Overview

## 目的

管理画面（`/admin`）のフィーチャーフラグ管理機能の E2E 検証。対象フラグは `ads_enabled`・`rewarded_ad_enabled`・`ai_plan_enabled` の3つ。

## 対象フラグ定義

| フラグID | 説明 | デフォルト値 |
|----------|------|-------------|
| `ads_enabled` | 広告表示の有効化（全体制御） | `false` |
| `rewarded_ad_enabled` | リワード広告の有効化（試験開始時） | `false` |
| `ai_plan_enabled` | AI学習計画機能の有効化 | `true` |

---

## 実行環境要件

| 項目 | 要件 |
|------|------|
| 開発サーバー | `http://localhost:3000` で起動済み（Playwright config の `webServer` で自動起動可） |
| CosmosDB | **不要** — 全テストが API モック方式で動作する |
| 外部認証 | **不要** — セッション API + 管理 API を Playwright `page.route()` でインターセプト |

> **注記**: 実 DB 反映の検証（フラグ更新が CosmosDB に永続化されるか等）は本 E2E テストのスコープ外とし、`feature-flags.ts` の関数を対象とするユニット/統合テスト（Vitest）で検証すること。

---

## 認証方式: 全面APIモック方式

### 方針

サーバーサイドの `requireAdmin()` は `getServerSession(authOptions)` を使用しており、Playwright の `page.route()` によるセッション API インターセプトではサーバー上のセッション検証を突破できない。そのため、**管理 API (`/api/admin/feature-flags`) のレスポンスも `page.route()` で fulfill する方式に統一**する。

### フィクスチャ構成

```
e2e/
├── fixtures/
│   └── admin-auth.ts      # 管理者フィクスチャ（セッションAPI + 管理APIモック）
├── helpers/
│   └── evidence.ts         # 既存エビデンスヘルパー
└── admin-feature-flags.spec.ts  # テスト実装
```

### フィクスチャ実装

```typescript
// e2e/fixtures/admin-auth.ts
import { test as base, Page } from '../helpers/evidence';

/** モック用フラグデータ（デフォルト値） */
export const DEFAULT_MOCK_FLAGS = [
  { id: 'ads_enabled', enabled: false, description: '広告表示の有効化（全体制御）', updatedAt: '2026-02-27T12:20:00Z', updatedBy: 'system' },
  { id: 'rewarded_ad_enabled', enabled: false, description: 'リワード広告の有効化（試験開始時）', updatedAt: '2026-02-27T12:20:00Z', updatedBy: 'system' },
  { id: 'ai_plan_enabled', enabled: true, description: 'AI学習計画機能の有効化', updatedAt: '2026-02-27T12:20:00Z', updatedBy: 'system' },
];

/** 管理者セッション API をインターセプトする */
export async function mockAdminSession(page: Page) {
  await page.route('**/api/auth/session', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'test-admin-001', name: 'Test Admin', email: 'admin@test.local', role: 'admin' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
  });
}

/** 通常ユーザーセッション API をインターセプトする */
export async function mockUserSession(page: Page) {
  await page.route('**/api/auth/session', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'test-user-001', name: 'Test User', email: 'user@test.local', role: 'user' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
  });
}

/**
 * 管理 API (GET/PATCH) をモックする
 * - GET: flags 配列を返す
 * - PATCH: flagsState を更新して成功レスポンスを返す
 */
export async function mockAdminFeatureFlagsAPI(page: Page, flagsState: typeof DEFAULT_MOCK_FLAGS) {
  await page.route('**/api/admin/feature-flags', (route, request) => {
    if (request.method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ flags: flagsState }) });
    } else if (request.method() === 'PATCH') {
      const body = request.postDataJSON();
      const target = flagsState.find(f => f.id === body.id);
      if (target) {
        target.enabled = body.enabled;
        target.updatedAt = new Date().toISOString();
        target.updatedBy = 'test-admin-001';
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ flag: target }) });
      } else {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '更新失敗' }) });
      }
    } else {
      route.continue();
    }
  });
}
```

### テスト分類別の構成

| 分類 | セッション API | 管理 API (GET) | 管理 API (PATCH) | DB |
|------|----------------|----------------|-------------------|-----|
| アクセス制御 (FF-01, FF-02) | なし / user 返却 | `continue()` | — | 不要 |
| API セキュリティ (FF-11〜FF-13, FF-17〜FF-19) | なし | `continue()` | `continue()` | 不要 |
| 表示テスト (FF-03, FF-04, FF-20) | admin 返却 | `fulfill()` モック | — | 不要 |
| トグル操作 (FF-05〜FF-09, FF-21) | admin 返却 | `fulfill()` モック | `fulfill()` モック | 不要 |
| 統合フロー (FF-14, FF-16) | admin 返却 | `fulfill()` モック | `fulfill()` モック(状態更新) | 不要 |
| 公開 API (FF-10) | なし | — | — | 不要 |

---

## 初期状態リセット手順

各テストは独立して実行可能とする。モック方式のため DB リセットは不要。

```typescript
test.beforeEach(async ({ page }) => {
  // localStorage クリア
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
```

各テスト内でモック用フラグ配列を `structuredClone(DEFAULT_MOCK_FLAGS)` でコピーして使用し、テスト間のデータ干渉を防ぐ。

---

## 現行仕様メモ

> 以下は仕様固定のアサーション対象ではなく、現時点の実装動作の記録。将来変更される可能性がある。

- `AdProvider` は環境変数 `NEXT_PUBLIC_ADS_ENABLED` を直接参照しており、管理画面でのフラグ切替は `AdProvider` の表示動作に直接影響しない
- 公開 API `/api/feature-flags` は 30 秒キャッシュ (`s-maxage=30`) を設定しているため、フラグ切替直後のクライアント取得では旧値が返る可能性がある
- 実 DB 操作の検証は Vitest ユニットテスト（`__tests__/lib/feature-flags.test.ts`）で行うことを推奨

## Test Scenarios

### 1. アクセス制御テスト

**Seed:** ``

#### 1.1. FF-01: 未認証ユーザーのアクセス制限

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. インターセプトなしで http://localhost:3000/admin にアクセスし、ページ読み込み完了を待つ
    - expect: heading[level=2] に「アクセスが制限されています」が表示される
    - expect: 「このページを表示するにはログインが必要です。」のテキストが表示される
    - expect: 「ログインページへ」リンクが存在し href が /login である
    - expect: input[type=checkbox] が DOM 上に存在しない
    - expect: 「フィーチャーフラグ」のテキストが DOM 上に存在しない

#### 1.2. FF-02: 非管理者ユーザーのアクセス制限

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. mockUserSession() で role:'user' のセッションを返す状態で http://localhost:3000/admin にアクセスする
    - expect: heading[level=2] に「管理者権限が必要です」が表示される
    - expect: 「このページは管理者のみアクセスできます。」のテキストが表示される
    - expect: 「ダッシュボードへ戻る」リンクが存在し href が /dashboard である
  2. 「初回管理者セットアップ」セクションの表示を確認する
    - expect: 「初回管理者セットアップ」のテキストが表示される
    - expect: input[type=password] が存在する
    - expect: 「管理者に設定」ボタンが存在する
    - expect: トークン未入力時は「管理者に設定」ボタンが disabled である

### 2. API セキュリティテスト

**Seed:** ``

#### 2.1. FF-11: 管理 API GET の未認証拒否（401）

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. page.request.get() で /api/admin/feature-flags にリクエスト（Cookie なし）
    - expect: HTTP ステータス: 401
    - expect: レスポンス JSON の error が「認証が必要です」

#### 2.2. FF-12: 管理 API PATCH の未認証拒否（401）

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. page.request.patch() で /api/admin/feature-flags に { id: 'ads_enabled', enabled: true } を送信（Cookie なし）
    - expect: HTTP ステータス: 401
    - expect: レスポンス JSON の error が「認証が必要です」

#### 2.3. FF-17: 管理 API GET の非管理者拒否（403）

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. 通常ユーザーのセッション Cookie で GET /api/admin/feature-flags を送信。E2E での再現が困難な場合は requireAdmin() の分岐を Vitest ユニットテストで検証する（代替可）
    - expect: HTTP ステータス: 403
    - expect: レスポンス JSON の error が「管理者権限が必要です」

#### 2.4. FF-13: 管理 API PATCH のバリデーション（不正入力）

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. PATCH /api/admin/feature-flags に { id: 'ads_enabled' } を送信（enabled 欠落）。認証突破が必要なため、E2E では Vitest ユニットテストでの検証を推奨。または管理 API をモックして UI 側のエラーハンドリングを検証する
    - expect: HTTP ステータス: 400
    - expect: error: 「id (string) と enabled (boolean) が必要です」
  2. PATCH /api/admin/feature-flags に { enabled: true } を送信（id 欠落）
    - expect: HTTP ステータス: 400
    - expect: error: 「id (string) と enabled (boolean) が必要です」
  3. PATCH /api/admin/feature-flags に { id: 'ads_enabled', enabled: 'yes' } を送信（非 boolean）
    - expect: HTTP ステータス: 400
    - expect: error: 「id (string) と enabled (boolean) が必要です」

#### 2.5. FF-18: 管理 API PATCH の不正 JSON 送信

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. PATCH /api/admin/feature-flags に Content-Type: application/json で不正 JSON 文字列 '{invalid}' を送信。認証突破が必要なため Vitest での検証を推奨
    - expect: HTTP ステータス: 400 または 500
    - expect: レスポンスが返ること（アプリクラッシュなし）

#### 2.6. FF-19: 管理 API PATCH の更新失敗時（500）

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. page.route() で PATCH /api/admin/feature-flags のレスポンスを 500 に差し替えて検証する
    - expect: HTTP ステータス: 500
    - expect: error: 「フィーチャーフラグの更新に失敗しました」

### 3. 公開 API テスト（認証不要）

**Seed:** ``

#### 3.1. FF-10: 公開 API /api/feature-flags の応答確認

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. page.request.get() で /api/feature-flags にリクエストを送信
    - expect: HTTP ステータス: 200
    - expect: flags オブジェクトが存在する
    - expect: flags に ads_enabled, rewarded_ad_enabled, ai_plan_enabled のキーが存在する
    - expect: 各フラグの値が boolean 型である
    - expect: description, updatedBy, updatedAt 等の内部情報が含まれない

### 4. フィーチャーフラグ表示テスト（セッション + 管理 API モック）

**Seed:** ``

#### 4.1. FF-03: 管理画面の初期表示・フラグ一覧

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. mockAdminSession() + mockAdminFeatureFlagsAPI() でデフォルトフラグをモックし、http://localhost:3000/admin にアクセスする
    - expect: heading[level=1] に「管理画面」が表示される
    - expect: 「Admin」テキストを含むバッジが表示される
    - expect: 「フィーチャーフラグ」テキストが表示される
    - expect: テキスト「ads_enabled」「rewarded_ad_enabled」「ai_plan_enabled」がそれぞれ表示される
    - expect: input[type=checkbox] が 3 つ存在する

#### 4.2. FF-04: フラグ情報の詳細表示

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. モックデータで管理画面にアクセスし、ads_enabled フラグの表示を確認
    - expect: テキスト「ads_enabled」と「OFF」が表示される
    - expect: テキスト「広告表示の有効化（全体制御）」が表示される
    - expect: 「最終更新:」を含むテキストが表示される
    - expect: ads_enabled の checkbox が unchecked である
  2. ai_plan_enabled フラグの表示を確認
    - expect: テキスト「ai_plan_enabled」と「ON」が表示される
    - expect: テキスト「AI学習計画機能の有効化」が表示される
    - expect: ai_plan_enabled の checkbox が checked である

#### 4.3. FF-20: フラグ取得失敗時の UI 表示

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. mockAdminSession() でセッションをモック、GET /api/admin/feature-flags を status:500 で fulfill。http://localhost:3000/admin にアクセス
    - expect: テキスト「フラグの取得に失敗しました」が表示される
    - expect: input[type=checkbox] が DOM 上に存在しない

### 5. フィーチャーフラグ トグル操作テスト（全 API モック）

**Seed:** ``

#### 5.1. FF-05: OFF フラグを ON に切り替え

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. mockAdminSession() + mockAdminFeatureFlagsAPI() でデフォルトフラグをモックし、http://localhost:3000/admin にアクセスし、フラグ一覧の読み込み完了を待つ
    - expect: テキスト「ads_enabled」と「OFF」が表示される
    - expect: ads_enabled の checkbox が unchecked である
  2. ads_enabled のトグルスイッチ（checkbox）をクリックする
    - expect: ads_enabled の checkbox が checked に変わる
    - expect: テキスト「ON」が ads_enabled の行に表示される
    - expect: 「最終更新:」の日時が更新される

#### 5.2. FF-06: ON フラグを OFF に切り替え

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. モックデータで管理画面にアクセスし、ai_plan_enabled のトグルスイッチをクリックする
    - expect: ai_plan_enabled の checkbox が unchecked に変わる
    - expect: テキスト「OFF」が ai_plan_enabled の行に表示される
    - expect: 「最終更新:」の日時が更新される

#### 5.3. FF-07: トグル操作中の UI 無効化状態

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. PATCH レスポンスを page.route() で 2 秒遅延して fulfill するインターセプトを設定。ads_enabled のトグルをクリック
    - expect: クリック直後、ads_enabled の checkbox が disabled 属性を持つ
    - expect: disabled 中に再度クリックしても状態が変わらない
    - expect: API レスポンス到着後、checkbox の disabled が解除される

### 6. フィードバック表示テスト（全 API モック）

**Seed:** ``

#### 6.1. FF-08: トグル成功時のメッセージ表示

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. モックデータで管理画面にアクセスし、ads_enabled のトグルをクリックする
    - expect: 「を有効にしました」または「を無効にしました」を含むテキストが表示される
    - expect: メッセージにフラグの説明文が含まれる（例: 「広告表示の有効化（全体制御）」）

#### 6.2. FF-09: 成功メッセージの 3 秒後自動消去

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. モックデータで管理画面にアクセスし、ads_enabled のトグルをクリックする
    - expect: 「を有効にしました」を含むテキストが表示される
  2. page.getByText('を有効にしました').waitFor({ state: 'hidden', timeout: 5000 }) でイベント駆動の消失を待機する（固定 sleep ではなく期待駆動）
    - expect: 成功メッセージのテキストが非表示になる（toBeHidden または not.toBeVisible）

#### 6.3. FF-21: トグル更新失敗時のエラー表示

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. PATCH レスポンスを page.route() で status:500, body:{ error:'フィーチャーフラグの更新に失敗しました' } に差し替え、ads_enabled のトグルをクリック
    - expect: 「更新に失敗しました」または「更新エラーが発生しました」のテキストが表示される
    - expect: checkbox の checked 状態が操作前と同じままである

### 7. 統合フローテスト（全 API モック・状態更新）

**Seed:** ``

#### 7.1. FF-14: フラグ切替後の状態反映確認

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. mockAdminSession() + mockAdminFeatureFlagsAPI() でモックし、管理画面にアクセス
    - expect: ads_enabled の checkbox が unchecked である（初期状態）
  2. ads_enabled のトグルを ON に切り替える
    - expect: 成功メッセージが表示される
    - expect: ads_enabled の checkbox が checked に変わる
  3. ページをリロードし、モック API が更新後の状態を返すことを確認
    - expect: ページリロード後に ads_enabled が checked のままである（モック状態が更新されているため）
    - expect: rewarded_ad_enabled と ai_plan_enabled の checked 状態は変化していない

#### 7.2. FF-16: 複数フラグの連続切替

**File:** `apps/web/e2e/admin-feature-flags.spec.ts`

**Steps:**
  1. モックデータで管理画面にアクセスし、ads_enabled のトグルを ON に切り替える
    - expect: 成功メッセージに「広告表示の有効化（全体制御）」と「有効」が含まれる
  2. rewarded_ad_enabled のトグルを ON に切り替える
    - expect: 成功メッセージに「リワード広告の有効化（試験開始時）」と「有効」が含まれる
  3. ai_plan_enabled のトグルを OFF に切り替える
    - expect: 成功メッセージに「AI学習計画機能の有効化」と「無効」が含まれる
  4. 全フラグの最終状態を確認する
    - expect: ads_enabled の checkbox が checked である
    - expect: rewarded_ad_enabled の checkbox が checked である
    - expect: ai_plan_enabled の checkbox が unchecked である
