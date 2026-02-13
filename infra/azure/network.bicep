// ==============================================================================
// CosmosDB ゼロトラスト保護 - ネットワーク構成
// ==============================================================================
//
// VNet (East Asia) + Service Endpoint + CosmosDB ファイアウォール設定
// App Service は VNet Service Endpoint 経由、Function App は IP フィルタで
// CosmosDB へのアクセスを制限し、それ以外からの通信を遮断する
//
// アーキテクチャ:
//   ┌─ VNet-EA (10.0.0.0/16) ─────────────────────────────────┐
//   │  snet-appservice (10.0.1.0/24)                           │
//   │    ← App Service VNet統合                                │
//   │    ← Service Endpoint: Microsoft.AzureCosmosDB           │
//   └───────────────┬──────────────────────────────────────────┘
//                   │ Service Endpoint (Azure バックボーン内)
//                   ▼
//   ┌─ CosmosDB ──────────────────────────────────────────────┐
//   │  Selected Networks モード                                │
//   │  ✅ VNet-EA/snet-appservice (Service Endpoint)           │
//   │  ✅ Function App アウトバウンド IP (IP フィルタ)          │
//   │  ❌ それ以外 → 遮断                                     │
//   └───────────────▲─────────────────────────────────────────┘
//                   │ IP フィルタで許可
//   ┌─ Function App (US East 2, Y1 Consumption) ──────────────┐
//   │  possibleOutboundIpAddresses → CosmosDB IP ルールに登録  │
//   └─────────────────────────────────────────────────────────┘
//
// デプロイ:
//   az deployment group create \
//     --resource-group rg-pm-exam-dx-prod \
//     --template-file network.bicep \
//     --parameters functionAppOutboundIps='<カンマ区切りIP>'
//
// ==============================================================================

@description('VNet のリージョン')
param location string = 'eastasia'

@description('プロジェクト名')
param appName string = 'pm-exam-dx'

@description('VNet 名のサフィックス (リージョン略称)')
param vnetSuffix string = 'ea'

@description('VNet アドレス空間')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('App Service サブネットのアドレス範囲')
param appServiceSubnetPrefix string = '10.0.1.0/24'

@description('Function App の possibleOutboundIpAddresses (カンマ区切り)')
param functionAppOutboundIps string

// ==============================================================================
// VNet (East Asia)
// ==============================================================================

resource vnetEa 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-${appName}-${vnetSuffix}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [
      {
        name: 'snet-appservice'
        properties: {
          addressPrefix: appServiceSubnetPrefix
          delegations: [
            {
              name: 'delegation-web'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
          serviceEndpoints: [
            {
              service: 'Microsoft.AzureCosmosDB'
            }
          ]
        }
      }
    ]
  }
}

// ==============================================================================
// Outputs
// ==============================================================================

@description('VNet リソース ID')
output vnetId string = vnetEa.id

@description('VNet 名')
output vnetName string = vnetEa.name

@description('App Service サブネットのリソース ID (CosmosDB VNet ルールで使用)')
output appServiceSubnetId string = vnetEa.properties.subnets[0].id

@description('Function App アウトバウンド IP の配列 (CosmosDB IP ルールで使用)')
output functionAppIpRules array = [
  for ip in split(functionAppOutboundIps, ','): {
    ipAddressOrRange: ip
  }
]
