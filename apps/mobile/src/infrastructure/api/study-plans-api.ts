/**
 * 学習計画 API クライアント（詳細設計§6、WP-4.2/4.4）
 * /api/mobile/v1/study-plans
 */
import { apiFetch } from './api-client';
import { Mobile } from '@ipa-lab/shared';

export async function fetchStudyPlans(): Promise<Mobile.StudyPlansListResponse | null> {
    const res = await apiFetch<Mobile.StudyPlansListResponse>(
        '/api/mobile/v1/study-plans',
    );
    return res.ok ? res.data : null;
}

export type UpdateStudyPlanResult =
    | { status: 'ok'; plan: Mobile.MobileStudyPlan }
    | { status: 'conflict' }
    | { status: 'error' };

/** PUT /study-plans/:id — 楽観ロック更新。version 不一致時は conflict を返す。 */
export async function updateStudyPlan(
    plan: Mobile.MobileStudyPlan,
): Promise<UpdateStudyPlanResult> {
    const res = await apiFetch<Mobile.MobileStudyPlan>(
        `/api/mobile/v1/study-plans/${plan.id}`,
        {
            method: 'PUT',
            body: JSON.stringify(plan satisfies Mobile.StudyPlanUpdateRequest),
        },
    );

    if (res.ok && res.data) return { status: 'ok', plan: res.data };
    if (res.status === 409) return { status: 'conflict' };
    return { status: 'error' };
}
