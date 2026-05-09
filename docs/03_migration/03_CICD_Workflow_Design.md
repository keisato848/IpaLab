# CI/CD ワークフロー設計書

## 1. 概要

Azure Static Web Apps から Azure App Service への移行に伴い、CI/CD パイプラインを完全に刷新する。

## 2. 現行構成と新構成の比較

| 項目 | 現行 (SWA) | 新構成 (App Service) |
|------|-----------|---------------------|
| GitHub Actions ファイル | `azure-static-web-apps.yml` | `azure-app-service.yml` |
| デプロイ方式 | `Azure/static-web-apps-deploy@v1` | Azure CLI `az webapp deploy` |
| ビルド場所 | Azure Oryx (SWA 側) | GitHub Actions (self-build) |
| 認証方式 | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Service Principal (`AZURE_CREDENTIALS`) or OIDC |
| ステージング | PR ごとの一時環境 | デプロイスロット (S1以上) |

## 3. 新しい GitHub Actions ワークフロー

### 3.1 メインワークフロー: `azure-app-service.yml`

```yaml
name: Azure App Service CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main
    paths:
      - 'apps/web/**'
      - 'packages/**'
      - '.github/workflows/azure-app-service.yml'

env:
  AZURE_WEBAPP_NAME: app-pm-exam-dx-prod
  AZURE_WEBAPP_PACKAGE_PATH: './apps/web/.next/standalone'
  NODE_VERSION: '24.x'

jobs:
  build:
    runs-on: ubuntu-latest
    name: Build
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build with Turborepo
        run: npx turbo run build --filter=web
        env:
          # ビルド時に必要な環境変数
          APPLICATIONINSIGHTS_CONNECTION_STRING: ${{ secrets.APPLICATIONINSIGHTS_CONNECTION_STRING }}

      - name: Copy static assets to standalone
        run: |
          cp -r apps/web/public apps/web/.next/standalone/apps/web/
          cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/

      - name: Upload artifact for deployment job
        uses: actions/upload-artifact@v7
        with:
          name: node-app
          path: apps/web/.next/standalone
          retention-days: 1

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    name: Deploy

    steps:
      - name: Download artifact from build job
        uses: actions/download-artifact@v6
        with:
          name: node-app
          path: ./deploy

      - name: Deploy to Azure Web App
        run: |
          rm -f deploy.zip
          (cd deploy && zip -qr ../deploy.zip .)
          az webapp deploy \
            --name ${{ env.AZURE_WEBAPP_NAME }} \
            --resource-group rg-pm-exam-dx-prod \
            --src-path deploy.zip \
            --type zip

  # PR 時のビルド検証（デプロイはしない）
  pr-check:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    name: PR Build Check
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build with Turborepo
        run: npx turbo run build --filter=web
        env:
          APPLICATIONINSIGHTS_CONNECTION_STRING: "dummy-for-build"

      - name: Run tests
        run: npm run test:run --workspace=web
```

### 3.2 認証方式

#### オプション A: Service Principal + Azure CLI（推奨）

```yaml
- name: Azure Login
  uses: azure/login@v3
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}

- name: Deploy to Azure Web App
  run: |
    rm -f deploy.zip
    (cd deploy && zip -qr ../deploy.zip .)
    az webapp deploy \
      --name ${{ env.AZURE_WEBAPP_NAME }} \
      --resource-group rg-pm-exam-dx-prod \
      --src-path deploy.zip \
      --type zip
```

従来の Azure 公式デプロイ Action は後継メジャータグが未提供のため、Node.js ランタイム警告を避ける目的で Azure CLI の Zip Deploy を使用する。

#### オプション B: OIDC (OpenID Connect)（より安全）

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Azure Login
    uses: azure/login@v3
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

  - name: Deploy to Azure Web App
    run: |
      rm -f deploy.zip
      (cd deploy && zip -qr ../deploy.zip .)
      az webapp deploy \
        --name ${{ env.AZURE_WEBAPP_NAME }} \
        --resource-group rg-pm-exam-dx-prod \
        --src-path deploy.zip \
        --type zip
