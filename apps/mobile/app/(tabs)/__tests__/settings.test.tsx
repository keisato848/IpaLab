/**
 * 設定画面 学習計画セクションのコンポーネントテスト（RNTL・WP-4.4）
 * - auth-store と study-plans-api をモックし、空 / エラー / 表示 / 編集→保存成功 / 409競合 を検証。
 * - StudyPlanSection は useQuery を使うため QueryClientProvider でラップする。
 * - エミュレータ無しで CI 検証可能（実機検証の代替ではなく補完）。
 */
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Mobile } from '@ipa-lab/shared';
import SettingsScreen from '../settings';
import { useAuthStore } from '../../../src/store/auth-store';
import {
    fetchStudyPlans,
    updateStudyPlan,
} from '../../../src/infrastructure/api/study-plans-api';

jest.mock('../../../src/store/auth-store');
jest.mock('../../../src/infrastructure/api/study-plans-api');
jest.mock('../../../src/application/usecases/auth', () => ({ logout: jest.fn() }));

const mockUseAuth = useAuthStore as unknown as jest.Mock;
const mockFetch = fetchStudyPlans as jest.MockedFunction<typeof fetchStudyPlans>;
const mockUpdate = updateStudyPlan as jest.MockedFunction<typeof updateStudyPlan>;

function makePlan(
    overrides: Partial<Mobile.MobileStudyPlan> = {},
): Mobile.MobileStudyPlan {
    return {
        id: 'p1',
        version: 0,
        title: '合格計画',
        examDate: '2026-10-18',
        monthlyGoal: '午前突破',
        weeklySchedule: [],
        generatedAt: '2026-06-01T00:00:00.000Z',
        ...overrides,
    };
}

function renderWithClient(ui: ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
    mockUseAuth.mockReturnValue({
        session: { userId: 'u1', authType: 'authenticated' },
    });
    mockFetch.mockReset();
    mockUpdate.mockReset();
});

describe('SettingsScreen 学習計画セクション', () => {
    it('計画が無ければ空状態を表示する', async () => {
        mockFetch.mockResolvedValue({ plans: [] });
        renderWithClient(<SettingsScreen />);
        expect(await screen.findByText('学習計画がありません')).toBeTruthy();
    });

    it('取得に失敗すれば空状態（学習計画がありません）を表示する', async () => {
        mockFetch.mockRejectedValue(new Error('network error'));
        renderWithClient(<SettingsScreen />);
        expect(await screen.findByText('学習計画がありません')).toBeTruthy();
    });

    it('計画があればタイトル・目標試験日・月間目標と編集ボタンを表示する', async () => {
        mockFetch.mockResolvedValue({
            plans: [makePlan({ title: '基本情報 合格計画', monthlyGoal: '午前突破' })],
        });
        renderWithClient(<SettingsScreen />);
        expect(await screen.findByText('基本情報 合格計画')).toBeTruthy();
        expect(screen.getByText('2026-10-18')).toBeTruthy();
        expect(screen.getByText('午前突破')).toBeTruthy();
        expect(screen.getByText('編集')).toBeTruthy();
    });

    it('編集→保存成功で API を呼び、表示が更新される（楽観更新）', async () => {
        mockFetch.mockResolvedValue({ plans: [makePlan({ title: '旧タイトル' })] });
        mockUpdate.mockResolvedValue({
            status: 'ok',
            plan: makePlan({ id: 'p1', title: '新タイトル' }),
        });

        renderWithClient(<SettingsScreen />);
        fireEvent.press(await screen.findByText('編集'));

        const titleInput = screen.getByDisplayValue('旧タイトル');
        fireEvent.changeText(titleInput, '新タイトル');
        fireEvent.press(screen.getByText('保存'));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'p1', title: '新タイトル' }),
        );
        expect(await screen.findByText('新タイトル')).toBeTruthy();
    });

    it('保存が409競合なら更新の競合アラートを表示する', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        mockFetch.mockResolvedValue({ plans: [makePlan({ title: '計画A' })] });
        mockUpdate.mockResolvedValue({ status: 'conflict' });

        renderWithClient(<SettingsScreen />);
        fireEvent.press(await screen.findByText('編集'));
        fireEvent.changeText(screen.getByDisplayValue('計画A'), '計画B');
        fireEvent.press(screen.getByText('保存'));

        await waitFor(() =>
            expect(alertSpy).toHaveBeenCalledWith(
                '更新の競合',
                expect.any(String),
                expect.any(Array),
            ),
        );
        alertSpy.mockRestore();
    });
});
