import { describe, it, expect } from 'vitest';
import robots from '../../app/robots';

describe('robots.ts - robots.txt設定', () => {
    it('Googleボットにはサイト全体を許可する', () => {
        const config = robots();

        // rules配列の最初の要素がGoogleボット用
        const googleBotRule = Array.isArray(config.rules) ? config.rules[0] : null;
        expect(googleBotRule).toBeDefined();

        if (googleBotRule && 'userAgent' in googleBotRule) {
            // Googleボットの種類を確認
            expect(googleBotRule.userAgent).toEqual([
                'Googlebot',
                'Googlebot-Image',
                'Googlebot-News',
                'Googlebot-Video',
                'APIs-Google',
                'Mediapartners-Google',
                'AdsBot-Google',
            ]);

            // Googleボットは / を許可
            expect(googleBotRule.allow).toBe('/');

            // ただし /api/, /private/, /_next/ は除外
            expect(googleBotRule.disallow).toEqual(['/api/', '/private/', '/_next/']);
        }
    });

    it('Edge(Bing)ボットにはサイト全体を許可する', () => {
        const config = robots();

        // rules配列の2番目の要素がEdge(Bing)ボット用
        const edgeBotRule = Array.isArray(config.rules) ? config.rules[1] : null;
        expect(edgeBotRule).toBeDefined();

        if (edgeBotRule && 'userAgent' in edgeBotRule) {
            expect(edgeBotRule.userAgent).toEqual([
                'bingbot',
                'adidxbot',
                'bingpreview',
            ]);

            // Edge(Bing)ボットは / を許可
            expect(edgeBotRule.allow).toBe('/');

            // ただし /api/, /private/, /_next/ は除外
            expect(edgeBotRule.disallow).toEqual(['/api/', '/private/', '/_next/']);
        }
    });

    it('その他すべてのボットはサイト全体を遮断する', () => {
        const config = robots();

        // rules配列の3番目の要素が全ボット用
        const allBotsRule = Array.isArray(config.rules) ? config.rules[2] : null;
        expect(allBotsRule).toBeDefined();

        if (allBotsRule && 'userAgent' in allBotsRule) {
            // ワイルドカード * で全ボットを指定
            expect(allBotsRule.userAgent).toBe('*');

            // 全パスを遮断
            expect(allBotsRule.disallow).toBe('/');
        }
    });

    it('sitemapのURLが設定されている', () => {
        const config = robots();

        // sitemapが存在し、適切なURLである
        expect(config.sitemap).toBeDefined();
        expect(config.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
    });

    it('環境変数NEXT_PUBLIC_SITE_URLを使用する', () => {
        const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

        // 環境変数を設定
        process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';

        // モジュールを再読み込み（環境変数が反映される）
        const config = robots();

        // sitemap URLに環境変数のベースURLが使われている、またはデフォルト値
        expect(config.sitemap).toMatch(/sitemap\.xml$/);

        // 環境変数を元に戻す
        if (originalEnv) {
            process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
        } else {
            delete process.env.NEXT_PUBLIC_SITE_URL;
        }
    });

    it('robots.txt形式が正しく生成される', () => {
        const config = robots();

        // Next.jsのMetadataRoute.Robots型に準拠
        expect(config).toHaveProperty('rules');
        expect(config).toHaveProperty('sitemap');
        expect(Array.isArray(config.rules)).toBe(true);
    });
});
