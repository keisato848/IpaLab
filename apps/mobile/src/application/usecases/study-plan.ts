/**
 * 学習計画ユースケース（詳細設計§7, WP-4.2）
 *
 * - loadStudyPlans: オンライン取得 → SQLite キャッシュ更新。失敗時はキャッシュを読む（オフライン対応）。
 * - SQLite(study_plans) を端末側の閲覧用キャッシュとして扱う（正本は version 付きでサーバ）。
 */
import { eq } from 'drizzle-orm';
import { Mobile } from '@ipa-lab/shared';
import { getDb } from '../../infrastructure/db/client';
import { studyPlans } from '../../infrastructure/db/schema';
import { fetchStudyPlans } from '../../infrastructure/api/plan-api';

export type PlanSource = 'network' | 'cache';

export interface LoadPlansResult {
    plans: Mobile.MobileStudyPlan[];
    source: PlanSource;
}

function parsePlan(planJson: string): Mobile.MobileStudyPlan | null {
    try {
        return Mobile.mobileStudyPlanSchema.parse(JSON.parse(planJson));
    } catch {
        return null;
    }
}

/** SQLite から計画を読む（オフライン時の表示元）。 */
export async function readCachedPlans(ownerId: string): Promise<Mobile.MobileStudyPlan[]> {
    const db = getDb();
    const rows = await db.select().from(studyPlans).where(eq(studyPlans.ownerId, ownerId));
    const plans: Mobile.MobileStudyPlan[] = [];
    for (const row of rows) {
        const plan = parsePlan(row.planJson);
        if (plan) plans.push(plan);
    }
    return plans;
}

/** API 取得した計画を SQLite へ upsert（synced）。 */
export async function cachePlans(
    ownerId: string,
    plans: readonly Mobile.MobileStudyPlan[],
): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    for (const plan of plans) {
        const planJson = JSON.stringify(plan);
        await db
            .insert(studyPlans)
            .values({
                id: plan.id,
                ownerId,
                version: plan.version,
                planJson,
                syncStatus: 'synced',
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: studyPlans.id,
                set: { version: plan.version, planJson, syncStatus: 'synced', updatedAt: now },
            });
    }
}

/** オンライン取得→キャッシュ更新。失敗時はキャッシュ読み出し。 */
export async function loadStudyPlans(ownerId: string): Promise<LoadPlansResult> {
    const fetched = await fetchStudyPlans();
    if (fetched) {
        // キャッシュ更新失敗は表示を妨げない
        await cachePlans(ownerId, fetched).catch(() => undefined);
        return { plans: fetched, source: 'network' };
    }
    const cached = await readCachedPlans(ownerId);
    return { plans: cached, source: 'cache' };
}
