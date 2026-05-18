# Azure Cosmos DB データ同期手順

本プロジェクトの試験データ（`packages/data/data` 内の JSON/Markdown）を Azure Cosmos DB に反映させるための手順です。

## 前提条件

1. **Azure Cosmos DB リソースの作成**: Azure Portal で Cosmos DB (NoSQL) アカウント、データベース、コンテナが作成されていること（スクリプトが自動生成しますが、アカウント自体は必要です）。
2. **接続文字列の取得**: Azure Portal から「プライマリ接続文字列」を取得してください。

## 環境変数の設定

同期スクリプトは `COSMOS_DB_CONNECTION` 環境変数を参照します。

**ローカルエミュレータで検証する場合:**

公式 Linux 版 Cosmos DB Emulator をリポジトリルートから起動し、DB/コンテナ作成と疎通確認を行います。

```bash
npm run cosmos:emulator
npm run cosmos:verify-local
```

`npm run cosmos:verify-local` は `http://localhost:8080/ready` を優先し、未公開の場合は `https://<local-host>:8081` gateway 到達を fallback として扱います。devcontainer / Docker コンテナ内では `host.docker.internal:8081` を自動検出対象に含めます。検証では `pm-exam-dx-db` と主要コンテナを作成し、`Metrics` コンテナで write/read/delete を確認します。`COSMOS_DB_CONNECTION` が未設定の場合は到達可能なローカル host に合わせて公式エミュレータ既定の接続文字列を生成します。クラウド Cosmos DB の接続文字列を検出した場合は誤操作防止のため中止します。

停止する場合は以下を実行します。

```bash
npm run cosmos:emulator:down
```

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
2. `pm-exam-dx-db` > `Questions` コンテナを選択します。

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

## CosmosDB ファイアウォール制限下でのローカルアクセス

CosmosDB はゼロトラスト保護（Selected Networks モード）で運用されており、許可された VNet / IP アドレス以外からのアクセスは遮断されます。ローカル PC から `packages/data` のスクリプト（sync-db, check-duplicates 等）を実行する場合は、**作業前に一時的にIPを許可し、作業後に必ず削除**してください。

### 前提条件

- Azure CLI がインストール・ログイン済み (`az login`)
- CosmosDB リソースへの操作権限

### 手順

#### 1. 作業前: 自分の IP を一時許可

```powershell
# 自分のパブリック IP を取得
$myIp = (Invoke-WebRequest -Uri "https://ifconfig.me" -UseBasicParsing).Content.Trim()
Write-Host "自分の IP: $myIp"

# 現在の CosmosDB IP ルールを取得
$existingIps = (az cosmosdb show `
  --name cosmos-pm-exam-dx-db `
  --resource-group rg-pm-exam-dx-prod-grobal `
  --query "ipRules[].ipAddressOrRange" -o tsv) -join ","

# 自分の IP を追加してファイアウォール更新
az cosmosdb update `
  --name cosmos-pm-exam-dx-db `
  --resource-group rg-pm-exam-dx-prod-grobal `
  --ip-range-filter "$existingIps,$myIp" `
  -o none

Write-Host "IP を一時許可しました。CosmosDB の更新完了まで数分かかる場合があります。"
```

> **注意**: CosmosDB の更新は非同期で行われ、完了まで 1〜5 分程度かかることがあります。  
> `provisioningState` が `Succeeded` になるまで待ってから作業を開始してください。

```powershell
# 更新完了を確認
az cosmosdb show `
  --name cosmos-pm-exam-dx-db `
  --resource-group rg-pm-exam-dx-prod-grobal `
  --query provisioningState -o tsv
```

#### 2. 作業実行

```powershell
cd packages/data
npx ts-node src/scripts/sync-db.ts
```

#### 3. 作業後: 自分の IP を削除（必須）

```powershell
# 元の IP リストに戻す（自分の IP を除外）
az cosmosdb update `
  --name cosmos-pm-exam-dx-db `
  --resource-group rg-pm-exam-dx-prod-grobal `
  --ip-range-filter "$existingIps" `
  -o none

Write-Host "IP を削除しました。"
```

### 注意事項

- **作業後は必ず IP を削除**すること。放置するとセキュリティリスクになります
- `$existingIps` 変数は PowerShell セッション内で保持されるため、同じターミナルで作業してください
- セッションが切れた場合は、手動で Azure Portal から IP を削除してください
- CosmosDB のリソースグループ名は `rg-pm-exam-dx-prod-grobal`（typo ですが実際のリソース名）です
