import { z } from 'zod';

// --- Entums / Constants ---

export const ExamTypes = {
    AM1: 'AM1',
    AM2: 'AM2',
    PM1: 'PM1',
    PM2: 'PM2',
} as const;
export type ExamType = (typeof ExamTypes)[keyof typeof ExamTypes];

// Major Categories (IPA定義)
export const Categories = {
    Technology: 'Technology',
    Management: 'Management',
    Strategy: 'Strategy',
} as const;
export type Category = (typeof Categories)[keyof typeof Categories];

// --- Models ---

// Question Model
export const OptionSchema = z.object({
    id: z.string(), // 'a', 'b', 'c', 'd'
    text: z.string(),
});

export const SubQuestionSchema = z.object({
    subQNo: z.string(), // "設問1"
    text: z.string(),
    subQuestions: z.array(z.object({
        label: z.string(), // "(1)"
        text: z.string(),
        point: z.number().optional(), // Added for Scoring
    })).optional(),
    choices: z.record(z.string()).optional(),
});

export const QuestionSchema = z.object({
    id: z.string(), // PK: examId-type-number e.g. "AP-2023S-AM1-01"
    qNo: z.number().int(), // Added for easier lookup
    examId: z.string(), // e.g. "AP-2023S"
    type: z.nativeEnum(ExamTypes),
    category: z.string(), // 大分類
    subCategory: z.string().optional(), // 中分類 (Security, Database, etc.)
    text: z.string(), // Markdown (Description for PM)
    options: z.array(OptionSchema).optional(), // Changed to optional
    correctOption: z.string().optional().nullable(), // Changed to optional/nullable
    explanation: z.string().optional(), // Markdown
    transcription: z.string().optional(), // 音声読み上げ用テキスト(Future)
    createdAt: z.string().datetime().optional(),

    // PM specific
    isPM: z.boolean().optional(),
    subQuestions: z.array(SubQuestionSchema).optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

// User Model (NextAuth + Custom)
export const UserSchema = z.object({
    id: z.string(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    emailVerified: z.date().nullable().optional(),
    isGuest: z.boolean().default(false),
    targetExamDate: z.string().optional(), // YYYY-MM-DD
    preferences: z.object({
        theme: z.enum(['light', 'dark']).default('light'),
    }).optional(),
    createdAt: z.string().datetime().optional(),
});

export type User = z.infer<typeof UserSchema>;

// Learning Session Model (Udemy-style attempts)
export const LearningSessionSchema = z.object({
    id: z.string().uuid(),
    userId: z.string(),
    examId: z.string(),
    mode: z.enum(['practice', 'mock']),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    status: z.enum(['in-progress', 'completed']),
    // Progress tracking fields
    totalQuestions: z.number().int().min(0).optional(),
    answeredCount: z.number().int().min(0).default(0),
    correctCount: z.number().int().min(0).default(0),
    lastQuestionNo: z.number().int().min(0).optional(),
});
export type LearningSession = z.infer<typeof LearningSessionSchema>;

// Learning Record Model
export const LearningRecordSchema = z.object({
    id: z.string().uuid(),
    userId: z.string(), // Partition Key
    sessionId: z.string().uuid().optional(), // Link to specific attempt
    questionId: z.string(),
    examId: z.string(), // 集計用
    category: z.string(), // 集計用
    subCategory: z.string().optional(), // 分析用
    isCorrect: z.boolean(),
    isFlagged: z.boolean().default(false), // Review marker
    answeredAt: z.string().datetime(), // ISO string
    timeTakenSeconds: z.number().int().min(0),
    // Spaced Repetition Fields
    nextReviewAt: z.string().datetime().optional(),
    reviewInterval: z.number().int().default(0),
    easeFactor: z.number().default(2.5),
});

export type LearningRecord = z.infer<typeof LearningRecordSchema>;
