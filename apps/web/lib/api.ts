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
    // PM specific fields
    isPM?: boolean;
    subQuestions?: any[]; // Detailed type can be added if needed
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

export async function getQuestions(examId: string): Promise<Question[]> {
    // console.log(`Fetching questions from ${API_BASE}/exams/${examId}/questions`); // Reduced logging
    try {
        const res = await fetch(`${API_BASE}/exams/${examId}/questions`, {
            cache: 'no-store', // Questions might update or we might want fresh valid data
            headers: {
                'Content-Type': 'application/json'
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
