/**
 * 学習計画 API クライアント（詳細設計§6, WP-4.2）
 * GET /api/mobile/v1/study-plans
 */
import { apiFetch } from './api-client';
import { Mobile } from '@ipa-lab/shared';

/** 認証ユーザーの学習計画一覧を取得。失敗時は null（オフライン or 障害）。 */
export async function fetchStudyPlans(): Promise<Mobile.MobileStudyPlan[] | null> {
    const res = await apiFetch<Mobile.StudyPlansListResponse>('/api/mobile/v1/study-plans');
    return res.ok && res.data ? res.data.plans : null;
}
