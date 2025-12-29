targetScope = 'subscription'

param location string = 'japaneast'
param rgName string = 'rg-pm-exam-dx-prod'
param envName string = 'prod'

// Unique details for resources (need to be globally unique)
param appName string = 'pm-exam-dx'

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: rgName
  location: location
}

module resources './resources.bicep' = {
  name: 'resourcesDeployment'
  scope: rg
  params: {
    location: location
    envName: envName
    appName: appName
  }
}

output staticWebAppName string = resources.outputs.staticWebAppName
output functionAppName string = resources.outputs.functionAppName
output cosmosAccountName string = resources.outputs.cosmosAccountName
