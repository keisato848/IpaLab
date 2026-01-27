
export async function register() {
    // Only run in Node.js runtime and when explicitly enabled
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.START_APP_INSIGHTS === 'true') {
        // バックグラウンドで実行（awaitなし）- スタートアップをブロックしない
        import('./lib/appinsights')
            .then(({ initAppInsights }) => {
                initAppInsights();
                console.log('[System] Application Insights initialized.');
            })
            .catch((err) => console.error('[System] App Insights init failed:', err));
    } else {
        console.log('[System] Application Insights skipped (NEXT_RUNTIME:', process.env.NEXT_RUNTIME, ', START_APP_INSIGHTS:', process.env.START_APP_INSIGHTS, ')');
    }
}
