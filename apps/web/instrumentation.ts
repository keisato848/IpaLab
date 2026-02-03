
export async function register() {
    // Next.js instrumentation hook は nodejs と edge の両方のランタイムで呼び出される
    // applicationinsights パッケージは Node.js 専用なので、nodejs ランタイムでのみインポート
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const isEnabled = process.env.START_APP_INSIGHTS === 'true';
        
        if (isEnabled) {
            // 動的インポートでNode.js専用モジュールを遅延ロード
            const { initAppInsights } = await import('./lib/appinsights');
            initAppInsights();
            console.log('[System] Application Insights initialized (server-side).');
        } else {
            console.log('[System] Application Insights skipped (START_APP_INSIGHTS:', process.env.START_APP_INSIGHTS, ')');
        }
    }
    // edge ランタイムでは何もしない（Node.js専用モジュールを含めない）
}
