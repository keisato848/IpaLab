# ソースコード変更点

## 1. 概要

Azure Static Web Apps から Azure App Service への移行に伴い、以下のソースコード変更が必要。

## 2. 変更ファイル一覧

| ファイル | 変更内容 | 優先度 |
|---------|---------|--------|
| `apps/web/next.config.js` | `output: 'standalone'` を有効化 | 必須 |
| `apps/web/package.json` | ビルドスクリプト修正 | 必須 |
| `apps/web/instrumentation.ts` | 簡素化（コードレス監視前提） | 必須 |
| `apps/web/lib/appinsights.ts` | 維持（カスタムログ用） | 任意 |
| `apps/web/load-appinsights.js` | **削除** | 必須 |
| `staticwebapp.config.json` | **削除または無効化** | 必須 |

## 3. 詳細な変更内容

### 3.1 `next.config.js` の変更

**変更前（SWA 用）:**
```javascript
const nextConfig = {
    // Note: standalone mode removed - using Azure SWA native Next.js support instead
    // output: 'standalone',
    ...
}
```

**変更後（App Service 用）:**
```javascript
const nextConfig = {
    // App Service では standalone モードが必須
    output: 'standalone',
    transpilePackages: ["@ipa-lab/shared"],
    reactStrictMode: true,
    experimental: {
        instrumentationHook: true,
        serverComponentsExternalPackages: [
            'applicationinsights',
            '@azure/cosmos',
        ],
    },
    ...
}
```

**理由:**
- App Service は `node server.js` でアプリを起動
- standalone 出力により、`node_modules` なしで実行可能
- `.next/standalone/server.js` が生成される

### 3.2 `package.json` の変更

**変更前:**
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

**変更後:**
```json
{
  "scripts": {
    "build": "next build",
    "build:standalone": "next build && node scripts/copy-standalone-assets.js",
    "start": "next start",
    "start:standalone": "node .next/standalone/server.js"
  }
}
```

**追加スクリプト: `scripts/copy-standalone-assets.js`**
```javascript
// Next.js standalone モードでは static と public フォルダを手動コピーする必要がある
const fs = require('fs');
const path = require('path');

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
const publicSrc = path.join(__dirname, '..', 'public');
const staticSrc = path.join(__dirname, '..', '.next', 'static');
const publicDest = path.join(standaloneDir, 'public');
const staticDest = path.join(standaloneDir, '.next', 'static');

// public フォルダをコピー
if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
    console.log('Copied public folder to standalone');
}

// static フォルダをコピー
if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true });
    console.log('Copied static folder to standalone');
}
```

### 3.3 `instrumentation.ts` の簡素化

**変更後:**
```typescript
export async function register() {
    const isServer = typeof window === 'undefined';
    const isEdge = process.env.NEXT_RUNTIME === 'edge';
    
    if (isServer && !isEdge) {
        // App Service のコードレス監視が自動で Application Insights を初期化
        // カスタムログが必要な場合のみ SDK を初期化
        const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
        
        if (connectionString) {
            try {
                const { initAppInsights } = await import('./lib/appinsights');
                initAppInsights();
                console.log('[System] Application Insights SDK initialized');
            } catch (error) {
                console.error('[System] Failed to initialize Application Insights SDK:', error);
            }
        }
    }
}
```

**変更点:**
- `START_APP_INSIGHTS` フラグを削除（コードレス監視前提）
- preload 関連のロジックを削除
- シンプルな初期化に変更

### 3.4 `lib/appinsights.ts` の変更

**維持（変更なし）**

カスタムログ出力用に SDK は残しておく。コードレス監視で基本的なテレメトリは自動収集されるが、`trackEvent`、`trackMetric` などのカスタムログには SDK が必要。

### 3.5 削除ファイル

#### `apps/web/load-appinsights.js` - **削除**

```bash
rm apps/web/load-appinsights.js
```

**理由:** App Service のコードレス監視により preload script が不要になる。

#### `apps/web/staticwebapp.config.json` - **削除または無効化**

SWA 固有の設定ファイル。App Service では不要。

```bash
rm apps/web/staticwebapp.config.json
```

または、ルートの `staticwebapp.config.json` も確認。

## 4. 環境変数の変更

### 4.1 削除する環境変数

| 変数名 | 理由 |
|--------|------|
| `NODE_OPTIONS` | preload script 不要 |
| `START_APP_INSIGHTS` | コードレス監視で自動 |

### 4.2 維持する環境変数

| 変数名 | 用途 |
|--------|------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights 接続（コードレス監視が使用） |
| `COSMOS_DB_CONNECTION` | Cosmos DB 接続 |
| `AUTH_SECRET` | NextAuth セッション暗号化 |
| `AUTH_TRUST_HOST` | NextAuth ホスト信頼 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |

## 5. ディレクトリ構造の変更

### 5.1 ビルド出力（standalone モード）

```
apps/web/.next/
├── standalone/
│   ├── server.js          # エントリーポイント
│   ├── package.json
│   ├── node_modules/      # 必要最小限の依存関係
│   ├── public/            # コピーが必要
│   └── .next/
│       └── static/        # コピーが必要
├── static/                # ビルド時に生成
└── server/                # サーバーコンポーネント
```

### 5.2 デプロイ対象

App Service にデプロイするのは `.next/standalone` フォルダ内のすべてのファイル。

## 6. monorepo 対応

### 6.1 standalone 出力の課題

monorepo 構成では、standalone 出力が以下のパスに生成される：

```
.next/standalone/
├── apps/
│   └── web/
│       └── server.js      # ← 実際のエントリーポイント
├── packages/
│   └── shared/
└── node_modules/
```

**対策:** `next.config.js` に `outputFileTracingRoot` を設定：

```javascript
const path = require('path');

const nextConfig = {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../../'),  // monorepo ルート
    ...
}
```

### 6.2 スタートアップコマンド

App Service のスタートアップコマンド：

```bash
node apps/web/server.js
```

または、`package.json` にスクリプトを追加：

```json
{
  "scripts": {
    "start:prod": "node apps/web/server.js"
  }
}
```

## 7. テストコードへの影響

### 7.1 影響なし

- Vitest 単体テスト: 変更なし
- React Testing Library: 変更なし

### 7.2 追加すべきテスト

| テスト種別 | 内容 |
|-----------|------|
| ビルドテスト | standalone 出力の検証 |
| 起動テスト | `node server.js` での起動確認 |
| Application Insights テスト | ログ出力の E2E テスト |

## 8. 変更作業チェックリスト

### Phase 1: コード変更
- [ ] `next.config.js` に `output: 'standalone'` を追加
- [ ] `next.config.js` に `outputFileTracingRoot` を追加
- [ ] `scripts/copy-standalone-assets.js` を作成
- [ ] `package.json` にビルドスクリプトを追加
- [ ] `instrumentation.ts` を簡素化
- [ ] `load-appinsights.js` を削除
- [ ] `staticwebapp.config.json` を削除

### Phase 2: ローカル検証
- [ ] `npm run build:standalone` が成功
- [ ] `npm run start:standalone` でアプリが起動
- [ ] Application Insights SDK が初期化される

### Phase 3: 環境変数
- [ ] Azure Portal で `NODE_OPTIONS` を削除
- [ ] Azure Portal で `START_APP_INSIGHTS` を削除

---

**作成日**: 2026-02-04
**更新日**: 2026-02-04
**ステータス**: 設計完了
