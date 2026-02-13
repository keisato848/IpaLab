## Plan: CosmosDB ゼロトラスト保護（Service Endpoint + IPフィルタ方式）

### TL;DR

CosmosDB (`cosmos-pm-exam-dx-db`) へのアクセスを、App Service は VNet Service Endpoint 経由、Function App は IP アドレスフィルタで制限し、それ以外からの通信をすべて遮断します。Private Endpoint / VNet Peering / Function App プランアップグレードが不要のため、**追加コスト $0** で実現できます。

### 現状アーキテクチャ

```
[ユーザー] → [App Service (East Asia)] --パブリック接続-→ [CosmosDB (East Asia)]
                  ↓ (プロキシ)                                    ↑
           [Function App (US East 2)] ------パブリック接続--------┘
                                                                  ↑
           [ローカルPC (packages/data)] ---パブリック接続----------┘
```

- CosmosDB: パブリックアクセス有効（全IP許可）
- 認証: 接続文字列によるキー認証のみ

### 目標アーキテクチャ

```
┌─ VNet-EA (East Asia: 10.0.0.0/16) ───────────────────────────────────┐
│  snet-appservice (10.0.1.0/24)                                        │
│    ← App Service VNet統合                                             │
│    ← Service Endpoint: Microsoft.AzureCosmosDB                       │
└───────────────┬───────────────────────────────────────────────────────┘
                │ Service Endpoint 経由（Azure バックボーン内）
                ▼
┌─ CosmosDB (cosmos-pm-exam-dx-db) ────────────────────────────────────┐
│  publicNetworkAccess: Enabled (Selected Networks モード)               │
│  ファイアウォール:                                                     │
│    ✅ VNet-EA/snet-appservice (Service Endpoint)                      │
│    ✅ Function App アウトバウンド IP (possibleOutboundIpAddresses)     │
│    ❌ それ以外のすべての通信 → 遮断                                   │
│    ❌ Azure サービスからのアクセス許可 → OFF                           │
└───────────────▲───────────────────────────────────────────────────────┘
                │ IPフィルタで許可
┌───────────────┴───────────────────────────────────────────────────────┐
│  Function App (US East 2, Y1 Consumption プランのまま)                 │
│  アウトバウンド IP → CosmosDB ファイアウォールに登録                    │
└───────────────────────────────────────────────────────────────────────┘

[ローカルPC] → 通常時は遮断。作業時のみ一時的に IP を許可/解除
```

---

### Steps

**Step 1: VNet 作成と App Service VNet 統合**

1. East Asia に VNet を作成:
   - 名前: `vnet-pm-exam-dx-ea`
   - アドレス空間: `10.0.0.0/16`
   - サブネット: `snet-appservice` (`10.0.1.0/24`)
     - 委任: `Microsoft.Web/serverFarms`
     - Service Endpoint: `Microsoft.AzureCosmosDB`

2. App Service (`app-pm-exam-dx-prod`) に VNet 統合を設定:
   - 統合先: `vnet-pm-exam-dx-ea/snet-appservice`
   - `WEBSITE_VNET_ROUTE_ALL=1` を設定（全アウトバウンドを VNet 経由）

```bash
# VNet 作成
az network vnet create \
  --name vnet-pm-exam-dx-ea \
  --resource-group rg-pm-exam-dx-prod \
  --location eastasia \
  --address-prefix 10.0.0.0/16

# サブネット作成（Service Endpoint + 委任付き）
az network vnet subnet create \
  --name snet-appservice \
  --resource-group rg-pm-exam-dx-prod \
  --vnet-name vnet-pm-exam-dx-ea \
  --address-prefix 10.0.1.0/24 \
  --delegations Microsoft.Web/serverFarms \
  --service-endpoints Microsoft.AzureCosmosDB

# App Service VNet 統合
az webapp vnet-integration add \
  --name app-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --vnet vnet-pm-exam-dx-ea \
  --subnet snet-appservice

# 全トラフィックを VNet 経由に
az webapp config appsettings set \
  --name app-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --settings WEBSITE_VNET_ROUTE_ALL=1
```

**Step 2: Function App のアウトバウンド IP を取得**