```

## 4. GitHub Secrets 設定

### 4.1 必須シークレット

| シークレット名 | 説明 | 取得方法 |
|---------------|------|---------|
| `AZURE_CREDENTIALS` | App Service デプロイ用 Service Principal JSON | Azure CLI で作成 |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights 接続文字列 | Azure Portal > Application Insights |

### 4.2 OIDC 方式の場合（追加）

| シークレット名 | 説明 |
|---------------|------|
| `AZURE_CLIENT_ID` | サービスプリンシパルのクライアント ID |
| `AZURE_TENANT_ID` | Azure AD テナント ID |
| `AZURE_SUBSCRIPTION_ID` | Azure サブスクリプション ID |

## 5. monorepo 対応

### 5.1 standalone 出力の構造

monorepo + standalone モードでは、以下の構造で出力される：

```
apps/web/.next/standalone/
├── apps/
│   └── web/
│       ├── server.js        # エントリーポイント
│       ├── .next/
│       │   └── static/      # 手動コピー必要
│       └── public/          # 手動コピー必要
├── packages/
│   └── shared/              # 依存パッケージ
├── node_modules/            # 必要最小限
└── package.json
```

### 5.2 ビルド後の静的ファイルコピー

```yaml
- name: Copy static assets to standalone
  run: |
    # public フォルダをコピー
    cp -r apps/web/public apps/web/.next/standalone/apps/web/
    # static フォルダをコピー（CSS, JS など）
    cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/
```

### 5.3 App Service のスタートアップコマンド

```bash
node apps/web/server.js
```

Azure Portal > App Service > 構成 > 全般設定 > スタートアップコマンド に設定。

## 6. 既存ワークフローの廃止

### 6.1 廃止対象

| ファイル | 処理 |
|---------|------|
| `.github/workflows/azure-static-web-apps.yml` | 削除 or 無効化 |

### 6.2 廃止手順

```yaml
# 無効化する場合（ファイルを残す）
name: Azure Static Web Apps CI/CD (DEPRECATED)

on:
  workflow_dispatch:  # 手動実行のみ

# または、ファイルを削除
```

## 7. テスト統合

### 7.1 ビルド前テスト

```yaml
- name: Run unit tests
  run: npm run test:run --workspace=web
```

### 7.2 デプロイ後テスト（Smoke Test）

```yaml
- name: Smoke test
  run: |
    sleep 30  # App Service 起動待ち
    curl -f https://app-pm-exam-dx-prod.azurewebsites.net/api/health || exit 1
```

## 8. 移行手順

### Phase 1: 新ワークフロー作成

1. `.github/workflows/azure-app-service.yml` を作成
2. GitHub Secrets を設定
3. PR を作成してビルドテスト

### Phase 2: 並行運用

1. 両方のワークフローを有効化
2. main ブランチへのマージで両方デプロイ
3. 動作確認

### Phase 3: 旧ワークフロー廃止

1. `azure-static-web-apps.yml` を削除
2. SWA リソースを削除（任意）

## 9. ロールバック計画

### 9.1 デプロイ失敗時

```bash
# 前回のデプロイを再実行
gh run rerun <run-id> --failed

# または Azure Portal から前のデプロイに戻す
az webapp deployment source sync --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod
```

### 9.2 完全ロールバック（SWA に戻す）

1. `azure-static-web-apps.yml` を再有効化
2. main ブランチにプッシュ
3. App Service を停止

## 10. 監視とアラート

### 10.1 ワークフロー失敗通知

```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v8
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '❌ Deployment failed. Please check the workflow logs.'
      })
```

### 10.2 デプロイ成功通知

```yaml
- name: Post deployment URL
  if: success() && github.event_name == 'push'
  run: |
    echo "🚀 Deployed to https://app-pm-exam-dx-prod.azurewebsites.net"
