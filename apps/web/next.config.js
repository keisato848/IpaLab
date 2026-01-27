/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@ipa-lab/shared"],
    // Note: standalone mode removed - using Azure SWA native Next.js support instead
    // output: 'standalone',
    reactStrictMode: true,
    experimental: {
        serverComponentsExternalPackages: [
            'applicationinsights',
            '@azure/cosmos',
            '@azure/monitor-opentelemetry',
            '@opentelemetry/instrumentation',
        ],
    },
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
