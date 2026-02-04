'use client';

import React from 'react';

/**
 * TelemetryProvider
 * 
 * App Service のコードレス監視に移行したため、
 * クライアント側の Application Insights SDK は現在無効化されています。
 * 
 * サーバーサイドのテレメトリは App Service が自動収集します。
 * RUM（Real User Monitoring）が必要な場合は、
 * @microsoft/applicationinsights-web を再インストールしてください。
 */
export function TelemetryProvider({
    children,
}: {
    children: React.ReactNode;
    connectionString?: string;
}) {
    return <>{children}</>;
}

// 後方互換性のためのエクスポート（現在は null）
export const reactPlugin = null;
export const appInsights = null;
