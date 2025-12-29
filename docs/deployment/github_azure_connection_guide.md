# GitHubとAzureの連携手順書 (2025年12月版)

本ドキュメントは、GitHubリポジトリとAzure Static Web Appsを連携させ、継続的デプロイ (CI/CD) を実現するための手順書です。

## 事前準備

1.  **Azure Static Web App リソース**: Azure Portalですでに作成済みであること。
2.  **GitHub リポジトリ**: ソースコード（特に `.github/workflows/azure-static-web-apps.yml` を含む）が管理されていること。

---

## 手順 1: Azureからデプロイトークンを取得する

1.  [Azure Portal](https://portal.azure.com) にログインします。
2.  作成済みの **Static Web App** リソース（例: `stapp-ipalab-prod` など）を検索して開きます。
3.  左側のメニューで **「概要 (Overview)」** を選択します。
4.  画面上部の中央付近にある **「デプロイメント トークンの管理 (Manage deployment token)」** というリンクをクリックします。
5.  表示されたトークン文字列を **コピー** します。
    *   *注意: このトークンは認証鍵ですので、第三者に共有しないでください。*

## 手順 2: GitHub Secretsを設定する

1.  対象の **GitHub リポジトリページ** を開きます。
2.  上部タブの **「Settings (設定)」** をクリックします。
3.  左側のサイドバーから **「Secrets and variables」** > **「Actions」** を選択します。
4.  **「New repository secret」** ボタンをクリックします。
5.  以下の情報を入力します：
    *   **Name**: `AZURE_STATIC_WEB_APPS_API_TOKEN`
        *   ※ `.github/workflows/azure-static-web-apps.yml` ファイル内で指定されている変数名と一致させる必要があります。
    *   **Secret**: 手順1でコピーしたデプロイトークンを貼り付けます。
6.  **「Add secret」** をクリックして保存します。

## 手順 3: デプロイをトリガーする

1.  ローカルの変更（設定ファイル更新など）をコミットし、`main` ブランチへ **プッシュ** します。
    *   *重要: `apps/api/package.json` の変更やワークフローファイルの更新が含まれていることを確認してください。*
2.  GitHubリポジトリの **「Actions」** タブを開きます。
3.  **"Azure Static Web Apps CI/CD"**（またはコミットメッセージ名）というタイトルのワークフローが自動的に開始されていることを確認します。
4.  実行中のワークフローをクリックして、進行状況（ビルドログなど）をモニタリングできます。

## 手順 4: デプロイの確認

1.  Actionsのステータスが緑色のチェックマーク（**Success**）になったら完了です。
2.  Azure Portalに戻り、Static Web Appのメニューから **「環境 (Environments)」**、あるいは概要ページのURLを確認します。
3.  **「URL」** をクリックしてアプリを開きます。
    *   トップページが表示されること。
    *   「プロジェクトマネージャ」試験などの新しいデータが表示されること（APIが正常に動作していること）を確認してください。

---

## トラブルシューティング

*   **GitHub Actionsが失敗する場合**:
    *   「Build and Deploy Job」のログを確認してください。
    *   APIのビルドエラーが出ている場合、ディレクトリ構成や `package.json` のスクリプト (`npm run build`) が正しいか確認してください。
*   **アプリは開くがデータが表示されない場合**:
    *   APIのエンドポイント（例: `/api/exams`）が404エラーになっていないか、ブラウザの開発者ツールで確認してください。
    *   Azure Static Web Appsの設定で、`api_location` が正しく `apps/api` に設定されているか確認してください。
