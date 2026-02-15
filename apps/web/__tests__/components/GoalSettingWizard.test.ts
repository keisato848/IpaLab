import { describe, it, expect } from 'vitest';
import { getExamTypeName } from '@/lib/exam-utils';

/**
 * GoalSettingWizard コンポーネントの計画名生成ロジックをテスト
 * 実際のコンポーネント内部の generatePlanTitle 関数と同じロジック
 */
const generatePlanTitle = (examCode: string, date: string, weekdayHours: number, weekendHours: number): string => {
    const examName = getExamTypeName(examCode);
    const weeklyHours = Math.round(weekdayHours * 5 + weekendHours * 2);
    return `${examName} ${date} ${weeklyHours}h/週`;
};

describe('学習計画名の生成', () => {
    describe('計画名のフォーマット', () => {
        it('応用情報技術者試験の計画名が正しく生成される', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 1, 3);
            expect(title).toBe('応用情報技術者試験 2026/04/19 11h/週');
        });

        it('基本情報技術者試験の計画名が正しく生成される', () => {
            const title = generatePlanTitle('FE', '2026/04/19', 2, 4);
            expect(title).toBe('基本情報技術者試験 2026/04/19 18h/週');
        });

        it('ITパスポート試験の計画名が正しく生成される', () => {
            const title = generatePlanTitle('IP', '2026/03/15', 0.5, 2);
            expect(title).toBe('ITパスポート試験 2026/03/15 7h/週');
        });

        it('プロジェクトマネージャ試験の計画名が正しく生成される', () => {
            const title = generatePlanTitle('PM', '2026/10/12', 2, 5);
            expect(title).toBe('プロジェクトマネージャ試験 2026/10/12 20h/週');
        });
    });

    describe('週間学習時間の計算', () => {
        it('平日1時間、休日3時間の場合、11時間/週になる', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 1, 3);
            expect(title).toContain('11h/週');
        });

        it('平日2時間、休日4時間の場合、18時間/週になる', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 2, 4);
            expect(title).toContain('18h/週');
        });

        it('平日0時間、休日5時間の場合、10時間/週になる', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 0, 5);
            expect(title).toContain('10h/週');
        });

        it('平日3時間、休日0時間の場合、15時間/週になる', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 3, 0);
            expect(title).toContain('15h/週');
        });

        it('小数点を含む時間は丸められる', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 1.5, 2.5);
            expect(title).toContain('13h/週'); // 1.5 * 5 + 2.5 * 2 = 12.5 → 13 (四捨五入)
        });

        it('小数点を含む時間は丸められる（切り捨てケース）', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 1.4, 2.4);
            expect(title).toContain('12h/週'); // 1.4 * 5 + 2.4 * 2 = 11.8 → 12 (四捨五入)
        });
    });

    describe('受験日のフォーマット', () => {
        it('受験日がそのまま表示される', () => {
            const title = generatePlanTitle('AP', '2026/04/19', 1, 3);
            expect(title).toContain('2026/04/19');
        });

        it('異なる受験日でも正しく表示される', () => {
            const title = generatePlanTitle('SC', '2026/10/18', 2, 4);
            expect(title).toContain('2026/10/18');
        });
    });

    describe('全試験タイプのサポート', () => {
        const testCases = [
            { code: 'IP', expected: 'ITパスポート試験' },
            { code: 'FE', expected: '基本情報技術者試験' },
            { code: 'AP', expected: '応用情報技術者試験' },
            { code: 'SC', expected: '情報処理安全確保支援士試験' },
            { code: 'PM', expected: 'プロジェクトマネージャ試験' },
            { code: 'NW', expected: 'ネットワークスペシャリスト試験' },
            { code: 'SA', expected: 'システムアーキテクト試験' },
            { code: 'ST', expected: 'ITストラテジスト試験' },
            { code: 'SG', expected: '情報セキュリティマネジメント試験' },
        ];

        testCases.forEach(({ code, expected }) => {
            it(`${expected}の計画名が正しく生成される`, () => {
                const title = generatePlanTitle(code, '2026/04/19', 1, 3);
                expect(title).toContain(expected);
                expect(title).toContain('2026/04/19');
                expect(title).toContain('11h/週');
            });
        });
    });
});
