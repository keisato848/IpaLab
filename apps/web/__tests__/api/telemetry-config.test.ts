import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Headers({ host: 'localhost:3000' })),
}));

describe('/api/config/telemetry', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        delete process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;
        delete process.env.TELEMETRY_CONNECTION_STRING;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('TELEMETRY_CONNECTION_STRINGだけではブラウザへ接続文字列を返さない', async () => {
        process.env.TELEMETRY_CONNECTION_STRING = 'InstrumentationKey=server-only';

        const { GET } = await import('../../app/api/config/telemetry/route');
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.connectionString).toBe('');
    });

    it('NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRINGはブラウザ用として返す', async () => {
        process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING = 'InstrumentationKey=browser';

        const { GET } = await import('../../app/api/config/telemetry/route');
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.connectionString).toBe('InstrumentationKey=browser');
    });
});