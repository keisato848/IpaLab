# デプロイメント設計書

## 1. 概要

本ドキュメントは、IpaLab アプリケーションの Azure App Service へのデプロイメント設計を記載する。

> **移行メモ**: 2026年1月に Azure Static Web Apps (SWA) から Azure App Service (Linux B1) へ移行済み。
> 移行理由: Application Insights の SWA + Next.js Hybrid 環境での出力問題を解決するため。
> 詳細: `docs/03_migration/01_SWA_to_AppService_Migration_Plan.md` を参照。

## 2. 技術スタック

| コンポーネント | 技術 | 詳細 |
|---------------|------|------|
| フレームワーク | Next.js | 15.x (App Router) |
| Node.js | LTS | 20 |
| パッケージ管理 | npm workspaces + Turborepo | npm@10.9.2 |
| フロントエンドホスティング | Azure App Service | B1 Linux (East Asia) |
| AIバックエンド | Azure Functions | Node.js v4 (US East 2) |
| データベース | CosmosDB Serverless | East Asia |
| ランタイムモード | Next.js standalone | `output: 'standalone'` |

## 3. アーキテクチャ構成

### 3.1 環境一覧

| 環境 | App Service 名 | URL | デプロイ契機 | CosmosDB |
|------|---------------|-----|------------|----------|
| **本番 (prod)** | `app-pm-exam-dx-prod` | https://shikaku-no.com | `main` ブランチへの push | `pm-exam-dx-db` (Serverless) |
| **検証 (staging)** | `app-pm-exam-dx-staging` | `https://app-pm-exam-dx-staging.azurewebsites.net` | PR オープン・更新時 | `pm-exam-dx-staging-db` (Serverless) |

両環境とも同一 App Service Plan (`asp-pm-exam-dx-prod`, B1 Linux) に同居。

### 3.2 アーキテクチャ図

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Repository                                    │
│                          Monorepo (Turborepo)                                    │
│  apps/web (Next.js)  |  apps/api-ai (Az Func)  |  packages/ (shared/data/ui)    │
└──────────────────────────────────────────────────────────────────────────────────┘
         │ PR push                                  │ main push
         ▼ azure-app-service.yml                   ▼ azure-app-service.yml
┌─────────────────────┐                 ┌──────────────────────────────────────────┐
│  Staging App Service│                 │         Azure East Asia Region            │
│  app-pm-exam-dx-    │                 │  ┌────────────────────────────────────┐  │
│     staging         │                 │  │   App Service (B1 Linux)           │  │
│  ─────────────────  │                 │  │   app-pm-exam-dx-prod              │  │
│  Node.js standalone │                 │  │   shikaku-no.com                   │  │
│  node server.js     │                 │  │   Node.js standalone               │  │
│                     │                 │  │   node server.js                   │  │
│  CosmosDB: staging  │                 │  └────────────────────────────────────┘  │
└─────────────────────┘                 │  ┌────────────────────────────────────┐  │
         │                              │  │   CosmosDB Serverless              │  │
         │ PR に Staging URL をコメント   │  │   pm-exam-dx-db                    │  │
         ▼                              │  └────────────────────────────────────┘  │
   開発者が動作確認                       └──────────────────────────────────────────┘
                                                           │
                                        ┌──────────────────┴───────────────────────┐
                                        │         Azure US East 2 Region            │
                                        │  Azure Functions (func-pm-exam-dx-ai-us)  │
                                        │  ← Gemini API (地域制限: US のみ)         │
                                        └──────────────────────────────────────────┘
```

### 3.3 CI/CD フロー

```
PR 作成・更新
  → test ジョブ (Vitest)
  → build ジョブ (standalone)
  → deploy-staging ジョブ → Staging App Service
  → PR に「✅ Staging デプロイ完了」コメント投稿
  → 開発者が Staging URL で動作確認
  → レビュー・承認 → main へマージ

main マージ
  → test ジョブ
  → build ジョブ
  → deploy ジョブ → 本番 App Service (shikaku-no.com)
