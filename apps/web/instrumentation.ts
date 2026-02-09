/**
 * Next.js Instrumentation Hook
 *
 * Linux App Service では Node.js のコードレス監視（Codeless Monitoring）が
 * 利用できないため、Application Insights SDK を手動で初期化します。
 *
 * applicationinsights v3 では内部的に OpenTelemetry を使用しており、
 * v3 推奨の useAzureMonitor() API を直接使用します。
 *
 * 注意: v2 互換の setup().start() API は TelemetryClient.initialize() 内で
 * エラーを握りつぶすため、初期化失敗を検知できない問題がありました。
 *
 * @see https://learn.microsoft.com/azure/azure-monitor/app/nodejs
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // Node.js ランタイムでのみ Application Insights を初期化
    const runtime = process.env.NEXT_RUNTIME;

    if (runtime === 'edge') {
        return;
    }

    if (typeof window !== 'undefined') {
        return;
    }

    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (!connectionString) {
        console.warn('[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set, telemetry disabled');
        return;
    }

    try {
        // OpenTelemetry 診断ログを有効化（SDK 内部のエクスポート状況を確認）
        const otelApi = await import('@opentelemetry/api');
        otelApi.diag.setLogger(
            new otelApi.DiagConsoleLogger(),
            otelApi.DiagLogLevel.DEBUG,
        );
        console.log('[AppInsights] OpenTelemetry diagnostic logging enabled (DEBUG)');

        // クラウドロール名を OpenTelemetry 環境変数で設定
        if (!process.env.OTEL_SERVICE_NAME) {
            process.env.OTEL_SERVICE_NAME = 'pm-exam-dx-web';
        }
        if (!process.env.OTEL_RESOURCE_ATTRIBUTES) {
            process.env.OTEL_RESOURCE_ATTRIBUTES =
                `service.instance.id=${process.env.WEBSITE_INSTANCE_ID || 'local'}`;
        }

        // Application Insights SDK を動的にインポート
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appInsightsModule = await import('applicationinsights') as any;
        const appInsights = (appInsightsModule.default ?? appInsightsModule) as typeof import('applicationinsights');

        // v3 推奨 API を直接使用
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

        console.log('[AppInsights] SDK initialized successfully (v3 useAzureMonitor API)');
        console.log('[AppInsights] Connection string prefix:', connectionString.substring(0, 50) + '...');
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
