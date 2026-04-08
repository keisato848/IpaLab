# 詳細設計書: プロジェクト構成・設定 (Configuration Design)

本ドキュメントは、Monorepo全体の構成、共通ツール、各パッケージの設定詳細を定義します。

## 1. Monorepo 構成 (Turborepo)

### 1.1 ルート `package.json`
- **Workspaces**:
  - `apps/*`: アプリケーション (web, api, api-ai)
  - `packages/*`: 共通ライブラリ
- **PackageManager**: `npm@10.9.2`
- **Node.js バージョン**: `20` (LTS)
- **Scripts**:
  - `dev`: `turbo run dev`
  - `build`: `turbo run build`
  - `build:standalone`: `turbo run build --filter=web`
  - `lint`: `turbo run lint`
  - `test`: `turbo run test`
  - `test:unit`: `turbo run test:run --filter=web`
  - `test:e2e`: `cd apps/web && npx playwright test`
  - `format`: `prettier --write "**/*.{ts,tsx,md}"`
  - `prepare`: `husky`

### 1.2 `turbo.json` パイプライン
- **build**:
  - DependsOn: `^build`
  - Outputs: `.next/**`, `dist/**`, `build/**`
- **dev**:
  - Cache: `false`
  - Persistent: `true`
- **lint**:
  - Outputs: []

## 2. 共通パッケージ (`packages/`)

### 2.1 `packages/config`
設定ファイルを一元管理し、各アプリから `extends` して利用します。

- **`tsconfig.base.json`**:
  - `target`: `es2022`
  - `module`: `esnext`
  - `moduleResolution`: `bundler`
  - `strict`: `true`
  - `skipLibCheck`: `true`
  - `isolatedModules`: `true`

- **`eslint-preset.js`**:
  - `extends`: `["next/core-web-vitals", "prettier"]` (Web用)
  - ルール: `console.log` 警告, `unused-vars` エラー等。

### 2.2 `packages/shared`
型定義と純粋関数ロジック。UIには依存しない。
- **Entry**: `src/index.ts`
- **Build**: TypeScript コンパイルで `dist/` に出力
- **Dependencies**: `zod` (型安全性), `date-fns` (日付操作)

### 2.3 `packages/data`
データスクレイピング、CosmosDB 同期、問題データ管理。
- **Entry**: `src/index.ts`
- **メインスクリプト**:
  - `scrape`: IPA サイトからのデータ収集
  - `sync-db`: CosmosDB へのデータ同期
  - `extract`: Gemini を使用した問題データ抽出
  - `test-gemini`: AI モデルテスト
- **Dependencies**: `@azure/cosmos`, `@google/genai`, `axios`, `dotenv`

### 2.4 `packages/ui`
将来の共有UIコンポーネント用。
- **現状**: 空フォルダ（未実装）
- **将来構想**: React コンポーネントライブラリとしての活用を検討

## 3. アプリケーション設定

### 3.1 Web (`apps/web`)
- **Framework**: Next.js 16.2.1 (App Router)
- **Node.js**: v20 (LTS)
- **Build**: Standalone モード無効（Azure SWA 最適化）
- **Styling**: CSS Modules (`*.module.css`)
- **Testing**: 
  - Unit: Vitest + @testing-library/react
  - E2E: Playwright
- **Lint**: `packages/config/eslint-preset` を使用
- **TSConfig**: `packages/config/tsconfig.base.json` を extends
- **内部パッケージ依存**: `@ipa-lab/config`, `@ipa-lab/data`, `@ipa-lab/shared`

### 3.2 API (`apps/api`)
- **Runtime**: Node.js v20
- **Structure**: Azure Functions Node.js Model v4
- **Port**: 7074（ローカル開発時）
- **Build**: tsup による TypeScript コンパイル
- **TSConfig**: `packages/config/tsconfig.base.json` を extends
- **Dependencies**: `@azure/cosmos`, `@azure/functions`, `front-matter`

### 3.3 AI API (`apps/api-ai`)
- **Runtime**: Node.js v20
- **Structure**: Azure Functions Node.js Model v4
- **Port**: 7075（ローカル開発時）
- **Region**: US East 2（Gemini API 地域制限対応）
- **Build**: tsup による TypeScript コンパイル
- **Dependencies**: `@azure/cosmos`, `@google/generative-ai`, `applicationinsights`
- **主要機能**:
  - Gemini API プロキシ処理
  - AI 利用メトリクス記録
  - フォールバック機能

## 4. 開発環境設定

### 4.1 必要な環境変数
#### Web アプリケーション
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<secret>
GOOGLE_ID=<oauth_client_id>
GOOGLE_SECRET=<oauth_client_secret>
AZURE_COSMOS_CONNECTION_STRING=<cosmos_connection>
```

#### API Functions
```env
AzureWebJobsStorage=UseDevelopmentStorage=true
FUNCTIONS_WORKER_RUNTIME=node
COSMOS_DB_CONNECTION=<cosmos_connection>
```

#### AI Functions
```env
AzureWebJobsStorage=UseDevelopmentStorage=true
FUNCTIONS_WORKER_RUNTIME=node
GEMINI_API_KEY=<google_ai_api_key>
COSMOS_DB_CONNECTION=<cosmos_connection>
```

### 4.2 ビルド設定
- **Turborepo**: パラレルビルド、キャッシュ最適化
- **TypeScript**: Strict モード有効
- **ESLint**: Next.js ルール + Prettier 統合
- **Husky**: pre-commit フック（lint + test 自動実行）

## 変更履歴

- **2026-04-07**: リバースエンジニアリングによる大幅更新
  - アプリケーション構成を実装に合わせて更新（apps/api-ai 追加）
  - packages/data の詳細追加
  - packages/ui の現状明記（空フォルダ）
  - Next.js 16.2.1 への対応
  - 環境変数設定の詳細追加
  - テスト環境（Vitest, Playwright）の記載追加
