/**
 * Next.js Instrumentation Hook
 *
 * Application Insights v3 SDK を useAzureMonitor() API で初期化する。
 * コードレスエージェント（IPA）は CI/CD で無効化済みのため、
 * このファイルのみがテレメトリを送信する。
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
        // クラウドロール名を OpenTelemetry 環境変数で設定（useAzureMonitor より前に必要）
        if (!process.env.OTEL_SERVICE_NAME) {
            process.env.OTEL_SERVICE_NAME = 'pm-exam-dx-web';
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appInsightsModule = await import('applicationinsights') as any;
        const appInsights = (appInsightsModule.default ?? appInsightsModule) as typeof import('applicationinsights');

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

        console.log('[AppInsights] SDK initialized (useAzureMonitor v3 API)');
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
