/**
 * Next.js Instrumentation Hook - 診断モード
 *
 * テレメトリがディスクキャッシュにフォールバックし Application Insights に
 * 到達しない問題を調査。disableOfflineStorage=true で送信エラーを可視化。
 */
export async function register() {
    const runtime = process.env.NEXT_RUNTIME;
    if (runtime === 'edge') return;
    if (typeof window !== 'undefined') return;

    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!connectionString) {
        console.warn('[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set, telemetry disabled');
        return;
    }

    try {
        if (!process.env.OTEL_SERVICE_NAME) {
            process.env.OTEL_SERVICE_NAME = 'pm-exam-dx-web';
        }

        // 接続文字列からインジェストエンドポイントを抽出してログ出力
        const ingestionMatch = connectionString.match(/IngestionEndpoint=([^;]+)/);
        const ikeyMatch = connectionString.match(/InstrumentationKey=([^;]+)/);
        console.log('[AppInsights] InstrumentationKey:', ikeyMatch?.[1]?.substring(0, 8) + '...');
        console.log('[AppInsights] IngestionEndpoint:', ingestionMatch?.[1] || 'NOT FOUND');

        // インジェストエンドポイントへの接続テスト
        if (ingestionMatch?.[1]) {
            try {
                const https = await import('https');
                const testUrl = ingestionMatch[1].replace(/\/$/, '') + '/v2/track';
                console.log('[AppInsights] Testing connectivity to:', testUrl);
                await new Promise<void>((resolve) => {
                    const req = https.request(testUrl, { method: 'POST', timeout: 5000 }, (res) => {
                        console.log('[AppInsights] Ingestion endpoint responded:', res.statusCode, res.statusMessage);
                        resolve();
                    });
                    req.on('error', (err: Error) => {
                        console.error('[AppInsights] Ingestion endpoint UNREACHABLE:', err.message);
                        resolve();
                    });
                    req.on('timeout', () => {
                        console.error('[AppInsights] Ingestion endpoint TIMEOUT (5s)');
                        req.destroy();
                        resolve();
                    });
                    req.end('[]');
                });
            } catch (testErr) {
                console.error('[AppInsights] Connectivity test error:', testErr);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appInsightsModule = await import('applicationinsights') as any;
        const appInsights = (appInsightsModule.default ?? appInsightsModule) as typeof import('applicationinsights');

        // useAzureMonitor() 後に DiagConsoleLogger を設定するため先にインポート
        const otelApi = await import('@opentelemetry/api');

        // disableOfflineStorage=true でディスクフォールバックを無効化
        // → 送信失敗時にエラーが DiagConsoleLogger に出力される
        appInsights.useAzureMonitor({
            azureMonitorExporterOptions: {
                connectionString,
                disableOfflineStorage: true,
            },
            instrumentationOptions: {
                http: { enabled: true },
                console: { enabled: true },
                azureSdk: { enabled: true },
            } as import('applicationinsights').InstrumentationOptions,
            enableAutoCollectExceptions: true,
            enableAutoCollectPerformance: true,
            enableLiveMetrics: false,
        });
        console.log('[AppInsights] useAzureMonitor() completed (offlineStorage DISABLED)');

        // useAzureMonitor() 後に DiagConsoleLogger を設定（上書き対策）
        otelApi.diag.setLogger(
            new otelApi.DiagConsoleLogger(),
            otelApi.DiagLogLevel.DEBUG,
        );
        console.log('[AppInsights] DiagConsoleLogger set (DEBUG level)');

        console.log('[AppInsights] SDK initialized. Waiting for export errors in log stream...');
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
