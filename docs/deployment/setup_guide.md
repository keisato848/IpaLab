# デプロイ手順書

このガイドは、**IpaLab** アプリケーション (Web + API) を GitHub Actions を使用して Azure にデプロイする手順を示します。

## 前提条件
- Azure サブスクリプション
- GitHub リポジトリ (このプロジェクトと連携済みであること)
- Azure CLI (任意ですが推奨)

## 1. Azure リソースの作成

### オプション A: [推奨] 自動作成 (Infrastructure as Code)
`infra` フォルダにある Bicep ファイルを使用して、必要な全リソース（Resource Group, SWA, Function App, Cosmos DB, etc.）を一括で作成できます。

**前提条件:**
- Azure CLI がインストールされていること
- `az login` で Azure にログインしていること

**実行手順:**
1. ターミナルで `infra` フォルダに移動します。
2. デプロイコマンドを実行します:
   ```powershell
   cd infra
   ./deploy.ps1
   ```
3. デプロイ完了後、Azure Portal で `rg-pm-exam-dx-prod` リソースグループを確認し、以下の情報を取得して、後続の「GitHub Secrets の設定」に進んでください。
   - **Static Web App**: デプロイ トークン
   - **Function App**: 発行プロファイル

---

### オプション B: 手動作成 (Azure Portal)
手動でリソースを作成したい場合は、以下の手順に従ってください。

### Static Web App (フロントエンド)
1. Azure Portal で **Static Web Apps** を検索します。
2. **作成** をクリックし、以下を選択します:
    - **リソースグループ**: `rg-pm-exam-dx-prod` (または任意の名前)
    - **名前**: `swa-pm-exam-dx-prod`
    - **リージョン**: East Asia (東アジア)
    - **プランの種類**: Standard (本番環境に推奨)
3. **デプロイの詳細** で以下を設定します:
    - **ソース**: **GitHub** を選択
    - リポジトリとブランチを承認して選択
    - **ビルドのプリセット**: Next.js
    - **App location**: `/apps/web`
    - **Api location**: (空欄 - Bring Your Own Backend を使用するため)
    - **Output location**: (空欄)
4. **確認と作成** をクリックします。
5. 作成完了後、リソースページに移動し、**デプロイ トークンの管理** から **デプロイ トークン** をコピーしておきます。

### Function App (バックエンド)
1. Azure Portal で **Function App** を検索します。
2. **作成** をクリックし、以下を選択します:
    - **リソースグループ**: `rg-pm-exam-dx-prod`
    - **関数アプリ名**: `func-pm-exam-dx-prod` (グローバルに一意である必要があります)
    - **ランタイム スタック**: Node.js
    - **バージョン**: 20 LTS
    - **オペレーティング システム**: Linux
    - **プラン**: Consumption (サーバーレス)
3. **確認と作成** をクリックします。
4. 作成完了後、**発行プロファイルの取得** をクリックしてファイルをダウンロードします。

### Cosmos DB (データベース)
1. Cosmos DB アカウントが作成済みで、接続文字列が利用可能であることを確認してください。

## 2. GitHub Secrets の設定

GitHub リポジトリの **Settings** > **Secrets and variables** > **Actions** に移動します。
以下のシークレットを追加してください:

| シークレット名                      | 値の取得元                                                     |
| :---------------------------------- | :------------------------------------------------------------- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN`   | SWA デプロイ トークン (手順 1 で取得)                          |
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | ダウンロードした発行プロファイルファイルの中身 (手順 1 で取得) |

## 3. 環境変数の設定

### Function App (バックエンド) の設定
Function App リソース > **設定** > **環境変数** に移動します。
以下を追加します:
- `COSMOS_DB_CONNECTION`: Cosmos DB の接続文字列
- `NEXTAUTH_SECRET`: ランダムな文字列 (フロントエンドと同じ値を設定)

### Static Web App (フロントエンド) の設定
Static Web App リソース > **設定** > **環境変数** に移動します。
以下を追加します:
- `NEXTAUTH_URL`: Static Web App の URL (例: `https://green-river-123.azurestaticapps.net`)
- `NEXTAUTH_SECRET`: APIと同じ値
- `GOOGLE_CLIENT_ID`: (認証を使用する場合)
- `GOOGLE_CLIENT_SECRET`: (認証を使用する場合)

## 4. バックエンドとフロントエンドのリンク
1. Static Web App リソースで、**API** に移動します。
2. **リンク** > **独自のバックエンドのリンク (Bring your own backend)** を選択します。
3. リソースの種類: **Function App**
4. サブスクリプションと作成した Function App (`func-pm-exam-dx-prod`) を選択します。
5. **リンク** をクリックします。

## 5. デプロイ
`.github/workflows` 内のファイルを `main` ブランチにプッシュしてください。これにより以下がトリガーされます:
1. `azure-static-web-apps.yml`: Next.js フロントエンドをデプロイ
2. `azure-functions.yml`: Node.js API をデプロイ

進行状況は GitHub の **Actions** タブで確認できます。
