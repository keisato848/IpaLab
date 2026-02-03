const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    // App Service deployment requires standalone mode
    output: 'standalone',
    // monorepo: trace files from the root
    outputFileTracingRoot: path.join(__dirname, '../../'),
    transpilePackages: ["@ipa-lab/shared"],
    reactStrictMode: true,
    experimental: {
        instrumentationHook: true,
        serverComponentsExternalPackages: [
            'applicationinsights',
            '@azure/cosmos',
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
