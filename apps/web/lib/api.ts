export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071/api';

export interface Question {
    id: string; // e.g. "AP-2023-Fall-AM-1"
    examId: string;
    qNo: number; // Helper property if available, or parse from ID
    category: string;
    subCategory?: string;
    text: string;
    options: { id: string; text: string }[];
    correctOption: string;
    explanation?: string;
}

export async function getQuestions(examId: string): Promise<Question[]> {
    console.log(`Fetching questions from ${API_BASE}/exams/${examId}/questions`);
    try {
        const res = await fetch(`${API_BASE}/exams/${examId}/questions`, {
            cache: 'no-store',
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
