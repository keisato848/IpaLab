export async function register() {
    // Next.js instrumentation hook は nodejs と edge の両方のランタイムで呼び出される
    // applicationinsights パッケージは Node.js 専用なので、Node.js 環境でのみ初期化
    
    // Azure SWA 環境では NEXT_RUNTIME が設定されない場合があるため、
    // typeof window で サーバーサイド を検出する方式に変更
    const isServer = typeof window === 'undefined';
    
    // NEXT_RUNTIME が設定されている場合は edge ランタイムを除外
    const isEdge = process.env.NEXT_RUNTIME === 'edge';
    
    if (isServer && !isEdge) {
        const isEnabled = process.env.START_APP_INSIGHTS === 'true';
        const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
        
        if (isEnabled && connectionString) {
            try {
                // 動的インポートでNode.js専用モジュールを遅延ロード
                const { initAppInsights, getAppInsightsClient } = await import('./lib/appinsights');
                
                // preload スクリプトで既に初期化済みの場合はスキップ
                const existingClient = getAppInsightsClient();
                if (!existingClient) {
                    initAppInsights();
                    console.log('[System] Application Insights initialized via instrumentation.ts');
                } else {
                    console.log('[System] Application Insights already initialized (via preload)');
                }
            } catch (error) {
                console.error('[System] Failed to initialize Application Insights:', error);
            }
        } else {
            if (!isEnabled) {
                console.log('[System] Application Insights skipped (START_APP_INSIGHTS:', process.env.START_APP_INSIGHTS, ')');
            }
            if (!connectionString) {
                console.log('[System] Application Insights skipped: connection string not set');
            }
        }
    }
    // edge ランタイムでは何もしない（Node.js専用モジュールを含めない）
}
