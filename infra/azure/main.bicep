targetScope = 'subscription'

param location string = 'japaneast'
param rgName string = 'rg-pm-exam-dx-prod'
param envName string = 'prod'

// Unique details for resources (need to be globally unique)
param appName string = 'pm-exam-dx'

// ネットワーク保護パラメータ
@description('VNet のリージョン (East Asia)')
param vnetLocation string = 'eastasia'

@description('Function App の possibleOutboundIpAddresses (カンマ区切り)')
param functionAppOutboundIps string = ''

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: rgName
  location: location
}

// ネットワーク構成 (VNet + Service Endpoint)
module network './network.bicep' = if (!empty(functionAppOutboundIps)) {
  name: 'networkDeployment'
  scope: rg
  params: {
    location: vnetLocation
    appName: appName
    functionAppOutboundIps: functionAppOutboundIps
  }
}

// リソース構成 (CosmosDB, Function App, SWA 等)
module resources './resources.bicep' = {
  name: 'resourcesDeployment'
  scope: rg
  dependsOn: !empty(functionAppOutboundIps) ? [network] : []
  params: {
    location: location
    envName: envName
    appName: appName
    appServiceSubnetId: networkEnabled ? network.outputs.appServiceSubnetId : ''
    cosmosIpRules: networkEnabled ? network.outputs.functionAppIpRules : []
  }
}

// ネットワーク保護が有効かどうかのフラグ
var networkEnabled = !empty(functionAppOutboundIps)

output staticWebAppName string = resources.outputs.staticWebAppName
output functionAppName string = resources.outputs.functionAppName
output cosmosAccountName string = resources.outputs.cosmosAccountName
output vnetName string = networkEnabled ? network.outputs.vnetName : 'none'