```bash
# Function App の全候補アウトバウンド IP を取得
az functionapp show \
  --name func-pm-exam-dx-ai-us \
  --resource-group rg-pm-exam-dx-ai-us \
  --query possibleOutboundIpAddresses \
  --output tsv
```

出力例: `20.x.x.1,20.x.x.2,20.x.x.3,...`

**Step 3: CosmosDB ファイアウォールを設定（Selected Networks モード）**

```bash
# VNet ルール追加（App Service サブネットの Service Endpoint）
az cosmosdb network-rule add \
  --name cosmos-pm-exam-dx-db \
  --resource-group rg-pm-exam-dx-prod-grobal \
  --subnet snet-appservice \
  --vnet-name vnet-pm-exam-dx-ea \
  --virtual-network-rules-vnet-rg rg-pm-exam-dx-prod

# IP ルール追加（Function App の全アウトバウンド IP）
# ※ Step 2 で取得した IP をカンマ区切りで指定
az cosmosdb update \
  --name cosmos-pm-exam-dx-db \
  --resource-group rg-pm-exam-dx-prod-grobal \
  --ip-range-filter "20.x.x.1,20.x.x.2,20.x.x.3,..."

# Azure Portal アクセス用の IP を追加（Azure Portal からの Data Explorer を利用する場合）
# 104.42.195.92,40.76.54.131,52.176.6.30,52.169.50.45,52.187.184.26
# → 不要ならスキップ
```

**注意**: `az cosmosdb update --ip-range-filter` は既存ルールを上書きするため、VNet ルール追加後に実行すること。また `--ip-range-filter` に Function App IP と Azure Portal IP をまとめて指定する。

**Step 4: 動作確認（パブリックアクセス遮断前の最終チェック）**

1. App Service からの接続を確認:
   - `https://shikaku-no.com` にアクセスし、試験データが表示されるか
   - 学習記録の保存・読み出しが動作するか
   - 認証（NextAuth — Users/Accounts/Sessions）が動作するか

2. Function App からの接続を確認:
   - AI プラン生成を実行し、Metrics/PlanJobs コンテナへの書き込みが成功するか

3. ローカル PC からの遮断を確認:
   - `packages/data` の sync-db スクリプトを実行し、接続が**拒否される**ことを確認

**Step 5: Bicep テンプレートの更新**

[infra/azure/network.bicep](infra/azure/network.bicep) を新規作成 — IaC としてネットワーク構成を定義:

```bicep
param location string = 'eastasia'
param appName string = 'pm-exam-dx'
param envName string = 'prod'
param functionAppOutboundIps string // Function App の possibleOutboundIpAddresses

// VNet (East Asia)
resource vnetEa 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: 'vnet-${appName}-ea'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'snet-appservice'
        properties: {
          addressPrefix: '10.0.1.0/24'
          delegations: [
            {
              name: 'delegation'
              properties: { serviceName: 'Microsoft.Web/serverFarms' }
            }
          ]
          serviceEndpoints: [
            { service: 'Microsoft.AzureCosmosDB' }
          ]
        }
      }
    ]
  }
}

// CosmosDB ファイアウォール設定
// ※ 既存 cosmosAccount リソースの properties に以下を追加:
//   isVirtualNetworkFilterEnabled: true
//   virtualNetworkRules: [{ id: vnetEa.properties.subnets[0].id }]
//   ipRules: [Function App IPs を配列で指定]
//   publicNetworkAccess: 'SecuredByPerimeter' // or keep 'Enabled' with Selected Networks
```

**Step 6: ローカルデータスクリプト用の一時アクセス手順**

`packages/data` のスクリプト (sync-db, check-duplicates等) からのアクセス用:

```bash
# 作業前: 自分の IP を取得して一時許可
MY_IP=$(curl -s ifconfig.me)
EXISTING_IPS=$(az cosmosdb show --name cosmos-pm-exam-dx-db --resource-group rg-pm-exam-dx-prod-grobal --query ipRules[].ipAddressOrRange -o tsv | tr '\n' ',')
az cosmosdb update \
  --name cosmos-pm-exam-dx-db \
  --resource-group rg-pm-exam-dx-prod-grobal \
  --ip-range-filter "${EXISTING_IPS}${MY_IP}"

# 作業実行
npm run sync-db

# 作業後: 自分の IP を削除（元の IP リストに戻す）
az cosmosdb update \
  --name cosmos-pm-exam-dx-db \
  --resource-group rg-pm-exam-dx-prod-grobal \
  --ip-range-filter "${EXISTING_IPS%,}"
```

