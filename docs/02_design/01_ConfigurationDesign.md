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
- **Lint**: `eslint app components hooks lib --ext .js,.jsx,.ts,.tsx` で `packages/config/eslint-preset` を使用
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
- **Lint**: `packages/config/eslint-server` を extends し、生成物 `dist/` は対象外
- **Dependencies**: `@azure/cosmos`, `@google/generative-ai`, `applicationinsights`
- **主要機能**:
  - Gemini API プロキシ処理
  - AI 利用メトリクス記録
  - フォールバック機能

## 4. 開発環境設定

### 4.1 必要な環境変数

tracked file である `apps/*/local.settings.json` と `.env.template` には、接続文字列や API キーの実値を記載しない。ローカル実行時はユーザー環境の未追跡 `.env.local`、Azure CLI / Key Vault から取得した一時環境変数、またはローカル端末の Secret Store から注入する。

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
- **Husky**:
  - `pre-commit`: 静的ガードを実行し、午後試験データ fallback 防壁と `self-inspect` を確認する
  - `pre-push`: `npm run test:unit` によりユニットテストを実行する

### 4.3 ローカルガードとドキュメント同期

`pre-commit` は軽量な静的チェックに限定し、以下の順序で実行します。

1. `node scripts/guard-exam-data-fallback.mjs`
   - 午後試験データ fallback の本番防壁を検証します。
2. `pwsh .github/hooks/self-inspect.ps1 -Mode end -FailOnFinding`
  - 過去インシデントに基づく再発防止ルール R1〜R12 を検証します。

`self-inspect` の R8 は、`apps/`、`packages/`、`.github/hooks/`、`.github/workflows/`、`.husky/`、主要なルート設定ファイルに実装変更があるにもかかわらず `docs/` 配下の更新がない場合に検出します。検出時はコミットを中止し、該当する設計書・手順書の更新を `document-agent` の担当作業として促します。

`self-inspect` の R12 は、tracked 設定ファイルに Cosmos / Storage 接続文字列の `AccountKey` 実値、Google API キー形式の実値、秘密鍵ヘッダーが混入していないかを値非表示で検出します。

テスト実行は `pre-push` に集約し、コミット時の待ち時間を抑えつつ、push 前にユニットテストを必ず通す構成とします。

### 4.4 GitHub Actions: 日本語フィールド同期

`.github/workflows/sync-project-fields.yml` は、Issue / Pull Request の担当者、ラベル、マイルストーン、リポジトリ、レビュー担当者を GitHub Projects v2 の日本語フィールドへ同期します。

- `PROJECT_PAT` Secret が利用できる場合のみ `actions/github-script` で Projects v2 API を呼び出します。
- Copilot / fork 相当の PR など Secret が提供されない実行コンテキストでは、同期処理をスキップして workflow 自体は成功させます。
- プロジェクト同期は運用補助であり、アプリケーション品質ゲートを不要にブロックしない設計とします。

## 5. Copilot Agent カスタマイズ設定

GitHub Copilot エージェントのカスタマイズ設定は以下のパスに配置する。詳細は [23_CopilotAgentCustomizationDesign.md](23_CopilotAgentCustomizationDesign.md) を参照。

| 種別 | 配置パス | 用途 |
|------|---------|------|
| Custom Agent | `.github/agents/*.agent.md` | エージェント定義（VS Code + GitHub.com cloud） |
| Prompt File | `.github/prompts/*.prompt.md` | 再利用可能プロンプト（VS Code） |
| Agent Skill | `.github/skills/<name>/SKILL.md` | スキルパッケージ（VS Code） |
| Hook 設定 | `.github/hooks/*.json` | セッションフック（SessionStart / Stop 等） |
| MCP（VS Code） | `.vscode/mcp.json` | VS Code ワークスペース MCP サーバー |
| オーケストレーター | `AGENTS.md` | タスク分類・ルーティング定義 |
| E2E レポーター | `apps/web/e2e/reporters/custom-report.ts` | エビデンス報告書自動生成 |

### 5.1 tool aliases 制約

`.agent.md` の `tools` フィールドには **公式 GitHub エイリアスのみ** 記載すること。

```
read / edit / search / execute / agent / web / todo
```

非公式名称（`editFiles`, `runCommands`, `codebase` 等）は動作しないため禁止。

## 変更履歴

- **2026-05-02**: tracked 設定ファイルの secret material 禁止方針を追加
  - `local.settings.json` / `.env.template` は空値またはプレースホルダーのみとし、実値は未追跡環境から注入する方針を明記
  - `self-inspect` R12 による tracked 設定ファイルの secret material 検出を追記
- **2026-04-30**: GitHub Actions の日本語フィールド同期 workflow 設計を追記
  - `PROJECT_PAT` 未提供時は同期をスキップし、PR の品質ゲートをブロックしない方針を明記
- **2026-04-29**: Copilot Agent カスタマイズ設定セクションを追加
  - `.github/agents/`, `.github/hooks/`, `.github/prompts/`, `.github/skills/`, `.vscode/mcp.json` の設計方針を追加
  - 詳細設計は `docs/02_design/23_CopilotAgentCustomizationDesign.md` を参照
- **2026-04-29**: Husky / self-inspect の設計を更新
  - `pre-commit` の静的ガード構成を実態に合わせて更新
  - 実装変更時に `docs/` 更新を要求する R8 と `document-agent` の責務を追記
- **2026-04-07**: リバースエンジニアリングによる大幅更新
  - アプリケーション構成を実装に合わせて更新（apps/api-ai 追加）
  - packages/data の詳細追加
  - packages/ui の現状明記（空フォルダ）
  - Next.js 16.2.1 への対応
  - 環境変数設定の詳細追加
  - テスト環境（Vitest, Playwright）の記載追加
