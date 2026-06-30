/**
 * TanStack Query キー規約（詳細設計§10）
 * 必ず user:{id} または guest:{id} のスコープを含める。
 */
export const queryKeys = {
    manifest: (userId: string) => ['user', userId, 'content', 'manifest'] as const,
    examContent: (userId: string, examId: string) =>
        ['user', userId, 'content', 'exams', examId] as const,
    bootstrap: (userId: string) => ['user', userId, 'bootstrap'] as const,
    studyPlans: (userId: string) => ['user', userId, 'study-plans'] as const,
    studyPlan: (userId: string, planId: string) =>
        ['user', userId, 'study-plans', planId] as const,
} as const;
