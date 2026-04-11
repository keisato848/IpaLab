const isClient = typeof window !== 'undefined';

export function normalizeApiBase(baseUrl: string): string {
    const trimmedBaseUrl = baseUrl.replace(/\/$/, '');
    return trimmedBaseUrl.endsWith('/api') ? trimmedBaseUrl : `${trimmedBaseUrl}/api`;
}

export function resolveApiBaseForRuntime(
    runtimeIsClient = isClient,
    env: NodeJS.ProcessEnv = process.env
): string {
    if (runtimeIsClient) {
        // Client bundles must always call the same origin API to avoid baking localhost into production assets.
        return '/api';
    }

    const candidateBaseUrl = [
        env.INTERNAL_API_BASE,
        env.NEXT_PUBLIC_API_BASE,
        env.NEXTAUTH_URL,
        env.AUTH_URL,
        env.NEXT_PUBLIC_APP_URL,
        env.WEBSITE_HOSTNAME ? `https://${env.WEBSITE_HOSTNAME}` : undefined,
        env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
        'http://localhost:3000',
    ].find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);

    return normalizeApiBase(candidateBaseUrl ?? 'http://localhost:3000');
}

export const API_BASE = resolveApiBaseForRuntime();

export interface Question {
    id: string;
    examId: string;
    qNo: number;
    category: string;
    subCategory?: string;
    text: string;
    options: { id: string; text: string }[];
    correctOption: string;
    explanation?: string;
    diagram?: string; // Markdown/Mermaid content
    // PM specific fields
    isPM?: boolean;
    subQuestions?: any[];
    point?: number;
    // Hierarchical PM fields
    description?: string;
    context?: {
        title?: string;
        background: string;
        diagrams?: {
            id: string;
            label: string;
            type: "mermaid" | "image" | "markdown";
            content: string;
        }[];
    };
    questions?: Question[];
}

export interface LearningRecord {
    id?: string;
    userId: string;
    questionId: string;
    examId: string;
    category: string;
    subCategory?: string;
    isCorrect: boolean;
    isFlagged?: boolean; // New: Flag for review
    sessionId?: string; // New: Session Context
    answeredAt: string;
    timeTakenSeconds: number;
    nextReviewAt?: string;
    reviewInterval?: number;
    easeFactor?: number;
    // AI Score Extension
    isDescriptive?: boolean;
    userAnswer?: string;
    aiScore?: number;
    aiFeedback?: string;
    aiRadarData?: any[]; // Ideally Typed, but using any for now or specific type if defined
}

// Async Job Interface
// PlanJobs コンテナ: Partition Key = /userId, TTL = 30日
export interface StudyPlanJob {
    id: string; // "job-{userId}-{timestamp}"
    type: "studyPlanJob";
    userId: string; // Partition Key
    targetExam: string;
    status: "pending" | "processing" | "completed" | "failed";
    requestData: {
        targetExam: string;
        examDate: string;
        studyTimeWeekday: number;
        studyTimeWeekend: number;
        scores: Record<string, number>;
    };
    resultData?: StudyPlan;
    error?: string; // 失敗時のエラーメッセージ
    createdAt: string;
    processingStartedAt?: string; // 処理開始時刻
    completedAt?: string;
    notifiedAt?: string; // ユーザーに通知した時刻
    dismissed?: boolean; // ユーザーが通知を破棄した場合
}

export interface MonthlyGoal {
    id: string;
    label: string;
    type: 'questionCount' | 'accuracy' | 'studyDays' | 'correctCount' | 'custom';
    targetValue: number;
    unit: string;
    iconEmoji: string;
}

