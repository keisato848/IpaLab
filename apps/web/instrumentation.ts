/**
 * Next.js Instrumentation Hook
 * 
 * App Service のコードレス監視が基本的なテレメトリを自動収集します。
 * このファイルではカスタムログ出力のために SDK を初期化します。
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // サーバーサイドかつ Node.js ランタイムでのみ実行
    const isServer = typeof window === 'undefined';
    const isEdge = process.env.NEXT_RUNTIME === 'edge';

    if (isServer && !isEdge) {
        const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

        if (connectionString) {
            try {
                const { initAppInsights } = await import('./lib/appinsights');
                initAppInsights();
                console.log('[System] Application Insights SDK initialized');
            } catch (error) {
                console.error('[System] Failed to initialize Application Insights SDK:', error);
            }
        } else {
            console.log('[System] Application Insights skipped: connection string not set');
        }
    }
}