```

## 4. ワークフロー設定

### 4.1 ワークフローファイル

GitHub Actions ワークフロー: `.github/workflows/azure-app-service.yml`

| ジョブ | トリガー | 内容 |
|--------|---------|------|
| `test` | push / PR / 手動 | Vitest ユニットテスト実行 |
| `build` | push / PR / 手動 | Next.js standalone ビルド + Artifact作成 |
| `deploy` | `main` push / 手動のみ | **本番**へデプロイ |
| `deploy-staging` | PR のみ | **Staging**へデプロイ + PR にURLをコメント |

Artifact の取得は `actions/download-artifact@v6` を使用する。`gh run download` は checkout していない deploy ジョブで `fatal: not a git repository` となるため使用しない。

### 4.2 必要な GitHub Secrets

| Secret名 | 説明 | 対象 |
|---------|------|------|
| `AZURE_CREDENTIALS` | Service Principal JSON | 本番・Staging共通 |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights接続文字列 | 本番・Staging共通 |
| `AUTH_GITHUB_ID` | GitHub OAuth クライアントID | 本番・Staging共通 |
| `AUTH_GITHUB_SECRET` | GitHub OAuth シークレット | 本番・Staging共通 |
| `AUTH_GOOGLE_ID` | Google OAuth クライアントID | 本番・Staging共通 |
| `AUTH_GOOGLE_SECRET` | Google OAuth シークレット | 本番・Staging共通 |
| `AZURE_STAGING_WEBAPP_NAME` | `app-pm-exam-dx-staging` | **Staging専用** |
| `COSMOS_DB_CONNECTION_STAGING` | Staging CosmosDB接続文字列 | **Staging専用** |
| `NEXTAUTH_SECRET_STAGING` | Staging用 NextAuth シークレット | **Staging専用** |

### 4.3 デプロイパッケージ構造

`npm run build:standalone` により Next.js standalone ビルドを実行し、以下の構造を App Service ルートに配置する。

```
standalone/          ← App Service デプロイルート
├── server.js        ← エントリーポイント（起動コマンド: node server.js）
├── node_modules/    ← 本番に必要な最小モジュール
├── .next/
│   ├── static/      ← CSS/JS（standalone外からコピー）
│   └── server/      ← SSR用バンドル
└── public/          ← 公開静的ファイル
```

### 4.4 App Service 起動コマンド

```bash
node server.js
```

各デプロイジョブは `az webapp config set --startup-file "node server.js"` で起動コマンドを明示的に設定する。Oryx のデフォルト検出に依存しない。

## 5. 環境変数設定

### 5.1 設定方法

App Service の環境変数は **GitHub Actions ワークフロー内で `az webapp config appsettings set` コマンドにより設定**する。Azure Portal 直接設定は次のデプロイで上書きされる可能性があるため非推奨。

### 5.2 本番環境 (app-pm-exam-dx-prod) の必要な環境変数

| 変数名 | 用途 | 設定方法 |
|--------|------|---------|
| `WEBSITE_RUN_FROM_PACKAGE` | `1` (Oryx バイパス) | CI/CD |
| `WEBSITES_PORT` | `8080` (Next.js リスニングポート) | CI/CD |
| `COSMOS_DB_CONNECTION` | CosmosDB 接続文字列 | App Service 設定（ポータル）|
| `AUTH_SECRET` | NextAuth JWT 暗号化キー | App Service 設定（ポータル）|
| `AUTH_TRUST_HOST` | `true` (ホスト自動検出) | App Service 設定（ポータル）|
| `AUTH_GITHUB_ID` | GitHub OAuth | App Service 設定（ポータル）|
| `AUTH_GITHUB_SECRET` | GitHub OAuth | App Service 設定（ポータル）|
| `AUTH_GOOGLE_ID` | Google OAuth | App Service 設定（ポータル）|
| `AUTH_GOOGLE_SECRET` | Google OAuth | App Service 設定（ポータル）|
| `TELEMETRY_CONNECTION_STRING` | App Insights（IPAコードレス回避用名）| CI/CD |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 | App Service 設定（ポータル）|

> **IPA コードレスエージェント無効化**: Linux App Service の IPA は `APPLICATIONINSIGHTS_*` / `APPINSIGHTS_*` プレフィックスや `*_EXTENSION_VERSION` 設定の存在を検出して自動有効化する。手動 SDK の OpenTelemetry セットアップと競合するため、CI/CD デプロイ時に完全削除し `TELEMETRY_CONNECTION_STRING` という独自名で渡す。

### 5.3 Staging環境 (app-pm-exam-dx-staging) の環境変数

Staging 固有の設定はワークフローの `deploy-staging` ジョブで自動設定される。  
以下の GitHub Secrets は事前に手動で登録が必要:

| Secret名 | 内容 |
|---------|------|
| `AZURE_STAGING_WEBAPP_NAME` | `app-pm-exam-dx-staging` |
| `COSMOS_DB_CONNECTION_STAGING` | pm-exam-dx-staging-db の接続文字列 |
| `NEXTAUTH_SECRET_STAGING` | `openssl rand -base64 32` で生成 |

## 6. トラブルシューティング

### 6.1 App Service 起動失敗

**症状**: デプロイ後にアプリが起動しない、503エラーが返る

| 原因 | 確認方法 | 解決策 |
|------|---------|--------|
| 起動コマンドが残存設定に上書きされている | Azure Portal > App Service > 構成 > 起動コマンドを確認 | CI/CD の `az webapp config set --startup-file "node server.js"` が正しく実行されているか確認 |
| `.next/static` が欠如 | ローカルで `npm run build:standalone` 後に `apps/web/.next/standalone/.next/static/` の存在を確認 | `azure-app-service.yml` の `Create deployment package` ステップで `../static` コピーが成功しているかログ確認 |
| `node_modules/next` が欠如 | ビルドログで `node_modules/next/package.json` の確認ステップを参照 | standalone ビルドが正常完了しているか確認 |

詳細: `docs/04_reports/AppService_Startup_Failure_RootCause_20260207.md`

### 6.2 API Route の静的レンダリングエラー

**症状**: ビルド時に以下のエラーが発生

```
Error: Route /api/xxx couldn't be rendered statically because it used `headers`.
```

**解決策**: 認証やヘッダーを使用する API Route には `dynamic = 'force-dynamic'` を追加する。

```typescript
// 認証を使用するAPIルートに必須
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    // ...
}
```

### 6.3 Staging デプロイが失敗する

**原因別確認**:

| 原因 | 確認・解決策 |
|------|------------|
| `AZURE_STAGING_WEBAPP_NAME` Secret未登録 | GitHub > Settings > Secrets and variables > Actions で確認 |
| `COSMOS_DB_CONNECTION_STAGING` Secret未登録 | 同上 |
| Staging App Service がまだ作成されていない | Azure Portal で `app-pm-exam-dx-staging` の存在を確認 |
| `AZURE_CREDENTIALS` の Service Principal に Staging App Service へのアクセス権がない | Staging リソースグループへの Contributor 権限を付与 |
| Artifact 取得で `fatal: not a git repository` が出る | `.github/workflows/azure-app-service.yml` の deploy / deploy-staging が `actions/download-artifact@v6` を使用していることを確認 |

### 6.4 OAuth コールバックエラー（Staging）

**症状**: Staging 環境でログインすると `redirect_uri_mismatch` エラー

**解決策**: OAuth プロバイダーに Staging のコールバック URL を追加する。

- GitHub OAuth App: `https://app-pm-exam-dx-staging.azurewebsites.net/api/auth/callback/github`
- Google Cloud Console: `https://app-pm-exam-dx-staging.azurewebsites.net/api/auth/callback/google`

