/**
 * Next.js Instrumentation Hook - 診断モード
 *
 * Application Insights v3 SDK を useAzureMonitor() API で初期化する。
 *
 * 重要: 接続文字列は TELEMETRY_CONNECTION_STRING（カスタム名）から読み取る。
 * Linux App Service の IPA コードレスエージェントは APPLICATIONINSIGHTS_* や
 * APPINSIGHTS_* プレフィックスの環境変数を検出して自動有効化し、
 * 手動 SDK の OpenTelemetry セットアップと競合するため、
 * IPA が認識しない環境変数名を使用している。
 */
export async function register() {
    const runtime = process.env.NEXT_RUNTIME;
    if (runtime === 'edge') return;
    if (typeof window !== 'undefined') return;

    const connectionString = process.env.TELEMETRY_CONNECTION_STRING;
    console.log('[AppInsights] TELEMETRY_CONNECTION_STRING:', connectionString ? `SET (${connectionString.substring(0, 40)}...)` : 'NOT SET');
    console.log('[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING:', process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'SET (IPA trigger!)' : 'NOT SET (good)');

    if (!connectionString) {
        console.warn('[AppInsights] TELEMETRY_CONNECTION_STRING not set, telemetry disabled');
        return;
    }

    try {
        // クラウドロール名を OpenTelemetry 環境変数で設定（useAzureMonitor より前に必要）
        if (!process.env.OTEL_SERVICE_NAME) {
            process.env.OTEL_SERVICE_NAME = 'pm-exam-dx-web';
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appInsightsModule = await import('applicationinsights') as any;
        const appInsights = (appInsightsModule.default ?? appInsightsModule) as typeof import('applicationinsights');

        console.log('[AppInsights] Module loaded. useAzureMonitor:', typeof appInsights.useAzureMonitor);

        const otelApi = await import('@opentelemetry/api');

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

        // DiagConsoleLogger で SDK 内部エラーを出力
        otelApi.diag.setLogger(
            new otelApi.DiagConsoleLogger(),
            otelApi.DiagLogLevel.WARN,
        );
        console.log('[AppInsights] DiagConsoleLogger set (WARN level)');

        console.log('[AppInsights] SDK initialized. Monitoring export errors...');
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
