import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 許可する公式クローラーのユーザーエージェントパターン
 * SEO維持のためGoogleとEdge(Bing)のクローラーは許可する
 */
const ALLOWED_BOTS = [
    // Google系
    'Googlebot',            // Google検索クローラー
    'Googlebot-Image',      // Google画像検索
    'Googlebot-News',       // Googleニュース
    'Googlebot-Video',      // Google動画検索
    'APIs-Google',          // Google APIs
    'Mediapartners-Google', // Google AdSense
    'AdsBot-Google',        // Google広告
    // Edge(Bing)系
    'bingbot',              // Bing検索クローラー
    'adidxbot',             // Microsoft広告クローラー
    'bingpreview',          // Bingプレビュー
];

/**
 * ボットと判定するユーザーエージェントパターン
 */
const BOT_PATTERNS = [
    'bot',
    'crawl',
    'spider',
    'scrape',
    'slurp',
    'fetch',
];

/**
 * ユーザーエージェントが許可済みボットかどうかを判定
 */
function isAllowedBot(userAgent: string): boolean {
    if (!userAgent) return false;

    const lowerUA = userAgent.toLowerCase();
    return ALLOWED_BOTS.some(bot =>
        lowerUA.includes(bot.toLowerCase())
    );
}

/**
 * ユーザーエージェントがボットかどうかを判定
 */
function isBot(userAgent: string): boolean {
    if (!userAgent) return false;

    const lowerUA = userAgent.toLowerCase();
    return BOT_PATTERNS.some(pattern =>
        lowerUA.includes(pattern)
    );
}

/**
 * Middlewareメイン処理
 * Google以外のボットをブロックする
 */
export function middleware(request: NextRequest) {
    const userAgent = request.headers.get('user-agent') || '';

    // 許可対象の公式クローラーは通過させる
    if (isAllowedBot(userAgent)) {
        return NextResponse.next();
    }

    // ボットと判定された場合は403 Forbiddenを返す
    if (isBot(userAgent)) {
        return new NextResponse('Forbidden: Bot access is not allowed', {
            status: 403,
            headers: {
                'Content-Type': 'text/plain',
            },
        });
    }

    // 通常のユーザーはそのまま通す
    return NextResponse.next();
}

/**
 * Middleware設定
 * すべてのパスに適用（Next.jsの内部パスは除外）
 */
export const config = {
    matcher: [
        /*
         * 以下を除くすべてのリクエストパスにマッチ:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
