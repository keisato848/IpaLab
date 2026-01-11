
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initAppInsights } = await import('./lib/appinsights');
        initAppInsights();
    }
}