### 6.5 デプロイ成功の確認ポイント

1. GitHub Actions で全ジョブが ✅ になることを確認
2. PR コメントに "✅ Staging デプロイ完了" が投稿されることを確認
3. Staging URL にアクセスしてトップページが表示されることを確認
4. `gh pr checks <PR番号>` で `Deploy to Staging` が成功することを確認

## 7. 変更履歴

| 日付 | 変更内容 | 担当 |
|------|---------|------|
| 2026/05/07 | **GitHub Actions artifact 取得方式の修正** | エージェント |
| | - `gh run download` を `actions/download-artifact@v6` に置換 | |
| | - checkout 不在ジョブでの `fatal: not a git repository` 再発防止を明記 | |
| 2026/04/09 | **Staging 環境構築対応** | エージェント |
| | - Azure App Service Staging (`app-pm-exam-dx-staging`) 追加 | |
| | - CI/CD に `deploy-staging` ジョブ追加（PRトリガー、PR URLコメント投稿） | |
| | - 設計書全面改訂（SWA→App Service 実態に更新） | |
| | - 環境一覧表・CI/CDフロー図を新構成に更新 | |
| 2026/04/07 | **リバースエンジニアリングによる大幅更新** | エージェント |
| | - Next.js 16.2.1 に対応 | |
| | - apps/api, apps/api-ai の存在を正確に反映 | |
| | - packages/config の追加を反映 | |
| | - アーキテクチャ図の詳細化（複数リージョン対応） | |
| | - Azure Functions の手動デプロイ手順明記 | |
| 2026/02/04 | navigationFallback/responseOverrides 禁止事項追加（warm-up timeout対策） | - |
| 2026/02/04 | API Route の `dynamic = 'force-dynamic'` 規約追加（セクション6.2） | - |
| 2026/02/02 | Application Insights 統合設計セクション追加 | - |
| 2026/02/01 | api-ai (US Function App) のデプロイ手順を追加 | - |
| 2026/01/27 | 初版作成。warm-up timeout 問題の調査結果と解決策を文書化 | - |
| 2025/12/29 | standalone モード削除による修正（コミット 1323190） | - |

