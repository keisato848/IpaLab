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

        // console.log('Application Insights started');
    }
}
