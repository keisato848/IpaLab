# Azure Cosmos DB データ同期手順

本プロジェクトの試験データ（`packages/data/data` 内の JSON/Markdown）を Azure Cosmos DB に反映させるための手順です。

## 前提条件

1. **Azure Cosmos DB リソースの作成**: Azure Portal で Cosmos DB (NoSQL) アカウント、データベース、コンテナが作成されていること（スクリプトが自動生成しますが、アカウント自体は必要です）。
2. **接続文字列の取得**: Azure Portal から「プライマリ接続文字列」を取得してください。

## 環境変数の設定

同期スクリプトは `COSMOS_DB_CONNECTION` 環境変数を参照します。

**本番（クラウド）環境へ反映する場合:**

`.env` または `.env.local` ファイル（`apps/web` または `packages/data` 直下）に以下を設定します。

```bash
COSMOS_DB_CONNECTION="AccountEndpoint=https://<YOUR_ACCOUNT>.documents.azure.com:443/;AccountKey=<YOUR_KEY>;"
```

> **注意**: `localhost` や `127.0.0.1` が含まれていると、スクリプトは自動的にローカルエミュレータモードで動作します。クラウドに接続する場合は、正規の Azure エンドポイントを使用してください。

## 同期スクリプトの実行

ターミナルで `packages/data` ディレクトリに移動し、以下のコマンドを実行します。

```bash
cd packages/data
```

### 1. ドライラン（確認モード）
デフォルトではデータは書き込まれず、コンソールにログが出力されるだけです（または `DRY_RUN` 変数で制御される場合がありますが、現在のスクリプトは直接実行で反映されます。念のため、少量のデータでテストすることを推奨します）。

### 2. 本番反映

現在、`sync-db.ts` は実行すると即座に DB への書き込み（Upsert）を行います。

```bash
# TS-Node を使用して直接実行
npx ts-node src/scripts/sync-db.ts
```

または、`package.json` にスクリプトが定義されている場合:

```bash
npm run sync
```
※ `npm run sync` が `src/syncer/index.ts` (スタブ) を指している場合は、上記の `npx ts-node src/scripts/sync-db.ts` を直接使用してください。

## 確認方法

1. Azure Portal の **Data Explorer** を開きます。
2. `IpaLabDb` (または設定したDB名) > `Questions` コンテナを選択します。

## デプロイ後の環境設定 (Azure Static Web Apps)

デプロイされたアプリケーションが Azure Cosmos DB に接続するためには、**Azure Portal 上で環境変数の設定が必要**です。
設定を行わない場合、APIは `500 Internal Server Error (Cosmos DB not initialized)` を返します。

### 手順

1. [Azure Portal](https://portal.azure.com) にログインします。
2. デプロイした **Static Web App** リソースを開きます。
3. サイドメニューの **「設定 (Settings)」** > **「構成 (Configuration)」** を選択します。
4. **「アプリケーション設定 (Application settings)」** タブで **「+ 追加 (+ Add)」** をクリックします。
5. 以下の値を入力して追加します：
    - **Name**: `COSMOS_DB_CONNECTION`
    - **Value**: (Cosmos DB の接続文字列 - `AccountEndpoint=...` から始まるもの)
6. **「保存 (Save)」** をクリックして設定を反映させます。

設定反映後、数分待ってからアプリケーションをリロードしてください。
