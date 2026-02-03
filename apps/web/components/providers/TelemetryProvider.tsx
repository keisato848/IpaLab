'use client';

import React, { useEffect, useState } from 'react';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

// グローバル型定義（ランタイム環境変数用）
declare global {
    interface Window {
        __APPINSIGHTS_CONNECTION_STRING__?: string;
    }
}

let reactPlugin: ReactPlugin | null = null;
let appInsights: ApplicationInsights | null = null;

/**
 * Application Insights を初期化する
 */
function initializeAppInsights(connectionString: string): void {
    if (appInsights) return; // 既に初期化済み
    
    reactPlugin = new ReactPlugin();
    appInsights = new ApplicationInsights({
        config: {
            connectionString: connectionString,
            extensions: [reactPlugin as any],
            enableAutoRouteTracking: true,    // ページビュー追跡
            enableCorsCorrelation: true,      // CORS相関
            enableRequestHeaderTracking: true, // リクエストヘッダー追跡
            enableResponseHeaderTracking: true, // レスポンスヘッダー追跡
            disableFetchTracking: false,      // Fetch API 追跡を有効化
            enableAjaxPerfTracking: true,     // AJAX パフォーマンス追跡
        }
    });
    appInsights.loadAppInsights();
    // eslint-disable-next-line no-console
    console.log('[System] Client-side Application Insights started');
}

export function TelemetryProvider({
    children,
    connectionString: propsConnectionString
}: {
    children: React.ReactNode;
    connectionString?: string;
}) {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || initialized || appInsights) return;

        // 優先順位で接続文字列を取得
        // 1. window グローバル変数（layout.tsx で埋め込み）
        // 2. props（Server Component から渡された値）
        const windowValue = window.__APPINSIGHTS_CONNECTION_STRING__;
        const immediateConnectionString = windowValue || propsConnectionString;
        
        if (immediateConnectionString) {
            initializeAppInsights(immediateConnectionString);
            setInitialized(true);
            return;
        }

        // 3. API エンドポイントから取得（SWA ランタイム環境変数対応）
        const fetchConnectionString = async () => {
            try {
                const response = await fetch('/api/config/telemetry');
                if (response.ok) {
                    const data = await response.json();
                    if (data.connectionString) {
                        initializeAppInsights(data.connectionString);
                        setInitialized(true);
                    } else {
                        // eslint-disable-next-line no-console
                        console.warn('[System] Client-side AppInsights skipped: API returned empty connection string');
                    }
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.warn('[System] Client-side AppInsights skipped: Failed to fetch connection string', error);
            }
        };

        fetchConnectionString();
    }, [propsConnectionString, initialized]);

    return <>{children}</>;
}

export { reactPlugin, appInsights };
