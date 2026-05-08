import { describe, expect, it } from 'vitest';
import {
    buildPMAnswerFieldId,
    buildPMDraftKey,
    extractAnswerLimit,
    shouldRenderPMSectionAnswerItem,
} from '@/components/features/exam/pmAnswerUtils';

describe('pmAnswerUtils', () => {
    it('単一の字数制限を設問文から抽出する', () => {
        expect(extractAnswerLimit('本文中の下線①について、25字以内で答えよ。')).toBe(25);
        expect(extractAnswerLimit('設問アについて800文字以内で述べよ。')).toBe(800);
    });

    it('複数の異なる字数制限がある場合は単一上限として扱わない', () => {
        expect(extractAnswerLimit('設定項目を15字以内で答えよ。また理由を25字以内で答えよ。')).toBeUndefined();
    });

    it('午後答案の保存キーと記録IDを同じ粒度で生成する', () => {
        const answerFieldId = buildPMAnswerFieldId('SA-2025-Spring-PM1-1', 2, 4);
        expect(answerFieldId).toBe('SA-2025-Spring-PM1-1-2-4');
        expect(buildPMDraftKey(answerFieldId)).toBe('ipalab_pm_answer_draft_v1:SA-2025-Spring-PM1-1-2-4');
    });

    it('子設問を持つ説明だけの親設問は解答欄化しない', () => {
        const section = {
            text: '設問1 A社の製造データの作成について答えよ。',
            explanation: '親設問の説明',
            subQuestions: [{ label: '(1)', text: '20字以内で答えよ。', answer: '解答' }],
        };

        expect(shouldRenderPMSectionAnswerItem(section)).toBe(false);
    });

    it('子設問を持っていても親に明示答案がある場合は解答欄化できる', () => {
        const section = {
            text: '設問1 全体方針を答えよ。',
            answer: '全体方針',
            explanation: '親設問の解説',
            subQuestions: [{ label: '(1)', text: '20字以内で答えよ。', answer: '解答' }],
        };

        expect(shouldRenderPMSectionAnswerItem(section)).toBe(true);
    });
});