import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

describe('Middleware - ボットブロック機能', () => {
    const createRequest = (userAgent: string, url = 'http://localhost:3000/') => {
        return new NextRequest(url, {
            headers: {
                'user-agent': userAgent,
            },
        });
    };

    describe('Googleボットの許可', () => {
        it('Googlebotを許可する', () => {
            const request = createRequest('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Googlebot-Imageを許可する', () => {
            const request = createRequest('Googlebot-Image/1.0');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Googlebot-Newsを許可する', () => {
            const request = createRequest('Googlebot-News');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Googlebot-Videoを許可する', () => {
            const request = createRequest('Googlebot-Video/1.0');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('APIs-Googleを許可する', () => {
            const request = createRequest('APIs-Google (+https://developers.google.com/webmasters/APIs-Google.html)');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Mediapartners-Googleを許可する', () => {
            const request = createRequest('Mediapartners-Google');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('AdsBot-Googleを許可する', () => {
            const request = createRequest('AdsBot-Google (+http://www.google.com/adsbot.html)');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });
    });

    describe('Edge(Bing)ボットの許可', () => {
        it('Bingbotを許可する', () => {
            const request = createRequest('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('AdIdxBotを許可する', () => {
            const request = createRequest('Mozilla/5.0 (compatible; adidxbot/2.0; +http://www.bing.com/bingbot.htm)');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('BingPreviewを許可する', () => {
            const request = createRequest('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingpreview/1.0b) Chrome/79.0.3945.79 Safari/537.36 Edge/79.0.309.68');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });
    });

    describe('許可対象外ボットのブロック', () => {
        it('一般的なbotパターンをブロックする', () => {
            const request = createRequest('SomeBot/1.0');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });

        it('crawlパターンをブロックする', () => {
            const request = createRequest('MyCrawler/1.0');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });

        it('spiderパターンをブロックする', () => {
            const request = createRequest('MySpider/1.0');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });

        it('scrapeパターンをブロックする', () => {
            const request = createRequest('MyScraper/1.0');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });

        it('slurpパターンをブロックする', () => {
            const request = createRequest('Yahoo! Slurp');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });

        it('fetchパターンをブロックする', () => {
            const request = createRequest('DataFetch/2.0');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });

        it('Baiduスパイダーをブロックする', () => {
            const request = createRequest('Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });

        it('Yandexボットをブロックする', () => {
            const request = createRequest('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });
    });

    describe('通常のユーザーの許可', () => {
        it('Chrome on Windowsを許可する', () => {
            const request = createRequest('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Safari on macOSを許可する', () => {
            const request = createRequest('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Firefox on Linuxを許可する', () => {
            const request = createRequest('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Mobile Safari on iOSを許可する', () => {
            const request = createRequest('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Chrome on Androidを許可する', () => {
            const request = createRequest('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('Edge on Windowsを許可する', () => {
            const request = createRequest('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });
    });

    describe('エッジケース', () => {
        it('User-Agentが空の場合は許可する', () => {
            const request = createRequest('');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('User-Agentがない場合は許可する', () => {
            const request = new NextRequest('http://localhost:3000/');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('大文字小文字を区別しない（googlebot）', () => {
            const request = createRequest('googlebot/2.1');
            const response = middleware(request);
            expect(response.status).toBe(200);
        });

        it('大文字小文字を区別しない（BOT）', () => {
            const request = createRequest('MyBOT/1.0');
            const response = middleware(request);
            expect(response.status).toBe(403);
        });
    });

    describe('403レスポンスの内容', () => {
        it('適切なエラーメッセージを返す', () => {
            const request = createRequest('SomeBot/1.0');
            const response = middleware(request);
            expect(response.status).toBe(403);
            expect(response.headers.get('content-type')).toBe('text/plain');
        });
    });
});
