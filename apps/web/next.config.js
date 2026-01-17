/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@ipa-lab/shared"],
    output: 'standalone',
    experimental: {
        outputFileTracingIncludes: {
            '/**/*': ['./data/**/*'],
        },
    },
    reactStrictMode: true,
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
