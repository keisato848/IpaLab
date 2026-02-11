const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    // App Service deployment requires standalone mode
    output: 'standalone',
    // monorepo: trace files from the root (moved out of experimental in Next.js 15)
    outputFileTracingRoot: path.join(__dirname, '../../'),
    transpilePackages: ["@ipa-lab/shared"],
    reactStrictMode: true,
    // Next.js 15: serverComponentsExternalPackages renamed to serverExternalPackages
    serverExternalPackages: [
        '@azure/cosmos',
        '@azure/identity',
        // Application Insights v3 SDK + 全依存パッケージ
        // Webpack バンドルによる OpenTelemetry グローバルレジストリ分離を防止
        'applicationinsights',
        '@azure/monitor-opentelemetry',
        '@azure/monitor-opentelemetry-exporter',
        '@azure/opentelemetry-instrumentation-azure-sdk',
        '@opentelemetry/api',
        '@opentelemetry/api-logs',
        '@opentelemetry/core',
        '@opentelemetry/exporter-logs-otlp-http',
        '@opentelemetry/exporter-metrics-otlp-http',
        '@opentelemetry/exporter-metrics-otlp-proto',
        '@opentelemetry/exporter-trace-otlp-http',
        '@opentelemetry/instrumentation',
        '@opentelemetry/instrumentation-http',
        '@opentelemetry/otlp-exporter-base',
        '@opentelemetry/resources',
        '@opentelemetry/sdk-logs',
        '@opentelemetry/sdk-metrics',
        '@opentelemetry/sdk-node',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-trace-node',
        '@opentelemetry/semantic-conventions',
        'diagnostic-channel',
        'diagnostic-channel-publishers',
        'import-in-the-middle',
        'require-in-the-middle',
    ],
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com', // Google
            },
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com', // GitHub
            },
        ],
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
