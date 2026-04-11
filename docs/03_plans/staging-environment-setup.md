# Staging 環境構築手順書

## 概要

PR マージ前の動作確認を可能にするため、Azure App Service に Staging 環境を構築する。

| 項目 | 値 |
|------|-----|
| Staging App Service 名 | `app-pm-exam-dx-staging` |
| App Service Plan | `asp-pm-exam-dx-prod`（本番と同一プラン、追加費用なし）|
| Staging CosmosDB | `pm-exam-dx-db`（**本番と共有**。データ構造変更が必要になった際に分離を検討）|
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

### 1-2. CosmosDB（本番共有）

CosmosDB は本番の `pm-exam-dx-db` を共有します。Staging 専用の CosmosDB 作成は不要です。

> **将来の分離タイミング**: データ構造（コンテナ定義・パーティションキー）を変更するような改修が必要になった際に、Serverless プランで別途 `pm-exam-dx-staging-db` を作成することを検討してください。

### 1-3. Staging 専用ログイン方式

Staging 環境は **本番の OAuth 設定を変更しない** 方針とし、`STAGING_BYPASS_TOKEN` による Credentials Provider ログインを使用する。

- 対象環境: `app-pm-exam-dx-staging` のみ
- 本番影響: なし
- ログイン画面: `/login`
- 表示条件: `STAGING_BYPASS_TOKEN` が環境変数として設定されていること

実装上の要点:

- `apps/web/auth.ts`
   - `STAGING_BYPASS_TOKEN` があるときだけ `staging-bypass` provider を登録
- `apps/web/app/login/page.tsx`
   - ランタイムの環境変数を読むため `dynamic = 'force-dynamic'` を付与
- `apps/web/components/features/auth/LoginForm.tsx`
   - `/api/auth/providers` の応答を参照して、Staging 専用のトークン入力フォームと利用可能な OAuth ボタンを表示

---

## Phase 2: GitHub Secrets の設定

GitHub リポジトリ > Settings > Secrets and variables > Actions > New repository secret で以下を追加:

| Secret 名 | 値 | 説明 |
|-----------|-----|------|
| `AZURE_STAGING_WEBAPP_NAME` | `app-pm-exam-dx-staging` | Staging App Service 名 |
| `NEXTAUTH_SECRET_STAGING` | *(下記コマンドで生成)* | Staging 用 NextAuth シークレット |
| `STAGING_BYPASS_TOKEN` | *(下記コマンドで生成)* | Staging 専用ログイントークン |

`NEXTAUTH_SECRET_STAGING` の生成方法:

```bash
# PowerShell の場合
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Linux/Mac の場合
openssl rand -base64 32
```

`STAGING_BYPASS_TOKEN` の生成方法:

```bash
# PowerShell の場合
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Linux/Mac の場合
openssl rand -base64 32
```

> **注意**: 既存の `AZURE_CREDENTIALS`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `COSMOS_DB_CONNECTION` は本番・Staging で共通利用するため追加不要。

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
- [ ] `/login` に "Staging 検証環境" セクションが表示されることを確認
- [ ] `STAGING_BYPASS_TOKEN` を入力して Staging ログインできることを確認
- [ ] ログイン後に問題一覧が表示・解答できることを確認
- [ ] `main` へのマージ後に本番デプロイが引き続き正常に動作することを確認

---

## 注意事項

- **同一 App Service Plan の共有**: 本番・Staging は同一 B1 Plan を共有するため、CPU/メモリが競合する。本番の負荷が高い場合は Staging を別 Plan（+約 $14/月）へ分離することを検討。
- **複数 PR 同時進行**: 固定 Staging URL のため、複数 PR が同時に存在する場合は最後にデプロイされた PR の内容が反映される。
- **データ共有**: Staging は本番の `pm-exam-dx-db` を共有する。Staging でのテストデータが本番 DB に書き込まれる点に注意。データ構造変更が必要な改修時は専用の `pm-exam-dx-staging-db`（Serverless）を作成して分離すること。

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026/04/09 | 初版作成 |
| 2026/04/11 | Staging 認証方式を OAuth 前提から `STAGING_BYPASS_TOKEN` による Credentials Provider 方式へ更新 |