export interface StudyPlan {
    title: string;
    examDate: string;
    hoursWeekday?: number; // 平日の学習時間
    hoursWeekend?: number; // 休日の学習時間
    monthlyGoal: string; // Current month's goal (summary text, backward compat)
    monthlyGoals?: MonthlyGoal[]; // Quantitative mid-term targets
    weeklySchedule: {
        weekNumber: number;
        startDate: string; // ISO Date
        endDate: string; // ISO Date
        theme?: string; // 週のテーマ（例: ネットワーク基礎）
        goal: string;
        dailyTasks: {
            date: string; // ISO Date "YYYY-MM-DD"
            missionTitle?: string; // ミッション名（ゲーム風）
            goal: string;
            questionCount: number;
            targetCategory?: string; // e.g. "セキュリティ"
            targetExamId?: string; // e.g. "AP-2023-Fall"
            difficulty?: 'easy' | 'normal' | 'hard'; // 難易度
            xpReward?: number; // 獲得XP
            isCompleted?: boolean; // 完了フラグ（クライアント側で管理）
        }[];
        focus?: string; // "Weakness Reinforcement"
    }[];
    generatedAt: string;
    // ゲーミフィケーション用累計（クライアント側で計算）
    totalXpEarned?: number;
}

/**
 * 学習セッション（手動記録用）
 */
export interface StudySession {
    id: string;
    userId?: string; // 認証ユーザーの場合のみ
    startTime: string; // ISO 8601 形式
    endTime: string; // ISO 8601 形式
    durationSeconds: number; // 学習時間（秒）
    category: 'exam' | 'reading' | 'review' | 'other'; // カテゴリ
    memo?: string; // メモ（任意）
    createdAt: string; // ISO 8601 形式
}

export interface UserProgress {
    totalXp: number;
    currentLevel: number;
    completedMissions: {
        date: string;
        planId: string;
        xpEarned: number;
        missionTitle: string;
    }[];
    streakDays: number;
    lastActiveDate: string;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    iconEmoji: string;
    xpReward: number;
    unlockedAt?: string;
}

export interface UserAchievements {
    unlocked: Achievement[];
    progress: Record<string, number>;
}

// Exam Interface
export interface Exam {
    id: string;
    title: string;
    date: string;
    category: string;
    stats: {
        total: number;
        completed: number;
        correctRate: number;
    };
}

export async function getExams(): Promise<Exam[]> {
    try {
        const res = await fetch(`${API_BASE}/exams`, {
            // Cache exam list for 1 hour - data doesn't change frequently
            next: { revalidate: 3600 }
        });

        if (!res.ok) {
            console.error(`API Error: ${res.status}`);
            return [];
        }

        return await res.json();
    } catch (error) {
        console.error("Failed to fetch exams:", error);
        return [];
    }
}

export async function getQuestions(examId: string, init?: RequestInit): Promise<Question[]> {
    // console.log(`Fetching questions from ${API_BASE}/exams/${examId}/questions`); // Reduced logging
    try {
        const res = await fetch(`${API_BASE}/exams/${examId}/questions`, {
            // Cache questions for 1 day - question content rarely changes
            next: { revalidate: 86400 },
            ...init, // Allow override
            headers: {
                'Content-Type': 'application/json',
                ...init?.headers
            }
        });

        if (!res.ok) {
            console.error(`API Error: ${res.status} ${res.statusText}`);
            return [];
        }

        return await res.json();
    } catch (error) {
        console.error("Failed to fetch questions:", error);
        return [];
    }
}

// Session Types
export interface LearningSessionInfo {
    id: string;
    userId: string;
    examId: string;
    mode: 'practice' | 'mock';
    startedAt: string;
    completedAt?: string;
    status: 'in-progress' | 'completed';
    totalQuestions?: number;
    answeredCount: number;
    correctCount: number;
    lastQuestionNo?: number;
}

