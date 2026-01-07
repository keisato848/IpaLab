const isClient = typeof window !== 'undefined';
// Force relative path to avoid stagnant .env pointing to 3000
// Use environment variable for API base, fallback to localhost for dev
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || (isClient ? '/api' : 'http://localhost:3001/api');

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
            cache: 'no-store'
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
            cache: 'no-store', // Default
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
