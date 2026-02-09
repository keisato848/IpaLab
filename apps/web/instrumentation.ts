/**
 * Next.js Instrumentation Hook - 診断モード
 *
 * テレメトリが Application Insights に到達しない問題を調査するため、
 * 手動送信テスト＋明示的フラッシュ＋詳細診断ログを実装。
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
        // クラウドロール名を OpenTelemetry 環境変数で設定
        if (!process.env.OTEL_SERVICE_NAME) {
            process.env.OTEL_SERVICE_NAME = 'pm-exam-dx-web';
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appInsightsModule = await import('applicationinsights') as any;
        const appInsights = (appInsightsModule.default ?? appInsightsModule) as typeof import('applicationinsights');

        console.log('[AppInsights] Module loaded. Available exports:', Object.keys(appInsightsModule).join(', '));
        console.log('[AppInsights] useAzureMonitor type:', typeof appInsights.useAzureMonitor);
        console.log('[AppInsights] TelemetryClient type:', typeof appInsights.TelemetryClient);

        // useAzureMonitor を呼び出す
        appInsights.useAzureMonitor({
            azureMonitorExporterOptions: {
                connectionString,
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
        console.log('[AppInsights] useAzureMonitor() completed');

        // useAzureMonitor() 後に DiagConsoleLogger を設定（上書き対策）
        const otelApi = await import('@opentelemetry/api');
        otelApi.diag.setLogger(
            new otelApi.DiagConsoleLogger(),
            otelApi.DiagLogLevel.DEBUG,
        );
        console.log('[AppInsights] DiagConsoleLogger set AFTER useAzureMonitor');

        // 手動でテストトレースを送信
        const client = new appInsights.TelemetryClient(connectionString);
        console.log('[AppInsights] TelemetryClient created');

        client.trackTrace({
            message: '[TEST] AppInsights instrumentation diagnostic test trace',
            severity: 'Information' as any,
        });
        console.log('[AppInsights] Test trace tracked');

        client.trackEvent({
            name: 'AppInsights_DiagnosticTest',
            properties: {
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                nextRuntime: runtime || 'nodejs',
            },
        });
        console.log('[AppInsights] Test event tracked');

        // 明示的にフラッシュ（バッチ送信を待たずに即時送信）
        try {
            await client.flush();
            console.log('[AppInsights] Client flush completed');
        } catch (flushError) {
            console.error('[AppInsights] Client flush FAILED:', flushError);
        }

        // グローバルフラッシュも試行
        try {
            await appInsights.flushAzureMonitor();
            console.log('[AppInsights] Global flushAzureMonitor completed');
        } catch (globalFlushError) {
            console.error('[AppInsights] Global flush FAILED:', globalFlushError);
        }

        console.log('[AppInsights] SDK initialized + test telemetry sent');
        console.log('[AppInsights] CS prefix:', connectionString.substring(0, 50) + '...');
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
