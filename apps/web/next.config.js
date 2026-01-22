/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    transpilePackages: ["@ipa-lab/shared"],
    output: 'standalone',
    reactStrictMode: true,
    experimental: {
        outputFileTracingRoot: path.join(__dirname, '../../'),
        outputFileTracingIncludes: {
            // Only include exam data for the exam pages that need it
            '/exam/**/*': ['packages/data/data/questions/**/*'],
        },
    },
    images: {
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
