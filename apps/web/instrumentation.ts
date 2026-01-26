
export async function register() {
    // Only run in Node.js runtime and when explicitly enabled
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.START_APP_INSIGHTS === 'true') {
        // eslint-disable-next-line no-console
        console.log('[System] Registering instrumentation (async)...');

        // 修正: awaitを削除し、完全に非同期で実行する
        import('./lib/appinsights')
            .then(({ initAppInsights }) => {
                initAppInsights();
            })
            .catch((err) => {
                console.error('[System] Failed to initialize App Insights:', err);
            });
    }
}
