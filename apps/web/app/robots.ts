
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shikaku-no.com';

    return {
        rules: [
            // Googleボットは全体的に許可（SEO維持）
            {
                userAgent: [
                    'Googlebot',
                    'Googlebot-Image',
                    'Googlebot-News',
                    'Googlebot-Video',
                    'APIs-Google',
                    'Mediapartners-Google',
                    'AdsBot-Google',
                ],
                allow: '/',
                disallow: ['/api/', '/private/', '/_next/'],
            },
            // その他すべてのボットは遮断
            {
                userAgent: '*',
                disallow: '/',
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
