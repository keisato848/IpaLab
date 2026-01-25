param location string
param envName string
param appName string
@secure()
param myIpAddress string // For temporal access if needed

// 0. Network - Private Endpoint requires a VNET
resource vnet 'Microsoft.Network/virtualNetworks@2021-02-01' = {
  name: 'vnet-${appName}-${envName}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'snet-function' // Subnet for Function App VNet Integration
        properties: {
          addressPrefix: '10.0.1.0/24'
          delegations: [
            {
              name: 'delegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'snet-private-endpoints' // Subnet for Private Endpoints
        properties: {
          addressPrefix: '10.0.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// 1. Cosmos DB (Serverless)
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'cosmos-${appName}-${envName}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    publicNetworkAccess: 'Disabled' // 🚨 Security Fix: Disable Public Access
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
  }
}

// Private Endpoint for Cosmos DB
resource cosmosPrivateEndpoint 'Microsoft.Network/privateEndpoints@2021-02-01' = {
  name: 'pe-cosmos-${appName}-${envName}'
  location: location
  properties: {
    subnet: {
      id: vnet.properties.subnets[1].id
    }
    privateLinkServiceConnections: [
      {
        name: 'plsc-cosmos-${appName}-${envName}'
        properties: {
          privateLinkServiceId: cosmosAccount.id
          groupIds: [
            'Sql'
          ]
        }
      }
    ]
  }
}

// Private DNS Zone for Cosmos DB
resource cosmosPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.documents.azure.com'
  location: 'global'
}

resource cosmosPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: cosmosPrivateDnsZone
  name: 'link-${vnet.name}'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnet.id
    }
    registrationEnabled: false
  }
}

resource cosmosPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2021-02-01' = {
  parent: cosmosPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink-documents-azure-com'
        properties: {
          privateDnsZoneId: cosmosPrivateDnsZone.id
        }
      }
    ]
  }
}


resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: 'IPA_Exam_DB'
  properties: {
    resource: {
      id: 'IPA_Exam_DB'
    }
  }
}

// 2. Storage Account
resource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: 'st${replace(appName, '-', '')}${envName}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false // 🚨 Security Fix: Disable Public Blob Access
    minimumTlsVersion: 'TLS1_2'
  }
}

// 3. Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${appName}-${envName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
  }
}

// 4. App Service Plan - Premium required for VNet Integration ideally, 
//    but Functions Premium (EP1) or Dedicated (B1+) is needed for stable VNet integration.
//    Standard Consumption (Y1) has limited VNet support. 
//    For this example, we assume Flex Consumption or Premium if strict private networking is required.
//    However, to keep costs manageable for a "fix", we will use Basic B1 as a minimum for VNET Integration support.
resource hostingPlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: 'plan-${appName}-${envName}'
  location: location
  sku: {
    name: 'B1' // Upgraded from Y1 to support VNet Integration reliably
    tier: 'Basic'
  }
  properties: {}
}

// 5. Azure Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: 'kv-${appName}-${envName}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      // Function App Managed Identity will be added later or via assignments
    ]
    enableRbacAuthorization: true // Modern approach: RBAC
  }
}

// Key Vault Secrets
resource secretCosmos 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'COSMOS-DB-CONNECTION'
  properties: {
    value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
  }
}

resource secretStorage 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'AzureWebJobsStorage'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
  }
}

// 6. Function App
resource functionApp 'Microsoft.Web/sites@2022-03-01' = {
  name: 'func-${appName}-${envName}'
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    virtualNetworkSubnetId: vnet.properties.subnets[0].id // VNET Integration
    siteConfig: {
        appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=${secretStorage.name})' // 🚨 Security Fix: KV Reference
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          // Note: This specific setting often struggles with KV references during deployment because it's needed for the runtime startup.
          // Sometimes it's better to leave this one direct, or use a separate storage not behind firewall for content. 
          // For strict security, we use KV, but if deployment fails, revert this one.
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('func-${appName}-${envName}')
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'COSMOS_DB_CONNECTION'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=${secretCosmos.name})' // 🚨 Security Fix: KV Reference
        }
        {
          name: 'WEBSITE_VNET_ROUTE_ALL'
          value: '1' // Route all traffic through VNET
        }
      ]
    }
  }
}

// Role Assignment: Grant Function App access to Key Vault Secrets (Key Vault Secrets User)
// Role ID for "Key Vault Secrets User" is 4633458b-17de-408a-b874-0445c86b69e6
resource kvRolePy 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// 7. Azure Static Web App (Unchanged)
resource swa 'Microsoft.Web/staticSites@2022-03-01' = {
  name: 'swa-${appName}-${envName}'
  location: 'eastasia' 
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    provider: 'GitHub'
    repositoryUrl: 'https://github.com/keisato848/IpaLab'
    branch: 'main'
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output staticWebAppName string = swa.name
output functionAppName string = functionApp.name
output cosmosAccountName string = cosmosAccount.name
