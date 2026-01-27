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
| 2026/01/27 | 初版作成。warm-up timeout 問題の調査結果と解決策を文書化 | - |
| 2025/12/29 | standalone モード削除による修正（コミット 1323190） | - |

## 8. 参考資料

- [Azure Static Web Apps - Deploy hybrid Next.js](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid)
- [Next.js - Output File Tracing (standalone)](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Azure SWA - Build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)