// Session API
export async function createLearningSession(
    userId: string,
    examId: string,
    mode: 'practice' | 'mock',
    totalQuestions?: number
): Promise<LearningSessionInfo | null> {
    try {
        const res = await fetch(`${API_BASE}/session/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, examId, mode, totalQuestions })
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("Failed to create session:", e);
        return null;
    }
}

// Get learning sessions
export async function getLearningSessions(
    examId?: string,
    status?: 'in-progress' | 'completed',
    limit?: number
): Promise<LearningSessionInfo[]> {
    try {
        const params = new URLSearchParams();
        if (examId) params.set('examId', examId);
        if (status) params.set('status', status);
        if (limit) params.set('limit', limit.toString());

        const res = await fetch(`${API_BASE}/session?${params.toString()}`);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("Failed to fetch sessions:", e);
        return [];
    }
}

// Update session progress
export async function updateSessionProgress(
    sessionId: string,
    update: {
        answeredCount?: number;
        correctCount?: number;
        lastQuestionNo?: number;
        status?: 'in-progress' | 'completed';
    }
): Promise<LearningSessionInfo | null> {
    try {
        const res = await fetch(`${API_BASE}/session`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, ...update })
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("Failed to update session:", e);
        return null;
    }
}

export async function saveLearningRecord(record: LearningRecord): Promise<void> {
    try {
        const res = await fetch(`${API_BASE}/learning-records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(record)
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Failed to save record: ${res.status} ${err}`);
            throw new Error(`API Error: ${res.status}`);
        }
    } catch (error) {
        console.error("Failed to save learning record:", error);
        throw error;
    }
}

export async function getLearningRecords(userId: string, examId?: string, questionId?: string): Promise<LearningRecord[]> {
    try {
        const params = new URLSearchParams({ userId });
        if (examId) params.append('examId', examId);
        if (questionId) params.append('questionId', questionId);

        const res = await fetch(`${API_BASE}/learning-records?${params.toString()}`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            console.error(`API Error: ${res.status}`);
            return [];
        }

        return await res.json();
    } catch (error) {
        console.error("Failed to fetch learning records:", error);
        return [];
    }
}

export async function syncLearningRecords(records: LearningRecord[]): Promise<void> {
    if (records.length === 0) return;

    try {
        const res = await fetch(`${API_BASE}/learning-records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(records)
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Failed to sync records: ${res.status} ${err}`);
            throw new Error(`API Sync Error: ${res.status}`);
        }
    } catch (error) {
        console.error("Failed to sync learning records:", error);
        throw error;
    }
}

// --- Exam Progress API ---

export interface ExamProgress {
    id: string; // "userId-examId"
    userId: string;
    examId: string;
    bookmarks: string[]; // List of Question IDs
    statusMap: Record<string, {
        isCorrect: boolean;
        answeredAt: string;
    }>;
    updatedAt: string;
}

export async function getExamProgress(userId: string, examId: string): Promise<ExamProgress | null> {
    try {
        const params = new URLSearchParams({ userId, examId });
        const res = await fetch(`${API_BASE}/exam-progress?${params.toString()}`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            // 404 is valid (no progress yet)
            if (res.status === 404) return null;
            console.error(`API Error: ${res.status}`);
            return null;
        }

        return await res.json();
    } catch (error) {
        console.error("Failed to fetch exam progress:", error);
        return null;
    }
}

export async function saveExamProgress(
    userId: string,
    examId: string,
    data: { bookmarks?: string[]; statusUpdate?: { questionId: string; isCorrect: boolean } }
): Promise<ExamProgress | null> {
    try {
        const res = await fetch(`${API_BASE}/exam-progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, examId, ...data })
        });

        if (!res.ok) {
            console.error(`Failed to save progress: ${res.status}`);
            return null;
        }
        return await res.json();
    } catch (error) {
        console.error("Failed to save exam progress:", error);
        return null; // Don't throw to avoid blocking UI
    }
}


// --- Job System API ---

export async function createStudyPlanJob(userId: string, data: any): Promise<StudyPlanJob | null> {
    try {
        const res = await fetch(`${API_BASE}/ai/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...data })
        });
        if (!res.ok) throw new Error(res.statusText);
        return await res.json();
    } catch (e) {
        console.error("Failed to create job:", e);
        return null;
    }
}

export async function getLatestStudyPlanJob(userId: string): Promise<StudyPlanJob | null> {
    try {
        const res = await fetch(`${API_BASE}/ai/jobs?userId=${userId}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("Failed to get job:", e);
        return null;
    }
}
