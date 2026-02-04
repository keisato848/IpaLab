/**
 * Next.js Instrumentation Hook
 * 
 * Linux App Service では Node.js のコードレス監視（Codeless Monitoring）が
 * 利用できないため、Application Insights SDK を手動で初期化します。
 * 
 * @see https://learn.microsoft.com/azure/azure-monitor/app/nodejs
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // サーバーサイドでのみ Application Insights を初期化
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
        const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
        
        if (connectionString) {
            try {
                // Application Insights SDK を動的にインポート
                const appInsights = await import('applicationinsights');
                
                appInsights.default
                    .setup(connectionString)
                    .setAutoCollectRequests(true)
                    .setAutoCollectPerformance(true, true)
                    .setAutoCollectExceptions(true)
                    .setAutoCollectDependencies(true)
                    .setAutoCollectConsole(true, true)
                    .setUseDiskRetryCaching(true)
                    .setSendLiveMetrics(false)
                    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
                    .start();
                
                console.log('[System] Application Insights SDK initialized successfully');
            } catch (error) {
                console.error('[System] Failed to initialize Application Insights:', error);
            }
        } else {
            console.warn('[System] APPLICATIONINSIGHTS_CONNECTION_STRING not set, telemetry disabled');
        }
    }
}
