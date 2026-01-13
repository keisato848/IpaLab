
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // eslint-disable-next-line no-console
        console.log('[System] Registering instrumentation...');
        const { initAppInsights } = await import('./lib/appinsights');
        initAppInsights();
    }
}
