
export async function register() {
    // Debug: Temporarily disabled to rule out startup hang issues
    /*
    // Only run in Node.js runtime and when explicitly enabled
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.START_APP_INSIGHTS === 'true') {
        // eslint-disable-next-line no-console
        console.log('[System] Registering instrumentation...');
        const { initAppInsights } = await import('./lib/appinsights');
        initAppInsights();
    }
    */
    console.log('[System] Instrumentation skipped for debugging.');
}
