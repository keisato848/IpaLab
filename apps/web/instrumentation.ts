
export async function register() {
    // Only run in Node.js runtime and when explicitly enabled
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.START_APP_INSIGHTS === 'true') {
        // eslint-disable-next-line no-console
        console.log('[System] Registering instrumentation (async)...');

        // DO NOT AWAIT - Fire and forget to prevent blocking startup
        import('./lib/appinsights')
            .then(({ initAppInsights }) => {
                const client = initAppInsights();
                if (client) {
                    console.log('[System] App Insights initialized successfully.');
                }
            })
            .catch((err) => {
                console.error('[System] Failed to initialize App Insights:', err);
            });
    }
}
