/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@ipa-lab/shared"],
    output: 'standalone',
    reactStrictMode: true,
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
