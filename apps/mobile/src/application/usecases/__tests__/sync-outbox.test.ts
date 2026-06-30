import { syncOutbox, type OutboxPort, type SyncApiPort, type SyncEventPayload } from '../sync-outbox';

function makePorts(items: { eventId: string; attemptCount: number }[]) {
    const transitions: { eventId: string; nextState: string; retryAfterSeconds?: number }[] = [];
    const outbox: OutboxPort = {
        leasePending: async (limit) => items.slice(0, limit),
        loadEvents: async (ids) =>
            ids.map(
                (id): SyncEventPayload => ({
                    eventId: id,
                    type: 'answer_submitted',
                    occurredAt: '2026-06-12T00:00:00.000Z',
                    payload: {},
                    schemaVersion: 1,
                })
            ),
        applyTransition: async (eventId, nextState, options) => {
            transitions.push({ eventId, nextState, retryAfterSeconds: options.retryAfterSeconds });
        },
    };
    return { outbox, transitions };
}

describe('syncOutbox（詳細設計§8）', () => {
    it('applied/duplicateはacknowledged、conflictとrejectedは各状態へ遷移する', async () => {
        const { outbox, transitions } = makePorts([
            { eventId: 'e1', attemptCount: 0 },
            { eventId: 'e2', attemptCount: 0 },
            { eventId: 'e3', attemptCount: 0 },
            { eventId: 'e4', attemptCount: 0 },
        ]);
        const api: SyncApiPort = {
            sendBatch: async () => [
                { eventId: 'e1', status: 'applied' },
                { eventId: 'e2', status: 'duplicate' },
                { eventId: 'e3', status: 'conflict' },
                { eventId: 'e4', status: 'rejected' },
            ],
        };
        const result = await syncOutbox(outbox, api);
        expect(result).toEqual({ sent: 4, acknowledged: 2, conflicts: 1, deadLetters: 1, retries: 0 });
        expect(transitions.find((t) => t.eventId === 'e4')?.nextState).toBe('dead_letter');
    });

    it('バッチ全体失敗時は全件retry_waitとなりバックオフ秒が付与される', async () => {
        const { outbox, transitions } = makePorts([
            { eventId: 'e1', attemptCount: 0 },
            { eventId: 'e2', attemptCount: 1 },
        ]);
        const api: SyncApiPort = {
            sendBatch: async () => {
                throw new Error('network down');
            },
        };
        const result = await syncOutbox(outbox, api);
        expect(result.retries).toBe(2);
        expect(transitions[0]).toMatchObject({ eventId: 'e1', nextState: 'retry_wait', retryAfterSeconds: 2 });
        expect(transitions[1]).toMatchObject({ eventId: 'e2', nextState: 'retry_wait', retryAfterSeconds: 4 });
    });

    it('8回目の失敗でdead_letterへ移行する（削除はしない）', async () => {
        const { outbox, transitions } = makePorts([{ eventId: 'e1', attemptCount: 7 }]);
        const api: SyncApiPort = {
            sendBatch: async () => {
                throw new Error('network down');
            },
        };
        const result = await syncOutbox(outbox, api);
        expect(result.deadLetters).toBe(1);
        expect(transitions[0]?.nextState).toBe('dead_letter');
    });

    it('応答に含まれないイベントは送達不明として再試行する', async () => {
        const { outbox, transitions } = makePorts([
            { eventId: 'e1', attemptCount: 0 },
            { eventId: 'e2', attemptCount: 0 },
        ]);
        const api: SyncApiPort = {
            sendBatch: async () => [{ eventId: 'e1', status: 'applied' }],
        };
        const result = await syncOutbox(outbox, api);
        expect(result.acknowledged).toBe(1);
        expect(result.retries).toBe(1);
        expect(transitions.find((t) => t.eventId === 'e2')?.nextState).toBe('retry_wait');
    });

    it('pendingが空なら何もしない', async () => {
        const { outbox } = makePorts([]);
        const api: SyncApiPort = { sendBatch: async () => [] };
        const result = await syncOutbox(outbox, api);
        expect(result.sent).toBe(0);
    });
});
