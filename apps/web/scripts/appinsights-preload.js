/**
 * Application Insights Preload Script
 * 
 * Next.js standalone モードで instrumentation.ts が動作しない場合の代替として、
 * Node.js の --require オプションでこのスクリプトを読み込むことで
 * Application Insights SDK を HTTP モジュールより先に初期化します。
 * 
 * 使用方法:
 * node --require ./scripts/appinsights-preload.js server.js
 * 
 * @see https://learn.microsoft.com/azure/azure-monitor/app/nodejs
 */

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
    try {
        const appInsights = require('applicationinsights');
        
        // SDK が既に初期化されているかチェック
        if (!appInsights.defaultClient) {
            appInsights
                .setup(connectionString)
                .setAutoCollectRequests(true)
                .setAutoCollectPerformance(true, true)
                .setAutoCollectExceptions(true)
                .setAutoCollectDependencies(true)
                .setAutoCollectConsole(true, true)
                .setAutoCollectPreAggregatedMetrics(true)
                .setUseDiskRetryCaching(true)
                .setSendLiveMetrics(false)
                .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
                .setInternalLogging(false, false)
                .start();
            
            // クライアントの設定
            const client = appInsights.defaultClient;
            if (client) {
                client.context.tags[client.context.keys.cloudRole] = 'pm-exam-dx-web';
                client.context.tags[client.context.keys.cloudRoleInstance] = process.env.WEBSITE_INSTANCE_ID || 'local';
                client.config.samplingPercentage = 100;
            }
            
            console.log('[AppInsights Preload] SDK initialized successfully');
        }
    } catch (error) {
        console.error('[AppInsights Preload] Failed to initialize SDK:', error);
    }
} else {
    console.warn('[AppInsights Preload] APPLICATIONINSIGHTS_CONNECTION_STRING not set');
}
