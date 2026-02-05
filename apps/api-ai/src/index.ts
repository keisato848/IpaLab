/**
 * Azure Functions エントリーポイント
 *
 * Application Insights SDK は HTTP モジュールをモンキーパッチするため、
 * 他のモジュールがロードされる前に初期化する必要があります。
 */

// Application Insights SDK を最初に初期化
import * as appInsights from 'applicationinsights';

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
if (connectionString) {
    appInsights.setup(connectionString)
        .setAutoCollectRequests(true)           // HTTP リクエストを自動収集
        .setAutoCollectPerformance(true, true)  // パフォーマンスメトリクスを収集
        .setAutoCollectExceptions(true)         // 未処理例外を収集
        .setAutoCollectDependencies(true)       // 外部依存関係（DB、HTTP等）を収集
        .setAutoCollectConsole(true, true)      // console.log/warn/error を収集
        .setUseDiskRetryCaching(true)           // 一時的な障害時のディスクキャッシュ
        .setSendLiveMetrics(false)              // Live Metrics は無効（コスト考慮）
        .start();
    console.log('[AppInsights] SDK initialized');
} else {
    console.warn('[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set, telemetry disabled');
}

// 関数のインポート（SDK初期化後）
import './functions/aiPlan';
