import * as appInsights from 'applicationinsights';

export function initAppInsights() {
    if (
        process.env.APPLICATIONINSIGHTS_CONNECTION_STRING &&
        appInsights.defaultClient === undefined
    ) {
        appInsights
            .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
            .setAutoCollectConsole(true, true)
            .setAutoCollectExceptions(true)
            .setAutoCollectRequests(true)
            .setAutoCollectDependencies(true)
            .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
            .start();

        // eslint-disable-next-line no-console
        console.log('[System] Application Insights started');
    }
}

export function getAppInsightsClient() {
    return appInsights.defaultClient;
}