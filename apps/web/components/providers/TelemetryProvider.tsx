'use client';

import React, { useEffect } from 'react';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

let reactPlugin: ReactPlugin | null = null;
let appInsights: ApplicationInsights | null = null;

export function TelemetryProvider({
    children,
    connectionString
}: {
    children: React.ReactNode;
    connectionString?: string;
}) {
    useEffect(() => {
        // Initialize AppInsights only on client side
        if (typeof window !== 'undefined' && !appInsights && connectionString) {

            if (connectionString) {
                reactPlugin = new ReactPlugin();
                appInsights = new ApplicationInsights({
                    config: {
                        connectionString: connectionString,
                        extensions: [reactPlugin],
                        enableAutoRouteTracking: true, // Track page views
                    }
                });
                appInsights.loadAppInsights();
                console.log('[System] Client-side Application Insights started');
            } else {
                console.warn('[System] Client-side AppInsights skipped: Missing Connection String');
            }
        }
    }, []);

    return <>{children}</>;
}

export { reactPlugin, appInsights };