## 8. Application Insights 統合設計

### 8.1 アーキテクチャ

すべてのレイヤーから単一の Application Insights インスタンス (`appi-pm-exam-dx`) にテレメトリを送信する統合構成。

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Insights                          │
│                 appi-pm-exam-dx (Japan East)                     │
│  InstrumentationKey: fa3400e8-401e-4493-89a7-23d520eb021b       │
└─────────────────────────────────────────────────────────────────┘
                    ▲           ▲           ▲
                    │           │           │
        ┌───────────┘           │           └───────────┐
        │                       │                       │
┌───────┴───────┐     ┌────────┴────────┐     ┌────────┴────────┐
│   ブラウザ     │     │   SWA (Node.js)  │     │ Azure Functions │
│ @microsoft/    │     │  applicationinsights │     │ (自動収集)      │
│ appinsights-web│     │                       │     │ host.json       │
└───────────────┘     └───────────────────────┘     └─────────────────┘
```

### 8.2 各レイヤーの設定

#### ブラウザ層

| 項目 | 値 |
|------|------|
| SDK | `@microsoft/applicationinsights-web` |
| 初期化場所 | `TelemetryProvider.tsx` |
| 環境変数 | `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` |
| 機能 | ページビュー、ユーザー行動トラッキング |

**重要**: ブラウザからアクセスするには `NEXT_PUBLIC_` プレフィックスが必須。

#### SWA層（Next.js サーバーサイド）

| 項目 | 値 |
|------|------|
| SDK | `applicationinsights` (Node.js) |
| 初期化場所 | `instrumentation.ts` → `lib/appinsights.ts` |
| 環境変数 | `APPLICATIONINSIGHTS_CONNECTION_STRING`, `START_APP_INSIGHTS=true` |
| 機能 | リクエスト、依存関係、例外の自動収集 |

**注意**: Azure SWA 環境では `NEXT_RUNTIME` が設定されない場合があるため、`typeof window === 'undefined'` でサーバーサイドを検出。

#### Azure Functions層

| 項目 | 値 |
|------|------|
| SDK | Azure Functions ランタイム自動収集 |
| 設定場所 | `host.json` |
| 環境変数 | `APPLICATIONINSIGHTS_CONNECTION_STRING` |
| 機能 | 関数実行、依存関係、例外の自動収集 |

### 8.3 環境変数一覧

| 変数名 | 設定場所 | 用途 |
|--------|---------|------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | SWA, Azure Functions | サーバーサイドテレメトリ |
| `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` | SWA | ブラウザテレメトリ |
| `TELEMETRY_RESOURCE_ID` | SWA | 管理画面の利用状況分析で App Insights の訪問者数を取得 |
| `START_APP_INSIGHTS` | SWA | App Insights 有効化フラグ |
| `ApplicationInsightsAgent_EXTENSION_VERSION` | SWA | SWA 拡張バージョン (`~3`) |

- ブラウザテレメトリは `TelemetryProvider` が `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` を優先利用する
- 上記が未設定でも `/api/config/telemetry` からランタイム取得できるため、SWA の静的配信時でも後から設定可能

### 8.4 host.json 設定（Azure Functions）

```json
{
    "logging": {
        "logLevel": {
            "default": "Information",
            "Host.Results": "Error",
            "Function": "Information",
            "Host.Aggregator": "Trace"
        },
        "applicationInsights": {
            "samplingSettings": {
                "isEnabled": true,
                "maxTelemetryItemsPerSecond": 20,
                "excludedTypes": "Request;Exception"
            }
        }
    }
}
```

- `excludedTypes`: リクエストと例外はサンプリングから除外（すべて記録）
- `maxTelemetryItemsPerSecond`: 過剰なテレメトリを防止

### 8.5 トラブルシューティング

| 症状 | 原因 | 解決策 |
|------|------|--------|
| ブラウザからログが出ない | `NEXT_PUBLIC_` プレフィックスなし | 環境変数名を修正 |
| SWA からログが出ない | `START_APP_INSIGHTS=true` 未設定 | 環境変数を追加 |
| Functions からログが出ない | 接続文字列未設定 or 別インスタンス | 接続文字列を統一 |

## 9. api-ai (US Function App) のデプロイ

### 9.1 概要
Gemini API の地域制限を回避するため、US East 2 リージョンに独立した Azure Function App (`func-pm-exam-dx-ai-us`) を配置している。

### 9.2 デプロイ手順

**重要**: Linux Consumption Plan では `--build remote` オプションが必須。

```bash
# 1. api-ai ディレクトリに移動
cd apps/api-ai

# 2. ローカルビルド
npm run build

# 3. リモートビルドでデプロイ
func azure functionapp publish func-pm-exam-dx-ai-us --build remote
```

### 9.3 デプロイ成功の確認

```
Functions in func-pm-exam-dx-ai-us:
    aiPlan - [httpTrigger]
        Invoke url: https://func-pm-exam-dx-ai-us.azurewebsites.net/api/ai/plan
```

### 9.4 トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| 0 functions found | `--build remote` 未使用 | `--build remote` オプションを追加 |
| Gemini 404エラー | 無効なモデル名 | ListModels API で確認 |
| User location not supported | 間違ったリージョン | Function App が US リージョンにあることを確認 |

### 9.5 環境変数

Azure Portal > Function Apps > `func-pm-exam-dx-ai-us` > 設定 > 環境変数

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `GEMINI_API_KEY` | Google AI Studio APIキー | ✅ |
| `COSMOS_DB_CONNECTION` | CosmosDB接続文字列（メトリクス用） | ✅ |

## 10. 参考資料

- [Azure Static Web Apps - Deploy hybrid Next.js](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid)
- [Next.js - Output File Tracing (standalone)](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Azure SWA - Build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)
