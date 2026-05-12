import { describe, expect, it } from 'vitest';
import {
    buildPMAnswerFieldId,
    buildPMDraftKey,
    estimatePMAnswerDisplayMaxChars,
    extractAnswerLimit,
    getPMChoiceOptions,
    isPMChoiceCorrect,
    isPMMultipleChoice,
    resolvePMQuestionBaseId,
    shouldUsePMGenkoyoshiInput,
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

    it('PM1の字数制限なし短答は公式解答例から原稿用紙サイズを推定する', () => {
        expect(estimatePMAnswerDisplayMaxChars('比例: 所要時間×製造指示数, 一定: 所要時間', 'PM1')).toBe(30);
        expect(shouldUsePMGenkoyoshiInput('表1中の属性と四則演算子を用いて答えよ。', 'PM1')).toBe(false);
        expect(shouldUsePMGenkoyoshiInput('表1中の属性と四則演算子を用いて答えよ。', 'PM1', '比例: 所要時間×製造指示数, 一定: 所要時間')).toBe(true);
        expect(shouldUsePMGenkoyoshiInput('40字以内で答えよ。', 'PM1')).toBe(true);
        expect(shouldUsePMGenkoyoshiInput('論述せよ。', 'PM2')).toBe(true);
    });

    it('午後答案の保存キーと記録IDを同じ粒度で生成する', () => {
        const answerFieldId = buildPMAnswerFieldId('SA-2025-Spring-PM1-1', 2, 4);
        expect(answerFieldId).toBe('SA-2025-Spring-PM1-1-2-4');
        expect(buildPMDraftKey(answerFieldId)).toBe('ipalab_pm_answer_draft_v1:SA-2025-Spring-PM1-1-2-4');
    });

    it('idがない午後データはexamIdとqNoから保存用基底IDを生成する', () => {
        expect(resolvePMQuestionBaseId({ examId: 'SA-2024-Spring-PM1', qNo: 1 })).toBe('SA-2024-Spring-PM1-1');
        expect(resolvePMQuestionBaseId({ id: '1', examId: 'SA-2024-Spring-PM1', qNo: 1 })).toBe('SA-2024-Spring-PM1-1');
        expect(resolvePMQuestionBaseId({ id: 'custom-id' })).toBe('custom-id');
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

    it('午後選択式の文字列選択肢をIDと本文に正規化する', () => {
        expect(getPMChoiceOptions({ answerChoices: ['ア HTTP', 'イ DNS'] })).toEqual([
            { id: 'ア', text: 'HTTP' },
            { id: 'イ', text: 'DNS' },
        ]);
    });

    it('午後選択式の択一と複数選択を正誤判定する', () => {
        const options = getPMChoiceOptions({ answerChoices: ['ア HTTP', 'イ DNS', 'ウ SMTP'] });
        expect(isPMChoiceCorrect(['イ'], 'イ', options)).toBe(true);
        expect(isPMChoiceCorrect(['ア'], 'イ', options)).toBe(false);
        expect(isPMChoiceCorrect(['ア', 'ウ'], 'ア, ウ', options)).toBe(true);
    });

    it('複数選択を促す設問はcheckbox扱いにする', () => {
        const item = {
            text: '適切なものを二つ選び、記号で答えよ。',
            answerChoices: ['ア HTTP', 'イ DNS', 'ウ SMTP'],
            answer: 'ア, ウ',
        };

        expect(isPMMultipleChoice(item)).toBe(true);
    });
});