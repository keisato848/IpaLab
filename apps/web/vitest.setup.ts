import { vi } from 'vitest';

// node 環境（API テスト等）では DOM 関連セットアップをスキップする
// @testing-library/jest-dom は happy-dom / jsdom 環境でのみ必要
// node 環境で読み込むと ~44 秒の初期化コストがかかり、60 秒ワーカータイムアウトを超過する
if (typeof window !== 'undefined') {
    // happy-dom / jsdom 環境でのみ実行
    await import('@testing-library/jest-dom');

    // Mock localStorage
    const localStorageMock = (() => {
        let store: Record<string, string> = {};
        return {
            getItem: vi.fn((key: string) => store[key] ?? null),
            setItem: vi.fn((key: string, value: string) => {
                store[key] = value;
            }),
            removeItem: vi.fn((key: string) => {
                delete store[key];
            }),
            clear: vi.fn(() => {
                store = {};
            }),
            get length() {
                return Object.keys(store).length;
            },
            key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
        };
    })();

    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
    });

    Object.defineProperty(window, 'alert', {
        value: () => {},
        writable: true,
        configurable: true,
    });

    // Mock crypto.randomUUID
    Object.defineProperty(window, 'crypto', {
        value: {
            randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
        },
    });

    // Reset mocks before each test
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });
} else {
    // node 環境: vi のリセットのみ
    beforeEach(() => {
        vi.clearAllMocks();
    });
}
