
export async function register() {
    // Debug: Temporarily disabled to rule out startup hang issues
    /*
    // Only run in Node.js runtime and when explicitly enabled
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.START_APP_INSIGHTS === 'true') {
        // await を削除し、バックグラウンドで実行
        import('./lib/appinsights')
            .then(({ initAppInsights }) => {
                initAppInsights();
            })
            .catch((err) => console.error('App Insights init failed:', err));
    }
    */
    console.log('[System] Instrumentation skipped for debugging.');
}
