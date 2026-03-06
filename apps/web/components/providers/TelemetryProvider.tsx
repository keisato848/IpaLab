'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ApplicationInsights, type ITelemetryItem } from '@microsoft/applicationinsights-web';

declare global {
    interface Window {
        __APPINSIGHTS_CONNECTION_STRING__?: string;
    }
}

export let appInsights: ApplicationInsights | null = null;
export const reactPlugin = null;

function getInitialConnectionString(connectionString?: string) {
    if (connectionString) return connectionString;
    if (typeof window !== 'undefined') {
        return window.__APPINSIGHTS_CONNECTION_STRING__ || '';
    }
    return '';
}

function initializeAppInsights(connectionString: string) {
    if (appInsights) {
        return appInsights;
    }

    const instance = new ApplicationInsights({
        config: {
            connectionString,
            enableAutoRouteTracking: true,
            autoTrackPageVisitTime: true,
            enableCorsCorrelation: true,
        },
    });

    instance.addTelemetryInitializer((item: ITelemetryItem) => {
        const tags = ((item.tags as Record<string, string> | undefined) ?? {});
        tags['ai.cloud.role'] = 'pm-exam-dx-web-client';
        tags['ai.cloud.roleInstance'] = window.location.host;
        item.tags = tags as ITelemetryItem['tags'];
    });

    instance.loadAppInsights();
    instance.trackPageView({ uri: window.location.href });
    appInsights = instance;

    return instance;
}

/**
 * TelemetryProvider
 *
 * Microsoft Learn の JavaScript SDK ガイダンスに従い、
 * @microsoft/applicationinsights-web をクライアントで初期化する。
 * - enableAutoRouteTracking: SPA のルート変更を自動追跡
 * - setAuthenticatedUserContext(): サインイン済みユーザーを識別
 * - /api/config/telemetry: SWA/App Service のランタイム環境変数を取得
 */
export function TelemetryProvider({
    children,
    connectionString,
}: {
    children: React.ReactNode;
    connectionString?: string;
}) {
    const { data: session, status } = useSession();
    const [resolvedConnectionString, setResolvedConnectionString] = useState(() => getInitialConnectionString(connectionString));

    useEffect(() => {
        if (resolvedConnectionString || typeof window === 'undefined') {
            return;
        }

        let cancelled = false;

        fetch('/api/config/telemetry', {
            cache: 'no-store',
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                const nextConnectionString = typeof data?.connectionString === 'string'
                    ? data.connectionString
                    : '';

                if (!cancelled && nextConnectionString) {
                    window.__APPINSIGHTS_CONNECTION_STRING__ = nextConnectionString;
                    setResolvedConnectionString(nextConnectionString);
                }
            })
            .catch(() => {
                // テレメトリ初期化失敗は UI に影響させない
            });

        return () => {
            cancelled = true;
        };
    }, [resolvedConnectionString]);

    useEffect(() => {
        if (!resolvedConnectionString) {
            return;
        }

        initializeAppInsights(resolvedConnectionString);
    }, [resolvedConnectionString]);

    useEffect(() => {
        if (!appInsights || status === 'loading') {
            return;
        }

        const userId = session?.user?.id;
        if (userId) {
            appInsights.setAuthenticatedUserContext(userId);
            return;
        }

        appInsights.clearAuthenticatedUserContext();
    }, [session?.user?.id, status]);

    return <>{children}</>;
}
