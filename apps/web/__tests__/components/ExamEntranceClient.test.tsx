import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ExamEntranceClient from '@/components/features/exam/ExamEntranceClient';

const mockPush = vi.fn();
const mockUseSession = vi.fn();
const mockGetLearningRecords = vi.fn();
const mockGetExamProgress = vi.fn();
const mockCreateLearningSession = vi.fn();
const mockGetLearningSessions = vi.fn();

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next-auth/react', () => ({
    useSession: () => mockUseSession(),
}));

vi.mock('@/lib/guest-manager', () => ({
    guestManager: {
        getGuestId: vi.fn(() => 'guest-user'),
        getHistory: vi.fn(() => []),
    },
}));

vi.mock('@/lib/api', () => ({
    getLearningRecords: (...args: any[]) => mockGetLearningRecords(...args),
    getExamProgress: (...args: any[]) => mockGetExamProgress(...args),
    createLearningSession: (...args: any[]) => mockCreateLearningSession(...args),
    getLearningSessions: (...args: any[]) => mockGetLearningSessions(...args),
}));

vi.mock('@/components/features/ads', () => ({
    useAdContext: () => ({
        isRewardedAdEnabled: false,
        isAuthenticated: true,
    }),
    RewardedAdModal: () => null,
}));

vi.mock('@/components/features/exam/ExamEntranceClient.module.css', () => ({
    default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

const questions = [
    {
        id: 'q1',
        examId: 'SA-2024-Spring-AM2',
        qNo: 1,
        category: 'Technology',
        subCategory: 'テクノロジ系',
        text: 'サンプル問題1',
        options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
        ],
        correctOption: 'a',
    },
    {
        id: 'q2',
        examId: 'SA-2024-Spring-AM2',
        qNo: 2,
        category: 'Technology',
        subCategory: 'テクノロジ系',
        text: 'サンプル問題2',
        options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
        ],
        correctOption: 'b',
    },
] as const;

describe('ExamEntranceClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSession.mockReturnValue({
            data: { user: { id: 'user-1' } },
            status: 'authenticated',
        });
        mockGetLearningRecords.mockResolvedValue([]);
        mockGetExamProgress.mockResolvedValue(null);
        mockCreateLearningSession.mockResolvedValue(null);
    });

    it('複数回の履歴を回ごとのアコーディオンで表示する', async () => {
        mockGetLearningSessions.mockResolvedValue([
            {
                id: 'session-3',
                userId: 'user-1',
                examId: 'SA-2024-Spring-AM2',
                mode: 'mock',
                startedAt: '2026-04-12T10:00:00.000Z',
                completedAt: '2026-04-12T10:40:00.000Z',
                status: 'completed',
                totalQuestions: 25,
                answeredCount: 25,
                correctCount: 20,
                lastQuestionNo: 25,
            },
            {
                id: 'session-2',
                userId: 'user-1',
                examId: 'SA-2024-Spring-AM2',
                mode: 'practice',
                startedAt: '2026-04-11T10:00:00.000Z',
                completedAt: '2026-04-11T10:25:00.000Z',
                status: 'completed',
                totalQuestions: 25,
                answeredCount: 15,
                correctCount: 12,
                lastQuestionNo: 15,
            },
            {
                id: 'session-1',
                userId: 'user-1',
                examId: 'SA-2024-Spring-AM2',
                mode: 'practice',
                startedAt: '2026-04-10T10:00:00.000Z',
                completedAt: '2026-04-10T10:15:00.000Z',
                status: 'completed',
                totalQuestions: 25,
                answeredCount: 10,
                correctCount: 7,
                lastQuestionNo: 10,
            },
        ]);

        render(
            <ExamEntranceClient
                year="SA-2024-Spring"
                type="AM2"
                examId="SA-2024-Spring-AM2"
                examLabel="システムアーキテクト試験 2024年春 午前II"
                questions={[...questions] as any}
            />
        );

        await waitFor(() => {
            expect(mockGetLearningSessions).toHaveBeenCalledWith('SA-2024-Spring-AM2');
        });

        const latestAttemptButton = screen.getByRole('button', { name: /第3回/ });
        const oldestAttemptButton = screen.getByRole('button', { name: /第1回/ });
        const latestAttemptCard = latestAttemptButton.closest('article');
        const oldestAttemptCard = oldestAttemptButton.closest('article');

        await waitFor(() => {
            expect(latestAttemptButton).toHaveAttribute('aria-expanded', 'true');
        });
        expect(oldestAttemptButton).toHaveAttribute('aria-expanded', 'false');
        expect(latestAttemptCard).not.toBeNull();
        expect(oldestAttemptCard).not.toBeNull();

        expect(within(latestAttemptCard as HTMLElement).getByText('完了日時')).toBeInTheDocument();
        expect(within(oldestAttemptCard as HTMLElement).queryByText('完了日時')).not.toBeInTheDocument();

        fireEvent.click(oldestAttemptButton);

        expect(oldestAttemptButton).toHaveAttribute('aria-expanded', 'true');
        expect(latestAttemptButton).toHaveAttribute('aria-expanded', 'false');
        expect(within(oldestAttemptCard as HTMLElement).getByText('完了日時')).toBeInTheDocument();
    });

    it('進行中の履歴がある場合はその回を優先して展開する', async () => {
        mockGetLearningSessions.mockResolvedValue([
            {
                id: 'session-2',
                userId: 'user-1',
                examId: 'SA-2024-Spring-AM2',
                mode: 'mock',
                startedAt: '2026-04-12T10:00:00.000Z',
                completedAt: '2026-04-12T10:40:00.000Z',
                status: 'completed',
                totalQuestions: 25,
                answeredCount: 25,
                correctCount: 18,
                lastQuestionNo: 25,
            },
            {
                id: 'session-1',
                userId: 'user-1',
                examId: 'SA-2024-Spring-AM2',
                mode: 'practice',
                startedAt: '2026-04-11T10:00:00.000Z',
                status: 'in-progress',
                totalQuestions: 25,
                answeredCount: 8,
                correctCount: 6,
                lastQuestionNo: 8,
            },
        ]);

        render(
            <ExamEntranceClient
                year="SA-2024-Spring"
                type="AM2"
                examId="SA-2024-Spring-AM2"
                examLabel="システムアーキテクト試験 2024年春 午前II"
                questions={[...questions] as any}
            />
        );

        const inProgressButton = await screen.findByRole('button', { name: /第1回/ });
        const latestCompletedButton = screen.getByRole('button', { name: /第2回/ });

        await waitFor(() => {
            expect(inProgressButton).toHaveAttribute('aria-expanded', 'true');
        });
        expect(latestCompletedButton).toHaveAttribute('aria-expanded', 'false');
    });
});