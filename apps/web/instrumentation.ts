/**
 * Next.js Instrumentation Hook
 * 
 * Linux App Service では Node.js のコードレス監視（Codeless Monitoring）が
 * 利用できないため、Application Insights SDK を手動で初期化します。
 * 
 * 重要: Application Insights SDK は HTTP モジュールをモンキーパッチするため、
 * 他のモジュールがロードされる前に初期化する必要があります。
 * 
 * @see https://learn.microsoft.com/azure/azure-monitor/app/nodejs
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // Node.js ランタイムでのみ Application Insights を初期化
    // NEXT_RUNTIME が 'nodejs' または undefined の場合にのみ実行（Edge runtime を除外）
    const runtime = process.env.NEXT_RUNTIME;
    
    if (runtime === 'edge') {
        // Edge runtime では Application Insights SDK は使用不可
        return;
    }
    
    // サーバーサイドでのみ初期化
    if (typeof window !== 'undefined') {
        return;
    }
    
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    
    if (!connectionString) {
        console.warn('[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set, telemetry disabled');
        return;
    }
    
    try {
        // Application Insights SDK を動的にインポート
        const appInsights = await import('applicationinsights');
        
        // SDK が既に初期化されているかチェック
        if (appInsights.defaultClient) {
            console.log('[AppInsights] SDK already initialized, skipping');
            return;
        }
        
        appInsights.default
            .setup(connectionString)
            .setAutoCollectRequests(true)           // HTTP リクエストを自動収集
            .setAutoCollectPerformance(true, true)  // パフォーマンスメトリクスを収集
            .setAutoCollectExceptions(true)         // 未処理例外を収集
            .setAutoCollectDependencies(true)       // 外部依存関係（DB、HTTP等）を収集
            .setAutoCollectConsole(true, true)      // console.log/warn/error を収集
            .setAutoCollectPreAggregatedMetrics(true) // 事前集計メトリクス
            .setUseDiskRetryCaching(true)           // 一時的な障害時のディスクキャッシュ
            .setSendLiveMetrics(false)              // Live Metrics は無効（コスト考慮）
            .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
            .setInternalLogging(false, false)       // 内部ログは無効化
            .start();
        
        console.log('[AppInsights] SDK initialized successfully');
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
