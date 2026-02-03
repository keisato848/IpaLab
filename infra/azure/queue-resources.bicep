// ==============================================================================
// AI Plan Async Job System - Queue Resources
// ==============================================================================
// 
// このテンプレートは、AI学習計画の非同期生成システムに必要な
// Azure Queue Storage リソースを作成します。
//
// 既存のStorage Account (stpmexamdxaius) に Queue を追加する設計です。
// 
// デプロイ:
//   az deployment group create \
//     --resource-group rg-pm-exam-dx-ai-us \
//     --template-file queue-resources.bicep \
//     --parameters storageAccountName=stpmexamdxaius
//
// ==============================================================================

@description('既存のStorage Account名')
param storageAccountName string = 'stpmexamdxaius'

@description('ジョブキュー名')
param queueName string = 'ai-plan-jobs'

// ==============================================================================
// 既存リソース参照
// ==============================================================================

resource existingStorage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// ==============================================================================
// Queue Service
// ==============================================================================

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-01-01' = {
  parent: existingStorage
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

// ==============================================================================
// AI Plan Jobs Queue
// ==============================================================================

resource aiPlanJobsQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-01-01' = {
  parent: queueService
  name: queueName
  properties: {
    metadata: {
      purpose: 'AI学習計画の非同期生成ジョブ'
      createdBy: 'bicep-deployment'
      createdAt: '2026-02-03'
    }
  }
}

// ==============================================================================
// Outputs
// ==============================================================================

@description('作成されたQueue名')
output queueName string = aiPlanJobsQueue.name

@description('Storage Account名')
output storageAccountName string = existingStorage.name

@description('Queue URL')
output queueUrl string = '${existingStorage.properties.primaryEndpoints.queue}${queueName}'
