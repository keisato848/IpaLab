/**
 * Mobile 学習計画リポジトリ（WP-4.2）
 *
 * 既存の studyPlanRepository を再利用しつつ、楽観ロック用 version フィールドを追加。
 * Container: StudyPlan / PartitionKey: /userId（既存コンテナを流用）
 *
 * 設計制約:
 * - body/query の userId を認可に使わない。JWT の sub を正本とする。
 * - version 不一致時は 409 を返し、現在のドキュメントを含める。
 */
import { ensureContainer } from '@/lib/cosmos';
import type { MobileStudyPlan } from '@ipa-lab/shared';

interface StoredMobilePlan extends MobileStudyPlan {
    userId: string;
    docType: 'studyPlan';
}

/** StoredMobilePlan から userId/docType を除いた返却型 */
function stripMeta(doc: StoredMobilePlan): MobileStudyPlan {
    const { userId: _u, docType: _d, ...rest } = doc;
    void _u;
    void _d;
    return rest as MobileStudyPlan;
}

export const mobilePlanStore = {
    CONTAINER: 'StudyPlan',

    async listByUser(userId: string): Promise<MobileStudyPlan[]> {
        const c = await ensureContainer(this.CONTAINER);
        if (!c) throw new Error('DB not initialized');
        const { resources } = await c.items
            .query({
                query: 'SELECT * FROM c WHERE c.userId = @uid ORDER BY c.examDate ASC',
                parameters: [{ name: '@uid', value: userId }],
            })
            .fetchAll();
        return (resources as StoredMobilePlan[]).map((doc) => ({
            ...stripMeta(doc),
            // version が無い既存ドキュメントは 0 とみなす
            version: typeof doc.version === 'number' ? doc.version : 0,
        }));
    },

    async findById(userId: string, id: string): Promise<MobileStudyPlan | null> {
        const c = await ensureContainer(this.CONTAINER);
        if (!c) throw new Error('DB not initialized');
        try {
            const { resource } = await c.item(id, userId).read<StoredMobilePlan>();
            if (!resource) return null;
            return {
                ...stripMeta(resource),
                version: typeof resource.version === 'number' ? resource.version : 0,
            };
        } catch (err: unknown) {
            const e = err as { code?: number; statusCode?: number };
            if (e?.code === 404 || e?.statusCode === 404) return null;
            throw err;
        }
    },

    /**
     * 楽観ロック付き upsert。
     * - currentVersion === plan.version の場合のみ保存し、version を +1 にして返す。
     * - 不一致の場合は null を返す（呼び出し側が 409 を返す）。
     * - 新規ドキュメント（currentVersion === null）は常に作成可。
     */
    async upsertWithVersion(
        userId: string,
        plan: MobileStudyPlan,
    ): Promise<{ saved: MobileStudyPlan; conflict: null } | { saved: null; conflict: MobileStudyPlan }> {
        const c = await ensureContainer(this.CONTAINER);
        if (!c) throw new Error('DB not initialized');

        // 現在のドキュメントを取得してバージョン照合
        const current = await this.findById(userId, plan.id);

        if (current !== null && current.version !== plan.version) {
            return { saved: null, conflict: current };
        }

        const nextVersion = plan.version + 1;
        const stored: StoredMobilePlan = {
            ...plan,
            version: nextVersion,
            userId,
            docType: 'studyPlan',
        };

        const { resource } = await c.items.upsert<StoredMobilePlan>(stored);
        if (!resource) throw new Error('upsert failed');

        return {
            saved: { ...stripMeta(resource), version: resource.version },
            conflict: null,
        };
    },
};
