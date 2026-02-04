const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    // App Service deployment requires standalone mode
    output: 'standalone',
    transpilePackages: ["@ipa-lab/shared"],
    reactStrictMode: true,
    experimental: {
        instrumentationHook: true,
        // monorepo: trace files from the root (must be in experimental for Next.js 14)
        outputFileTracingRoot: path.join(__dirname, '../../'),
        serverComponentsExternalPackages: [
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
