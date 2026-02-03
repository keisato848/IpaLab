# デプロイメント設計書

## 1. 概要

本ドキュメントは、IpaLab アプリケーションの Azure Static Web Apps (SWA) へのデプロイメント設計を記載する。
**本設計に違反した変更は、デプロイ失敗（warm-up timeout）を引き起こすため、厳守すること。**

## 2. 技術スタック

| コンポーネント | 技術 | バージョン |
|---------------|------|-----------|
| フレームワーク | Next.js | 14.x (App Router) |
| パッケージ管理 | npm workspaces + Turborepo | - |
| ホスティング | Azure Static Web Apps | Standard |
| リージョン | East Asia | - |

## 3. アーキテクチャ構成

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Monorepo (Turborepo)                │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │ apps/web │ │ apps/api │ │ packages/shared  │ │    │
│  │  │ (Next.js)│ │ (未使用) │ │ packages/data    │ │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ GitHub Actions
                          │ (azure-static-web-apps.yml)
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Azure Static Web Apps (SWA)                 │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Oryx Build Engine (内部ビルド)           │    │
│  │  - npm install                                   │    │
│  │  - npx turbo run build --filter=web             │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Next.js Hybrid Rendering                 │    │
│  │  - SSR (Server-Side Rendering)                  │    │
│  │  - API Routes                                    │    │
│  │  - React Server Components                       │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 4. ワークフロー設定（重要）

### 4.1 正しい設定（必須）

```yaml
- name: Build And Deploy
  uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    action: "upload"
    app_location: "/apps/web"        # ← monorepo 内の Next.js アプリパス
    api_location: ""                 # ← 空（Next.js API routes を使用）
    output_location: ""              # ← 空（Azure SWA が自動検出）
    app_build_command: "npx turbo run build --filter=web"  # ← Turborepo ビルド
```

### 4.2 禁止設定（デプロイ失敗の原因）

以下の設定は **絶対に使用しないこと**：

#### ❌ 禁止 1: standalone モード

```javascript
// next.config.js - 使用禁止
module.exports = {
    output: 'standalone',  // ← 禁止
}
```

**理由**: monorepo 構造では standalone 出力が `apps/web/.next/standalone/apps/web/server.js` に生成され、Azure SWA が正しくサーバーを起動できない。

#### ❌ 禁止 2: GitHub 側でのプリビルド + skip_app_build

```yaml
# 使用禁止
- name: Build
  run: npx turbo run build --filter=web

- name: Build And Deploy
  with:
    skip_app_build: true      # ← 禁止
    output_location: ".next"  # ← 禁止
```

**理由**: Azure SWA の Next.js hybrid サポートは、SWA 側でビルドする場合のみ正しく動作する。プリビルドした `.next` フォルダをアップロードしても warm-up が失敗する。

#### ❌ 禁止 3: post-build.js による静的ファイルコピー

```json
// package.json - 使用禁止
{
  "scripts": {
    "build": "next build && node scripts/post-build.js"  // ← 禁止
  }
}
```

**理由**: standalone モードを前提としたスクリプトであり、Azure SWA ネイティブサポートでは不要。

## 5. 環境変数設定

### 5.1 設定場所

| 変数の用途 | 設定場所 |
|-----------|---------|
| ビルド時に必要 | Azure SWA 側でビルドするため、Azure Portal の環境変数に設定 |
| ランタイム時に必要 | Azure Portal の環境変数に設定 |

### 5.2 必要な環境変数

Azure Portal > Static Web Apps > `swa-pm-exam-dx-prod` > 設定 > 環境変数

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `COSMOS_DB_CONNECTION` | Cosmos DB 接続文字列 | ✅ |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights | ✅ |
| `AUTH_SECRET` | NextAuth セッション暗号化 | ✅ |
| `AUTH_TRUST_HOST` | NextAuth ホスト信頼 | ✅ |
| `AUTH_GITHUB_ID` | GitHub OAuth | 任意 |
| `AUTH_GITHUB_SECRET` | GitHub OAuth | 任意 |
| `AUTH_GOOGLE_ID` | Google OAuth | 任意 |
| `AUTH_GOOGLE_SECRET` | Google OAuth | 任意 |
| `GEMINI_API_KEY` | Gemini AI API | 任意 |

## 6. トラブルシューティング

### 6.1 "Web app warm up timed out" エラー

**原因と解決策**:

| 原因 | 解決策 |
|------|--------|
| `output: 'standalone'` が有効 | next.config.js から削除 |
| `skip_app_build: true` を使用 | 削除して Azure SWA 側でビルド |
| `output_location: ".next"` を指定 | 空文字に変更 |
| post-build.js が実行されている | package.json から削除 |

### 6.2 デプロイ成功の確認ポイント

1. GitHub Actions ログで `Status: Succeeded` を確認
2. `Deployment Complete :)` メッセージを確認
3. warm-up 時間が 200秒以内（通常 150秒程度）

### 6.3 動作確認済みコミット

問題が発生した場合、以下のコミットの設定を参照：

- **コミット**: `1323190` (2025/12/29)
- **内容**: `fix: Revert standalone output (rely on SWA native Next.js support)`

## 7. 変更履歴

| 日付 | 変更内容 | 担当 |
|------|---------|------|
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
| `START_APP_INSIGHTS` | SWA | App Insights 有効化フラグ |
| `ApplicationInsightsAgent_EXTENSION_VERSION` | SWA | SWA 拡張バージョン (`~3`) |

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
