/**
 * Application Insights プリロードスクリプト
 * 
 * このスクリプトは Next.js が起動する前に Node.js の --require オプションで読み込まれ、
 * Application Insights SDK を早期に初期化します。
 * 
 * Azure SWA + Next.js (Hybrid) 環境で Application Insights のログ出力を
 * 確実に動作させるために必要です。
 * 
 * 参考:
 * - https://medium.com/microsoftazure/enabling-the-node-js-application-insights-sdk-in-next-js-746762d92507
 * - https://github.com/microsoft/ApplicationInsights-node.js/issues/808
 * - https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#enable-logging-for-nextjs
 */

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
const isEnabled = process.env.START_APP_INSIGHTS === 'true';

if (connectionString && isEnabled) {
    try {
        const appInsights = require('applicationinsights');
        
        // 既に初期化済みの場合はスキップ
        if (appInsights.defaultClient) {
            console.log('[Preload] Application Insights already initialized, skipping');
        } else {
            appInsights
                .setup(connectionString)
                .setAutoCollectConsole(true, true)          // console.log/error を収集
                .setAutoCollectExceptions(true)             // 未処理例外を収集
                .setAutoCollectRequests(true)               // HTTP リクエストを収集
                .setAutoCollectDependencies(true)           // 外部依存関係（DB、HTTP等）を収集
                .setAutoCollectPerformance(true, true)      // パフォーマンスカウンターを収集
                .setAutoDependencyCorrelation(true)         // 分散トレーシングの相関
                .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
                .setSendLiveMetrics(true)                   // Live Metrics Stream を有効化
                .setUseDiskRetryCaching(false);             // SWA 環境ではディスクキャッシュを無効化（読み取り専用FS対応）

            // Azure プロパティを自動設定
            appInsights.defaultClient.setAutoPopulateAzureProperties(true);
            
            // クラウドロール名を設定（ログで識別しやすくするため）
            appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = 'swa-pm-exam-dx-prod';
            appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRoleInstance] = 'next-js-hybrid';

            appInsights.start();
            
            console.log('[Preload] Application Insights initialized successfully');
            console.log('[Preload] Connection endpoint:', connectionString.split(';').find(s => s.startsWith('IngestionEndpoint')));
        }
    } catch (error) {
        console.error('[Preload] Failed to initialize Application Insights:', error);
    }
} else {
    if (!connectionString) {
        console.log('[Preload] Application Insights skipped: APPLICATIONINSIGHTS_CONNECTION_STRING not set');
    }
    if (!isEnabled) {
        console.log('[Preload] Application Insights skipped: START_APP_INSIGHTS is not "true" (current:', process.env.START_APP_INSIGHTS, ')');
    }
}
