# デプロイ手順書

このガイドは、**IpaLab** アプリケーション (Next.js SSR + Managed API) を GitHub Actions を使用して Azure Static Web Apps にデプロイする手順を示します。

## 前提条件
- Azure サブスクリプション
- GitHub リポジトリ (このプロジェクトと連携済みであること)
- Azure CLI (任意ですが推奨)

## 1. Azure リソースの作成

### オプション A: [推奨] 自動作成 (Infrastructure as Code)
`infra` フォルダにある Bicep ファイルを使用して、必要なリソース（Resource Group, SWA, Cosmos DB, etc.）を一括で作成できます。
*注: 現在の構成では独立した Function App は作成されません。*

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
3. デプロイ完了後、Azure Portal で `rg-pm-exam-dx-prod` リソースグループを確認し、以下の情報を取得してください。
   - **Static Web App**: デプロイ トークン

---

### オプション B: 手動作成 (Azure Portal)

### Static Web App (フロントエンド & API)
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
    - **Api location**: (空欄 - Next.js API Routes を使用)
    - **Output location**: (空欄)
4. **確認と作成** をクリックします。
5. 作成完了後、リソースページに移動し、**デプロイ トークンの管理** から **デプロイ トークン** をコピーしておきます。

### Cosmos DB (データベース)
1. Cosmos DB アカウントが作成済みで、接続文字列が利用可能であることを確認してください。

## 2. GitHub Secrets の設定

GitHub リポジトリの **Settings** > **Secrets and variables** > **Actions** に移動します。
以下のシークレットを追加してください:

| シークレット名                      | 値の取得元                                                     |
| :---------------------------------- | :------------------------------------------------------------- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN`   | SWA デプロイ トークン (手順 1 で取得)                          |

## 3. 環境変数の設定 (Static Web App)

Static Web App リソース > **設定** > **環境変数** に移動します。
フロントエンド(SSR)とバックエンド(API)の両方で使用する変数を設定します。

| キー                      | 説明                                                         |
| :------------------------ | :----------------------------------------------------------- |
| `COSMOS_DB_CONNECTION`    | Cosmos DB 接続文字列                                         |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights 接続文字列                                     |
| `NEXTAUTH_URL`            | アプリケーションのURL (例: `https://...azurestaticapps.net`) |
| `AUTH_SECRET`             | 認証トークン暗号化用シークレット                             |
| `AUTH_TRUST_HOST`         | `true`                                                       |
| `AUTH_GITHUB_ID`          | GitHub OAuth Client ID                                       |
| `AUTH_GITHUB_SECRET`      | GitHub OAuth Client Secret                                   |
| `AUTH_GOOGLE_ID`          | Google OAuth Client ID                                       |
| `AUTH_GOOGLE_SECRET`      | Google OAuth Client Secret                                   |

*注意: 以前の設計書にあった `GITHUB_ID` 等は `AUTH_` プレフィックス付きに変更されました。*

## 4. デプロイ
`.github/workflows` 内のファイルを `main` ブランチにプッシュしてください。
`azure-static-web-apps.yml` がトリガーされ、Next.js フロントエンドと Managed API がデプロイされます。

### ビルド・デプロイの流れ
1. **GitHub Actions 上でのビルド**: `npm ci` → `turbo run build --filter=web`
   - モノレポ内のローカルパッケージ (`@ipa-lab/shared` 等) を含めて事前ビルド
2. **不要ファイルのクリーンアップ**: `.next/cache` と `.next/standalone` を削除
3. **Azure SWA へアップロード**: 事前ビルド済みの `.next` フォルダをアップロード
   - `skip_app_build: true` - Oryx によるフロントエンド再ビルドをスキップ
   - `skip_api_build: true` - Oryx による API 再ビルドをスキップ（ローカルパッケージ解決不可のため必須）

### SSG廃止に関する注記
ビルド時間の短縮とデプロイの安定化のため、**SSG (Static Site Generation)** は無効化され、**SSR (Server Side Rendering) / Dynamic Rendering** に変更されました。
これにより、すべてのページリクエストは Azure Static Web Apps の Managed Functions (Node.js) 上で処理されます。

### モノレポ構成に関する注記
本プロジェクトは `@ipa-lab/shared` 等のローカルパッケージを使用するモノレポ構成です。
これらは npm レジストリに公開されていないため、Azure Oryx による `npm install` は失敗します。
**必ず `skip_app_build` と `skip_api_build` を `true` に設定してください。**