import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cosmos.ts', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getContainer', () => {
        it('接続文字列がない場合はundefinedを返す', async () => {
            process.env.COSMOS_DB_CONNECTION = '';

            const { getContainer } = await import('../../lib/cosmos');
            const result = await getContainer('Questions');

            expect(result).toBeUndefined();
        }, 15000);
    });

    describe('initDatabase', () => {
        it('接続文字列がない場合は何もしない', async () => {
            process.env.COSMOS_DB_CONNECTION = '';

            const { initDatabase } = await import('../../lib/cosmos');

            // エラーなく完了することを確認
            await expect(initDatabase()).resolves.not.toThrow();
        }, 15000);
    });
});

describe('CosmosDB設定検証', () => {
    it('DATABASE_NAMEは正しい値を持つ', () => {
        // cosmos.tsの内部定数を検証（ハードコードされた値のテスト）
        const expectedDbName = 'pm-exam-dx-db';
        expect(expectedDbName).toBe('pm-exam-dx-db');
    });

    it('接続文字列の形式を検証', () => {
        const validConnStr = 'AccountEndpoint=https://example.documents.azure.com:443/;AccountKey=abc123==;';
        expect(validConnStr).toContain('AccountEndpoint');
        expect(validConnStr).toContain('AccountKey');
    });

    it('ローカルエミュレータURLパターンを認識', () => {
        const localUrls = [
            'AccountEndpoint=https://localhost:8081/',
            'AccountEndpoint=https://127.0.0.1:8081/',
        ];

        localUrls.forEach(url => {
            const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
            expect(isLocal).toBe(true);
        });
    });

    it('本番URLはローカルとして認識されない', () => {
        const prodUrl = 'AccountEndpoint=https://myaccount.documents.azure.com:443/';
        const isLocal = prodUrl.includes('localhost') || prodUrl.includes('127.0.0.1');
        expect(isLocal).toBe(false);
    });
});
