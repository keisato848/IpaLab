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
        'applicationinsights',
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
