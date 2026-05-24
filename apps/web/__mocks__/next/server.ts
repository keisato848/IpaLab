/**
 * next/server の vitest 用モック
 *
 * next/server (Next.js 16+) を require すると Node.js のイベントループに
 * 残存ハンドルが登録され、vitest ワーカーが起動タイムアウトになる問題を回避する。
 * resolve.alias で本ファイルにリダイレクトすることで実際の next/server は読み込まれない。
 */

/** NextRequest: Web Fetch API の Request をベースとしたシンプルな実装 */
export class NextRequest extends Request {
    readonly nextUrl: URL;

    constructor(input: string | URL | Request, init?: RequestInit) {
        const url = input instanceof Request ? input.url : input.toString();
        super(url, init);
        this.nextUrl = new URL(url);
    }
}

/** NextResponse: Web Fetch API の Response をベースとしたシンプルな実装 */
export class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse {
        return new NextResponse(JSON.stringify(body), {
            ...init,
            headers: {
                ...(init?.headers as Record<string, string> | undefined),
                'content-type': 'application/json',
            },
        });
    }

    static redirect(url: string | URL, status = 307): NextResponse {
        return new NextResponse(null, {
            status,
            headers: { location: url.toString() },
        });
    }

    static next(): NextResponse {
        return new NextResponse(null, { status: 200 });
    }
}

/** その他のエクスポート（使用しないがコンパイルエラー回避のためスタブ化） */
export function userAgent(_request: Request) {
    return { isBot: false, browser: {}, device: {}, engine: {}, os: {}, cpu: {} };
}

export function userAgentFromString(_ua?: string) {
    return { isBot: false, browser: {}, device: {}, engine: {}, os: {}, cpu: {} };
}

export class URLPattern {
    constructor(
        public readonly pattern: string | { pathname?: string },
        _baseURL?: string
    ) {}
    test(_url: string | { pathname?: string }) {
        return false;
    }
    exec(_url: string | { pathname?: string }) {
        return null;
    }
}

export function after(_task: unknown) {}

export function connection() {
    return Promise.resolve();
}

export class ImageResponse {
    constructor() {
        throw new Error('ImageResponse is not available in test environment');
    }
}
