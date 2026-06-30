/**
 * 学習計画画面のコンポーネントテスト（RNTL・WP-4.2）
 * - usecase と auth-store をモックし、empty / data / error の状態を検証。
 * - エミュレータ無しで CI 検証可能（実機検証の代替ではなく補完）。
 */
import { render, screen } from '@testing-library/react-native';
import type { Mobile } from '@ipa-lab/shared';
import PlanScreen from '../plan';
import { useAuthStore } from '../../../src/store/auth-store';
import { loadStudyPlans } from '../../../src/application/usecases/study-plan';

jest.mock('../../../src/store/auth-store');
jest.mock('../../../src/application/usecases/study-plan');

const mockUseAuth = useAuthStore as unknown as jest.Mock;
const mockLoad = loadStudyPlans as jest.MockedFunction<typeof loadStudyPlans>;

function makePlan(overrides: Partial<Mobile.MobileStudyPlan> = {}): Mobile.MobileStudyPlan {
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

beforeEach(() => {
    mockUseAuth.mockReturnValue({ session: { userId: 'u1' } });
    mockLoad.mockReset();
});

describe('PlanScreen', () => {
    it('計画が無ければ空状態を表示する', async () => {
        mockLoad.mockResolvedValue({ plans: [], source: 'network' });
        render(<PlanScreen />);
        expect(await screen.findByText('学習計画がありません')).toBeTruthy();
    });

    it('計画があればタイトルを表示する', async () => {
        mockLoad.mockResolvedValue({ plans: [makePlan({ title: '基本情報 合格計画' })], source: 'network' });
        render(<PlanScreen />);
        expect(await screen.findByText('基本情報 合格計画')).toBeTruthy();
    });

    it('取得が失敗すればエラー表示と再試行を出す', async () => {
        mockLoad.mockRejectedValue(new Error('network error'));
        render(<PlanScreen />);
        expect(await screen.findByText('計画の取得に失敗しました')).toBeTruthy();
        expect(screen.getByText('再試行')).toBeTruthy();
    });
});
