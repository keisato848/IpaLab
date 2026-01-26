
export async function register() {
    // Only run in Node.js runtime and when explicitly enabled
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.START_APP_INSIGHTS === 'true') {
        // eslint-disable-next-line no-console
        console.log('[System] Registering instrumentation (background)...');

        // CRITICAL FIX: Do NOT use 'await' here. It blocks the server startup (Warm up).
        // Use import().then() to load asynchronously in the background.
        import('./lib/appinsights')
            .then(({ initAppInsights }) => {
                initAppInsights();
                // eslint-disable-next-line no-console
                console.log('[System] App Insights initialized');
            })
            .catch((err) => {
                console.error('[System] Failed to initialize App Insights:', err);
            });
    }
}
