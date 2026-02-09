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
    // NEXT_RUNTIME が 'nodejs' または undefined の場合にのみ実行（Edge runtime を除外）
    const runtime = process.env.NEXT_RUNTIME;

    if (runtime === 'edge') {
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
        // 診断ログレベルを設定（SDK 内部のエラー・警告をログストリームで確認可能にする）
        if (!process.env.APPLICATIONINSIGHTS_INSTRUMENTATION_LOGGING_LEVEL) {
            process.env.APPLICATIONINSIGHTS_INSTRUMENTATION_LOGGING_LEVEL = 'WARN';
        }

        // クラウドロール名を OpenTelemetry 環境変数で設定
        // useAzureMonitor() 呼び出し前に設定する必要がある
        if (!process.env.OTEL_SERVICE_NAME) {
            process.env.OTEL_SERVICE_NAME = 'pm-exam-dx-web';
        }
        if (!process.env.OTEL_RESOURCE_ATTRIBUTES) {
            process.env.OTEL_RESOURCE_ATTRIBUTES =
                `service.instance.id=${process.env.WEBSITE_INSTANCE_ID || 'local'}`;
        }

        // Application Insights SDK を動的にインポート
        // applicationinsights は CommonJS モジュールのため、バンドラによって
        // import() の返り値の構造が異なる（Webpack: module直接, Turbopack: .default経由）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appInsightsModule = await import('applicationinsights') as any;
        const appInsights = (appInsightsModule.default ?? appInsightsModule) as typeof import('applicationinsights');

        // v3 推奨 API を直接使用
        // v2 互換の setup().start() は TelemetryClient.initialize() 内で
        // useAzureMonitor() のエラーを catch して diag.error() にしか出力しないため、
        // 初期化失敗時も "SDK initialized successfully" と誤表示される問題があった
        appInsights.useAzureMonitor({
            azureMonitorExporterOptions: {
                connectionString,
            },
            // console は applicationinsights の InstrumentationOptions に定義されているが、
            // 型の継承チェーンで DistroInstrumentationOptions として解決されるため型エラーになる
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
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
