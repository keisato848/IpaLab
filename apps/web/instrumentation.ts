/**
 * Next.js Instrumentation Hook
 * 
 * App Service のコードレス監視（Codeless Monitoring）が
 * 基本的なテレメトリを自動収集するため、SDK の手動初期化は不要です。
 * 
 * Azure App Service は APPLICATIONINSIGHTS_CONNECTION_STRING が設定されていると
 * 自動的に Application Insights エージェントを注入し、以下を収集します：
 * - HTTP リクエスト/レスポンス
 * - 依存関係の呼び出し
 * - 例外
 * - パフォーマンスカウンター
 * 
 * @see https://learn.microsoft.com/azure/azure-monitor/app/codeless-overview
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // App Service コードレス監視を使用するため、手動でのSDK初期化は行わない
    // 必要に応じてカスタムテレメトリを追加する場合のみこのファイルを使用
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
        console.log('[System] App Service Codeless Monitoring enabled');
    }
}
