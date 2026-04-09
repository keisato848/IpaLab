# Staging 環境構築手順書

## 概要

PR マージ前の動作確認を可能にするため、Azure App Service に Staging 環境を構築する。

| 項目 | 値 |
|------|-----|
| Staging App Service 名 | `app-pm-exam-dx-staging` |
| App Service Plan | `asp-pm-exam-dx-prod`（本番と同一プラン、追加費用なし）|
| Staging CosmosDB | `pm-exam-dx-staging-db`（Serverless、使用量課金）|
| Staging URL | `https://app-pm-exam-dx-staging.azurewebsites.net` |

## Phase 1: Azure リソース作成

### 1-1. Staging App Service の作成

```bash
# 既存の本番 App Service Plan に同居（追加費用なし）
az webapp create \
  --name app-pm-exam-dx-staging \
  --plan asp-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --runtime "NODE:20-lts"
```

作成後、起動コマンドを設定:

```bash
az webapp config set \
  --name app-pm-exam-dx-staging \
  --resource-group rg-pm-exam-dx-prod \
  --startup-file "node server.js"
```

### 1-2. Staging CosmosDB の作成（Serverless）

```bash
# CosmosDB アカウント作成（Serverless プラン）
az cosmosdb create \
  --name pm-exam-dx-staging-db \
  --resource-group rg-pm-exam-dx-prod \
  --kind GlobalDocumentDB \
  --locations regionName="East Asia" failoverPriority=0 isZoneRedundant=false \
  --capabilities EnableServerless \
  --default-consistency-level Session

# データベース作成（本番と同じ名前）
az cosmosdb sql database create \
  --account-name pm-exam-dx-staging-db \
  --resource-group rg-pm-exam-dx-prod \
  --name IpaLabDB

# コンテナ作成（本番の定義をコピー。パーティションキーは本番と要確認）
az cosmosdb sql container create \
  --account-name pm-exam-dx-staging-db \
  --resource-group rg-pm-exam-dx-prod \
  --database-name IpaLabDB \
  --name Users \
  --partition-key-path "/userId"

az cosmosdb sql container create \
  --account-name pm-exam-dx-staging-db \
  --resource-group rg-pm-exam-dx-prod \
  --database-name IpaLabDB \
  --name ExamResults \
  --partition-key-path "/userId"

az cosmosdb sql container create \
  --account-name pm-exam-dx-staging-db \
  --resource-group rg-pm-exam-dx-prod \
  --database-name IpaLabDB \
  --name AIJobs \
  --partition-key-path "/userId"
```

> **注意**: 上記コンテナ名・パーティションキーが本番と一致しているか `packages/data/src/` を確認して合わせること。

### 1-3. Staging CosmosDB の接続文字列を取得

```bash
az cosmosdb keys list \
  --name pm-exam-dx-staging-db \
  --resource-group rg-pm-exam-dx-prod \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  -o tsv
```

出力された接続文字列を次の Phase 2 で GitHub Secrets に登録する。

### 1-4. OAuth プロバイダーに Staging URL を追加

#### GitHub OAuth App

1. GitHub > Settings > Developer settings > OAuth Apps > 本番アプリを開く
2. **Authorization callback URL** に追加:
   ```
   https://app-pm-exam-dx-staging.azurewebsites.net/api/auth/callback/github
   ```

#### Google Cloud Console

1. Google Cloud Console > APIs & Services > Credentials > 本番の OAuth 2.0 クライアントを開く
2. **承認済みのリダイレクト URI** に追加:
   ```
   https://app-pm-exam-dx-staging.azurewebsites.net/api/auth/callback/google
   ```

---

## Phase 2: GitHub Secrets の設定

GitHub リポジトリ > Settings > Secrets and variables > Actions > New repository secret で以下を追加:

| Secret 名 | 値 | 説明 |
|-----------|-----|------|
| `AZURE_STAGING_WEBAPP_NAME` | `app-pm-exam-dx-staging` | Staging App Service 名 |
| `COSMOS_DB_CONNECTION_STAGING` | *(Phase 1-3 で取得した接続文字列)* | Staging CosmosDB 接続文字列 |
| `NEXTAUTH_SECRET_STAGING` | *(下記コマンドで生成)* | Staging 用 NextAuth シークレット |

`NEXTAUTH_SECRET_STAGING` の生成方法:

```bash
# PowerShell の場合
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Linux/Mac の場合
openssl rand -base64 32
```

> **注意**: 既存の `AZURE_CREDENTIALS`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `APPLICATIONINSIGHTS_CONNECTION_STRING` は本番・Staging で共通利用するため追加不要。

---

## Phase 3: ワークフロー（実装済み）

`.github/workflows/azure-app-service.yml` に `deploy-staging` ジョブが追加済み。  
Phase 1・Phase 2 完了後、次の PR を作成することで自動的に Staging デプロイが実行される。

---

## Phase 4: ブランチ保護ルール設定

GitHub > Settings > Branches > main の保護ルールを更新:

1. **Require status checks to pass before merging** を有効化（既存）
2. Required status checks に以下を追加:
   - `Deploy to Staging`

> **目的**: Staging デプロイ成功がマージの必須条件になり、本番デプロイ前に動作確認が保証される。

---

## 動作確認チェックリスト

Phase 1〜4 完了後、以下で動作確認する:

- [ ] 任意の機能ブランチでPRを作成
- [ ] GitHub Actions で `Deploy to Staging` ジョブが成功することを確認
- [ ] PR のコメントに "✅ Staging デプロイ完了" と Staging URL が投稿されることを確認
- [ ] Staging URL (`https://app-pm-exam-dx-staging.azurewebsites.net`) にアクセスしてトップページが表示されることを確認
- [ ] GitHub / Google ログインが Staging 環境で機能することを確認
- [ ] ログイン後に問題一覧が表示・解答できることを確認
- [ ] `main` へのマージ後に本番デプロイが引き続き正常に動作することを確認

---

## 注意事項

- **同一 App Service Plan の共有**: 本番・Staging は同一 B1 Plan を共有するため、CPU/メモリが競合する。本番の負荷が高い場合は Staging を別 Plan（+約 $14/月）へ分離することを検討。
- **複数 PR 同時進行**: 固定 Staging URL のため、複数 PR が同時に存在する場合は最後にデプロイされた PR の内容が反映される。
- **データ分離**: Staging は専用の `pm-exam-dx-staging-db` を使用するため、本番データとの混在はなし。

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026/04/09 | 初版作成 |
