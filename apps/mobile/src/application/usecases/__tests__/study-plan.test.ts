/**
 * loadStudyPlans のネットワーク→キャッシュ/オフライン分岐テスト（WP-4.2）
 * - api(plan-api) と db(client) をモックし、実 SQLite/ネットワークなしで分岐を検証。
 */
import type { Mobile } from '@ipa-lab/shared';

jest.mock('../../../infrastructure/api/plan-api');
jest.mock('../../../infrastructure/db/client');

import { loadStudyPlans } from '../study-plan';
import { fetchStudyPlans } from '../../../infrastructure/api/plan-api';
import { getDb } from '../../../infrastructure/db/client';

const mockFetch = fetchStudyPlans as jest.MockedFunction<typeof fetchStudyPlans>;
const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

function makePlan(overrides: Partial<Mobile.MobileStudyPlan> = {}): Mobile.MobileStudyPlan {
    return {
        id: 'p1',
        version: 0,
        title: '合格計画',
        examDate: '2026-10-18',
        monthlyGoal: '午前突破',
        weeklySchedule: [],
        generatedAt: '2026-06-01T00:00:00.000Z',
        ...overrides,
    };
}

let cacheRows: { planJson: string }[];
let inserted: unknown[];

beforeEach(() => {
    mockFetch.mockReset();
    cacheRows = [];
    inserted = [];
    const fakeDb = {
        select: () => ({ from: () => ({ where: () => Promise.resolve(cacheRows) }) }),
        insert: () => ({
            values: (v: unknown) => ({
                onConflictDoUpdate: () => {
                    inserted.push(v);
                    return Promise.resolve();
                },
            }),
        }),
    };
    mockGetDb.mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);
});

describe('loadStudyPlans', () => {
    it('取得成功時は source=network を返し、キャッシュへ書き込む', async () => {
        mockFetch.mockResolvedValue([makePlan({ id: 'net' })]);

        const result = await loadStudyPlans('u1');

        expect(result.source).toBe('network');
        expect(result.plans).toHaveLength(1);
        expect(result.plans[0]?.id).toBe('net');
        expect(inserted).toHaveLength(1); // キャッシュ upsert された
    });

    it('取得失敗（オフライン）時はキャッシュから読み、source=cache を返す', async () => {
        mockFetch.mockResolvedValue(null);
        cacheRows = [{ planJson: JSON.stringify(makePlan({ id: 'cached' })) }];

        const result = await loadStudyPlans('u1');

        expect(result.source).toBe('cache');
        expect(result.plans).toHaveLength(1);
        expect(result.plans[0]?.id).toBe('cached');
        expect(inserted).toHaveLength(0); // 書き込みは行わない
    });

    it('壊れたキャッシュ JSON は読み飛ばす', async () => {
        mockFetch.mockResolvedValue(null);
        cacheRows = [{ planJson: 'not-json' }];

        const result = await loadStudyPlans('u1');

        expect(result.source).toBe('cache');
        expect(result.plans).toHaveLength(0);
    });
});
