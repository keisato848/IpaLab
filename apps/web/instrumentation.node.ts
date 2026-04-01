/**
 * Node.js ランタイム専用の Application Insights 初期化
 *
 * instrumentation.ts から NEXT_RUNTIME === 'nodejs' の場合のみ呼び出される。
 * このファイルは Edge ランタイムではインポートされないため、
 * @grpc/grpc-js 等の Node.js 固有モジュールを安全に使用できる。
 *
 * Application Insights v3 SDK を useAzureMonitor() API で初期化する。
 *
 * 認証方式: AAD認証（マネージドID）
 * - APPI リソース `appi-pm-exam-dx` は DisableLocalAuth=true のため、
 *   Instrumentation Key / 接続文字列だけでは 401 になる。
 * - ManagedIdentityCredential を使用してテレメトリを送信する。
 *
 * 接続文字列: TELEMETRY_CONNECTION_STRING（カスタム名）から読み取る。
 * Linux App Service の IPA コードレスエージェントは APPLICATIONINSIGHTS_* や
 * APPINSIGHTS_* プレフィックスの環境変数を検出して自動有効化し、
 * 手動 SDK の OpenTelemetry セットアップと競合するため、
 * IPA が認識しない環境変数名を使用している。
 */
export async function registerNodeInstrumentation() {
    const connectionString = process.env.TELEMETRY_CONNECTION_STRING;
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

        // AAD認証: ManagedIdentityCredential を使用
        // APPI リソースの DisableLocalAuth=true に対応
        const { ManagedIdentityCredential } = await import('@azure/identity');
        const credential = new ManagedIdentityCredential();

        appInsights.useAzureMonitor({
            azureMonitorExporterOptions: {
                connectionString,
                credential,
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

        console.log('[AppInsights] SDK initialized (useAzureMonitor v3 + AAD auth)');
    } catch (error) {
        console.error('[AppInsights] Failed to initialize SDK:', error);
    }
}