この手順を [docs/azure-sync-guide.md](docs/azure-sync-guide.md) に追記。

**Step 7: 設計書の更新**

- [docs/03_migration/01_Azure_AppService_Design.md](docs/03_migration/01_Azure_AppService_Design.md) — ネットワーク設定セクションに VNet 統合・Service Endpoint の記載を追加
- [docs/01_planning/azure_config/04_CosmosDB.md](docs/01_planning/azure_config/04_CosmosDB.md) — ファイアウォール構成（Selected Networks）を追記
- [docs/01_planning/azure_config/03_AzureFunctions.md](docs/01_planning/azure_config/03_AzureFunctions.md) — IP フィルタ方式の記載を追記

**Step 8: CI/CD ワークフローの確認**

- [.github/workflows/azure-app-service.yml](.github/workflows/azure-app-service.yml):
  - App Service デプロイ後も VNet 統合が維持されることを確認（`az webapp vnet-integration add` は冪等）
  - 必要なら VNet 統合の再設定ステップを追加
- Function App のデプロイワークフロー:
  - デプロイ後にアウトバウンド IP が変更されていないか確認するステップを検討

---

### コスト試算

#### 追加コスト一覧

| リソース | 単価 | 月額コスト | 備考 |
|---------|------|-----------|------|
| VNet (East Asia) | 無料 | **$0** | VNet 自体は無料 |
| Service Endpoint | 無料 | **$0** | Service Endpoint に課金なし |
| CosmosDB ファイアウォール | 無料 | **$0** | ファイアウォール設定に課金なし |
| App Service VNet 統合 | 既存 B1 で対応 | **$0** | B1 は VNet 統合対応済み |
| Function App | Y1 のまま | **$0** | プラン変更不要（IP フィルタ方式） |

#### 月額コスト増 合計

**追加コスト = $0/月**

> **コスト増なし**

#### 元案との比較

| 項目 | 元案 (Private Endpoint) | 採用案 (Service Endpoint + IP) |
|------|------------------------|-------------------------------|
| Private Endpoint | $7.30/月 | 不要 |
| Private DNS Zone | $0.50/月 | 不要 |
| VNet Peering | $0.21/月 | 不要 |
| Function App Plan | +$13/月 (Y1→B1) | $0 (Y1のまま) |
| **合計** | **~$21/月** | **$0/月** |

---

### Verification

1. **App Service 接続テスト**: `https://shikaku-no.com` にアクセスし、試験データの表示・学習記録の保存・認証が動作するか
2. **Function App 接続テスト**: AI プラン生成を実行し、Metrics / PlanJobs コンテナに書き込まれるか
3. **パブリックアクセス遮断確認**: ローカル PC から CosmosDB 接続文字列で直接アクセスし、接続が**拒否される**ことを確認
4. **Azure Portal Data Explorer**: CosmosDB ファイアウォールに Azure Portal IP を追加している場合、Portal からデータ参照が可能か確認
5. **Function App IP 監視**: `az functionapp show --query possibleOutboundIpAddresses` の値が CosmosDB ファイアウォールの設定と一致しているか定期確認

### Decisions

- **Service Endpoint + IP フィルタ方式を採用**: コスト $0 で十分なセキュリティを確保。通信は Azure バックボーン内（Microsoft ネットワーク内）で完結し、許可リスト外からのアクセスは遮断される
- **Private Endpoint は不採用**: セキュリティ上はより強固だが、月額 $21 のコスト増に見合わない（個人プロジェクト規模）
- **Function App は Y1 (Consumption) のまま**: VNet 統合せず IP フィルタで対応。コスト増を回避
- **Key Vault は今回のスコープ外**: 接続文字列の管理方法は現状維持
- **デプロイ順序**: VNet 作成 → Service Endpoint → App Service VNet 統合 → Function App IP 取得 → CosmosDB ファイアウォール設定（**段階的に適用して切り戻し可能にする**）
- **ローカルアクセスは一時 IP 許可方式**: 作業前に追加、作業後に削除するスクリプトを用意
