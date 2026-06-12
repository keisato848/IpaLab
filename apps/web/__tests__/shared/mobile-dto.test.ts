import { describe, it, expect } from 'vitest';
import { Mobile } from '@ipa-lab/shared';

const validEvent = {
    eventId: '0f6f1c1e-9a72-4f6e-9a3a-1234567890ab',
    type: 'answer_submitted',
    occurredAt: '2026-06-12T03:00:00.000Z',
    payload: { questionId: 'q1', answer: 'A' },
    schemaVersion: 1,
};

describe('Mobile DTO: 共通エラー', () => {
    it('共通エラー応答を受理する', () => {
        const r = Mobile.mobileApiErrorSchema.safeParse({
            code: 'SYNC_CONFLICT',
            message: '競合が発生しました',
            retryable: false,
            correlationId: 'abc-123',
        });
        expect(r.success).toBe(true);
    });

    it('retryable欠落を拒否する', () => {
        const r = Mobile.mobileApiErrorSchema.safeParse({
            code: 'E',
            message: 'm',
            correlationId: 'c',
        });
        expect(r.success).toBe(false);
    });
});

describe('Mobile DTO: 同期バッチ', () => {
    it('正常なバッチを受理する', () => {
        const r = Mobile.syncBatchRequestSchema.safeParse({ events: [validEvent] });
        expect(r.success).toBe(true);
    });

    it('上限50件を超えるバッチを拒否する', () => {
        const events = Array.from({ length: Mobile.SYNC_BATCH_MAX_EVENTS + 1 }, (_, i) => ({
            ...validEvent,
            eventId: `0f6f1c1e-9a72-4f6e-9a3a-${String(i).padStart(12, '0')}`,
        }));
        const r = Mobile.syncBatchRequestSchema.safeParse({ events });
        expect(r.success).toBe(false);
    });

    it('空バッチを拒否する', () => {
        const r = Mobile.syncBatchRequestSchema.safeParse({ events: [] });
        expect(r.success).toBe(false);
    });

    it('eventIdがUUIDでない場合に拒否する', () => {
        const r = Mobile.syncBatchRequestSchema.safeParse({
            events: [{ ...validEvent, eventId: 'not-a-uuid' }],
        });
        expect(r.success).toBe(false);
    });

    it('部分ACK応答の5状態を受理する', () => {
        for (const status of ['applied', 'duplicate', 'conflict', 'rejected', 'retryable_error']) {
            const r = Mobile.syncEventResultSchema.safeParse({
                eventId: validEvent.eventId,
                status,
            });
            expect(r.success).toBe(true);
        }
    });
});

describe('Mobile DTO: 認証', () => {
    it('PKCE付きauthorize要求を受理する', () => {
        const r = Mobile.authorizeRequestSchema.safeParse({
            provider: 'google',
            codeChallenge: 'a'.repeat(43),
            codeChallengeMethod: 'S256',
            state: 's'.repeat(16),
        });
        expect(r.success).toBe(true);
    });

    it('未対応プロバイダーを拒否する', () => {
        const r = Mobile.authorizeRequestSchema.safeParse({
            provider: 'twitter',
            codeChallenge: 'a'.repeat(43),
            codeChallengeMethod: 'S256',
            state: 's'.repeat(16),
        });
        expect(r.success).toBe(false);
    });

    it('ゲスト統合要求は固定mergeId(UUID)を必須とする', () => {
        const ok = Mobile.guestMergeRequestSchema.safeParse({
            mergeId: '0f6f1c1e-9a72-4f6e-9a3a-1234567890ab',
            guestId: '0f6f1c1e-9a72-4f6e-9a3a-1234567890ac',
            guestSecret: 'secret',
        });
        expect(ok.success).toBe(true);
        const ng = Mobile.guestMergeRequestSchema.safeParse({
            mergeId: 'x',
            guestId: '0f6f1c1e-9a72-4f6e-9a3a-1234567890ac',
            guestSecret: 'secret',
        });
        expect(ng.success).toBe(false);
    });
});

describe('Mobile DTO: コンテンツ', () => {
    it('0件のquestionsを拒否する（キャッシュ破棄防壁）', () => {
        const r = Mobile.examContentResponseSchema.safeParse({
            examId: 'e1',
            contentHash: 'h',
            questions: [],
        });
        expect(r.success).toBe(false);
    });
});
