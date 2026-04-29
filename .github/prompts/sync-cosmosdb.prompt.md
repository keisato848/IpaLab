---
description: 'CosmosDBへ問題データを同期する。ファイアウォールIP一時許可、sync-db実行、IP削除を自動化する。'
tools:
	- read
	- search
	- execute
	- web
---

# CosmosDB データ同期

問題データ（`questions_raw.json`）を本番 CosmosDB に同期する。
ネットワークはゼロトラスト構成のため、同期中のみローカル IP を一時許可し、完了後に削除する。

## 引数

- `${input:target}` — 同期対象。試験IDを指定（例: `AP-2024-Fall-AM`）。複数指定はカンマ区切り（例: `AP-2016-Spring-AM,AP-2019-Fall-AM`）。`all` で全件同期

## CosmosDB 情報

- アカウント: `cosmos-pm-exam-dx-db`
- リソースグループ: `rg-pm-exam-dx-prod-grobal`
- データベース: `pm-exam-dx-db`
- コンテナ: `Questions`（partitionKey: `/examId`）、`Exams`（partitionKey: `/id`）

## 注意: 接続文字列の優先順位問題

`sync-db.ts` は `apps/web/.env.local` を最初に読み込むため、ローカルエミュレータの接続文字列が優先される。
本番同期時は `$env:COSMOS_DB_CONNECTION` を明示的に設定すること。

本番接続文字列は `packages/data/.env` の `COSMOS_DB_CONNECTION` を使用する。

## ワークフロー

### 1. 現在のパブリック IP を取得

```powershell
(Invoke-WebRequest -Uri "https://ifconfig.me/ip" -UseBasicParsing).Content.Trim()
```

### 2. CosmosDB ファイアウォールに IP が登録済みか確認

```powershell
az cosmosdb show --name cosmos-pm-exam-dx-db --resource-group rg-pm-exam-dx-prod-grobal --query "ipRules[].ipAddressOrRange" -o tsv | Select-String "<取得したIP>"
```

- 登録済み → ステップ3をスキップ
- 未登録 → ステップ3で追加

### 3. ファイアウォールに IP を一時追加（未登録の場合のみ）

既存の IP リストに追加する形で更新する。既存 IP を消さないこと。

```powershell
# 既存IPを取得
$existing = az cosmosdb show --name cosmos-pm-exam-dx-db --resource-group rg-pm-exam-dx-prod-grobal --query "ipRules[].ipAddressOrRange" -o tsv
$newIp = "<取得したIP>"
$allIps = ($existing + $newIp) -join ","
az cosmosdb update --name cosmos-pm-exam-dx-db --resource-group rg-pm-exam-dx-prod-grobal --ip-range-filter $allIps
```

### 4. 本番接続文字列を設定して sync-db を実行

```powershell
# packages/data/.env から本番接続文字列を読み込み
$envContent = Get-Content "packages/data/.env" | Where-Object { $_ -match "^COSMOS_DB_CONNECTION=" }
$connStr = $envContent -replace '^COSMOS_DB_CONNECTION=', '' -replace '^"', '' -replace '"$', ''
$env:COSMOS_DB_CONNECTION = $connStr
```

対象が `all` の場合:
```powershell
npx tsx packages/data/src/scripts/sync-db.ts
```

対象が特定の試験IDの場合（カンマ区切りの場合は1件ずつ実行）:
```powershell
npx tsx packages/data/src/scripts/sync-db.ts --exam <試験ID>
```

### 4.5. 同期結果の検証 (必須)

`sync-db` の実行直後、IP 解放前に **必ず** カバレッジ検証を実行する。
これは Issue #208 の「ローカル JSON はあるが Cosmos に未投入」のギャップを
本番投入前に検出するためのガードレール。

```powershell
npx tsx packages/data/src/scripts/verify-data-coverage.ts
```

- 終了コード `0`: 全 examId に DB レコードあり (OK)
- 終了コード `1`: ギャップ検出。問題の examId を確認して `sync-db --exam` で再投入
- 終了コード `2`: 接続失敗 (IP 許可漏れ等)

特定試験のみ確認する場合:
```powershell
npx tsx packages/data/src/scripts/verify-data-coverage.ts --exam SA-2024-Spring-PM1
```

### 5. ファイアウォールから IP を削除

同期完了後、追加した IP を必ず削除する。ステップ2で登録済みだった場合も削除する。

```powershell
$existing = az cosmosdb show --name cosmos-pm-exam-dx-db --resource-group rg-pm-exam-dx-prod-grobal --query "ipRules[].ipAddressOrRange" -o tsv
$removeIp = "<取得したIP>"
$filtered = $existing | Where-Object { $_ -ne $removeIp }
$newIps = $filtered -join ","
az cosmosdb update --name cosmos-pm-exam-dx-db --resource-group rg-pm-exam-dx-prod-grobal --ip-range-filter $newIps
```

### 6. IP 削除を確認

```powershell
az cosmosdb show --name cosmos-pm-exam-dx-db --resource-group rg-pm-exam-dx-prod-grobal --query "ipRules[].ipAddressOrRange" -o tsv | Select-String "<取得したIP>"
```

結果が空であれば削除完了。
