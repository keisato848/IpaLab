import { describe, expect, it } from 'vitest';
import {
    buildAfternoonObjectiveAnswerFields,
    buildPMAnswerFieldId,
    buildPMDraftKey,
    classifyAfternoonAnswerMode,
    extractAnswerLimit,
    getPMAnswerInputVariant,
    gradeAfternoonObjectiveAnswer,
    isChoiceStylePrompt,
    normalizeShortTextAnswer,
} from '@/components/features/exam/pmAnswerUtils';

describe('pmAnswerUtils', () => {
    it('単一の字数制限を設問文から抽出する', () => {
        expect(extractAnswerLimit('本文中の下線①について、25字以内で答えよ。')).toBe(25);
        expect(extractAnswerLimit('設問アについて800文字以内で述べよ。')).toBe(800);
    });

    it('複数の異なる字数制限がある場合は単一上限として扱わない', () => {
        expect(extractAnswerLimit('設定項目を15字以内で答えよ。また理由を25字以内で答えよ。')).toBeUndefined();
    });

    it('解答群から記号で答える選択式文言を検出する', () => {
        const prompt = '本文中の [ a ] に入れる適切な字句を解答群の中から選び、記号で答えよ。';
        expect(isChoiceStylePrompt(prompt)).toBe(true);
        expect(getPMAnswerInputVariant(prompt, undefined)).toBe('textarea');
        expect(classifyAfternoonAnswerMode(prompt)).toBe('single-choice');
    });

    it('複数選択と短答式を分類する', () => {
        expect(classifyAfternoonAnswerMode('該当するものを全て選び、記号で答えよ。', 'ア, オ')).toBe('multiple-choice');
        expect(classifyAfternoonAnswerMode('本文中の下線①の調査方法の名称を、片仮名12字以内で答えよ。')).toBe('short-text');
    });

    it('空欄ごとに択一回答欄を生成し、解説から正答記号を抽出する', () => {
        const fields = buildAfternoonObjectiveAnswerFields({
            label: '設問2',
            text: '本文中の [ a ] と [ b ] をそれぞれ解答群の中から選び、記号で答えよ。',
            explanation: '- **[ a ]**：パスワードスプレー攻撃（キ）に該当します。\n- **[ b ]**：RDP（ウ）を選択します。',
        }, 'AP-2025-Spring-PM-1-1');

        expect(fields).toHaveLength(2);
        expect(fields[0]).toMatchObject({ mode: 'single-choice', label: '[ a ]', correctOptionIds: ['キ'] });
        expect(fields[1]).toMatchObject({ mode: 'single-choice', label: '[ b ]', correctOptionIds: ['ウ'] });
    });

    it('選択式の採点は順序に依存しない集合一致にする', () => {
        const field = buildAfternoonObjectiveAnswerFields({
            label: '設問',
            text: '該当するものを二つ選び、記号で答えよ。',
            answer: 'ア, オ',
        }, 'field-1')[0];

        expect(field.mode).toBe('multiple-choice');
        expect(gradeAfternoonObjectiveAnswer(field, ['オ', 'ア'])).toBe(true);
        expect(gradeAfternoonObjectiveAnswer(field, ['ア'])).toBe(false);
    });

    it('短答式は全半角・大小文字・空白・句読点を正規化して採点する', () => {
        const field = buildAfternoonObjectiveAnswerFields({
            label: '設問1',
            text: '本文中の下線①の調査方法の名称を、片仮名12字以内で答えよ。',
            explanation: '証拠の保全、調査、分析を行う手法は**デジタルフォレンジック**と呼ばれます。',
        }, 'field-2')[0];

        expect(field.mode).toBe('short-text');
        expect(field.correctText).toBe('デジタルフォレンジック');
        expect(normalizeShortTextAnswer(' デジタル・フォレンジック。 ')).toBe('デジタルフォレンジック');
        expect(gradeAfternoonObjectiveAnswer(field, 'デジタル・フォレンジック。')).toBe(true);
    });

    it('論述式は原稿用紙入力を維持する', () => {
        const prompt = '設問アについて、800文字以内で述べよ。';
        expect(isChoiceStylePrompt(prompt)).toBe(false);
        expect(getPMAnswerInputVariant(prompt, 800)).toBe('genkoyoshi');
        expect(classifyAfternoonAnswerMode(prompt)).toBe('descriptive');
    });

    it('午後答案の保存キーと記録IDを同じ粒度で生成する', () => {
        const answerFieldId = buildPMAnswerFieldId('SA-2025-Spring-PM1-1', 2, 4);
        expect(answerFieldId).toBe('SA-2025-Spring-PM1-1-2-4');
        expect(buildPMDraftKey(answerFieldId)).toBe('ipalab_pm_answer_draft_v1:SA-2025-Spring-PM1-1-2-4');
    });
});