```

## 11. チェックリスト

### 設定作業
- [ ] `.github/workflows/azure-app-service.yml` を作成
- [ ] GitHub Secrets に `AZURE_CREDENTIALS` を設定
- [ ] GitHub Secrets に `APPLICATIONINSIGHTS_CONNECTION_STRING` を設定
- [ ] App Service のスタートアップコマンドを設定

### 検証作業
- [ ] PR でビルドが成功する
- [ ] main マージでデプロイが成功する
- [ ] デプロイ後にアプリが正常起動する
- [ ] Application Insights にログが出力される

### クリーンアップ
- [ ] `azure-static-web-apps.yml` を削除
- [ ] `AZURE_STATIC_WEB_APPS_API_TOKEN` シークレットを削除

---

## 8. Staging 環境変数の管理

### 8.1 必須環境変数（Staging）

Staging デプロイ時に `az webapp config appsettings set` で設定する環境変数一覧。
設定漏れはサービス障害（認証失敗・AI機能停止等）に直結するため、変数を追加する際は
ワークフロー (`azure-app-service.yml`) の `Configure Staging App Service settings` ステップも
同時に更新すること。

| 環境変数 | 説明 | 値の管理方法 |
|---------|------|------------|
| `WEBSITE_RUN_FROM_PACKAGE` | App Service 実行方式 | `1` 固定 |
| `WEBSITES_PORT` | Listen ポート | `8080` 固定 |
| `AUTH_TRUST_HOST` | NextAuth ホスト自動検出 | `true` 固定 |
| `AUTH_SECRET` | NextAuth JWT 暗号化 | `NEXTAUTH_SECRET_STAGING` シークレット |
| `AUTH_GITHUB_ID` | GitHub OAuth | `AUTH_GITHUB_ID` シークレット |
| `AUTH_GITHUB_SECRET` | GitHub OAuth | `AUTH_GITHUB_SECRET` シークレット |
| `AUTH_GOOGLE_ID` | Google OAuth | `AUTH_GOOGLE_ID` シークレット |
| `AUTH_GOOGLE_SECRET` | Google OAuth | `AUTH_GOOGLE_SECRET` シークレット |
| `COSMOS_DB_CONNECTION` | CosmosDB 接続文字列 | `COSMOS_DB_CONNECTION` シークレット |
| `TELEMETRY_CONNECTION_STRING` | Application Insights | `APPLICATIONINSIGHTS_CONNECTION_STRING` シークレット |
| `STAGING_BYPASS_TOKEN` | Staging アクセストークン | `STAGING_BYPASS_TOKEN` シークレット |
| `STAGING_BYPASS_TARGET_GITHUB_ACCOUNT_ID` | バイパス対象アカウント | `STAGING_BYPASS_TARGET_GITHUB_ACCOUNT_ID` シークレット |
| `AI_CHAT_FUNCTION_URL` | Gemini プロキシ (US Function) | ワークフロー内に直接記載（公開エンドポイント） |

### 8.2 AI_CHAT_FUNCTION_URL の重要性

`AI_CHAT_FUNCTION_URL` が未設定の場合、AI 採点機能 (`/api/score`) および
午後試験採点 API (`/api/ai/scoring/*`) は East Asia から Gemini API を直接呼び出そうとするが、
Gemini API は East Asia リージョンをサポートしないため **Scoring failed** エラーが発生する。

本番・Staging ともに同一の US リージョン Function App を経由する:
```
https://func-pm-exam-dx-ai-us.azurewebsites.net/api/ai/chat
```

---

## 9. CodeQL Advanced スキャン制御

### 9.1 方針

CodeQL Advanced は **public リポジトリでのみ**実行する。
private リポジトリでは GitHub Advanced Security ライセンスが必要なため、ジョブレベルの条件でスキップする。

### 9.2 実装

`.github/workflows/codeql.yml` の `analyze` ジョブに以下の条件を設定する:

```yaml
if: ${{ !github.event.repository.private }}
```

- `private == true`（現在）→ ジョブをスキップ、ワークフロー自体は `success` で終了
- `private == false`（public に変更後）→ 自動的に再有効化される

### 9.3 public 再公開時の確認手順

リポジトリを public に変更した際は以下を確認すること:

1. `.github/workflows/codeql.yml` の変更は不要（条件が自動的に評価される）
2. GitHub Settings → Security → Code scanning が有効になっていること
3. 初回スキャン結果を確認し、アラートがあれば対処する

---

**作成日**: 2026-02-04
**更新日**: 2026-05-09（8章: Staging環境変数の管理、9章: CodeQL制御追加）
**ステータス**: 設計完了
