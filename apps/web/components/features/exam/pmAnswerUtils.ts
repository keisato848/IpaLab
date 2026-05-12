const LIMIT_PATTERN = /(\d{1,4})\s*(?:字|文字)\s*(?:以内|以下|まで)/g;
const CHOICE_PREFIX_PATTERN = /^([A-Za-z]|[0-9]+|[ア-ン])(?:[\s:：\.．\)）、-]+)(.+)$/;
const MULTIPLE_CHOICE_PATTERN = /(全て|すべて|複数|二つ|2つ|三つ|3つ|四つ|4つ).{0,12}選/;

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function extractAnswerLimit(text?: string | null): number | undefined {
    if (!text) return undefined;

    const limits = new Set<number>();
    for (const match of text.matchAll(LIMIT_PATTERN)) {
        const limit = Number(match[1]);
        if (Number.isFinite(limit) && limit > 0) {
            limits.add(limit);
        }
    }

    return limits.size === 1 ? [...limits][0] : undefined;
}

export function estimatePMAnswerDisplayMaxChars(modelAnswer?: string | null, subCategory?: string | null): number | undefined {
    if ((subCategory || '').toUpperCase() === 'PM2') return undefined;
    if (!hasText(modelAnswer)) return undefined;

    const estimated = Math.ceil(Array.from(modelAnswer.trim()).length * 1.2);
    return Math.ceil(Math.max(20, estimated) / 10) * 10;
}

export function shouldUsePMGenkoyoshiInput(text?: string | null, subCategory?: string | null, modelAnswer?: string | null): boolean {
    if ((subCategory || '').toUpperCase() === 'PM2') return true;
    if (extractAnswerLimit(text) !== undefined) return true;

    return estimatePMAnswerDisplayMaxChars(modelAnswer, subCategory) !== undefined;
}

export function hasPMDirectAnswerContent(item: any): boolean {
    return hasText(item?.answer) || hasText(item?.explanation) || hasText(item?.modelAnswer);
}

export function getPMChildAnswerItems(section: any): any[] {
    if (Array.isArray(section?.subQuestions) && section.subQuestions.length > 0) {
        return section.subQuestions;
    }

    if (Array.isArray(section?.questions) && section.questions.length > 0) {
        return section.questions;
    }

    return [];
}

export function shouldRenderPMSectionAnswerItem(section: any, childItems = getPMChildAnswerItems(section)): boolean {
    if (!hasPMDirectAnswerContent(section)) return false;
    if (childItems.length === 0) return true;

    return hasText(section?.answer) || hasText(section?.modelAnswer);
}

export function buildPMAnswerFieldId(baseId: string, sectionIndex: number, fieldIndex?: number): string {
    return `${baseId}-${sectionIndex}${fieldIndex !== undefined ? `-${fieldIndex}` : ''}`;
}

export function resolvePMQuestionBaseId(question: { id?: string; examId?: string; qNo?: string | number }): string {
    const examId = String(question.examId ?? '').trim();
    const questionNo = String(question.qNo ?? '').trim();
    if (examId && questionNo) return `${examId}-${questionNo}`;

    if (hasText(question.id)) return question.id.trim();

    return examId || questionNo || 'unknown-question';
}

export function buildPMDraftKey(answerFieldId: string): string {
    return `ipalab_pm_answer_draft_v1:${answerFieldId}`;
}

export type PMChoiceOption = {
    id: string;
    text: string;
};

function normalizeChoiceOption(value: unknown): PMChoiceOption | null {
    if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return null;
        const match = raw.match(CHOICE_PREFIX_PATTERN);
        if (!match) return { id: raw, text: raw };
        return { id: match[1], text: match[2].trim() || raw };
    }

    if (value && typeof value === 'object') {
        const option = value as Record<string, unknown>;
        const id = String(option.id ?? option.key ?? option.value ?? option.label ?? '').trim();
        const text = String(option.text ?? option.label ?? option.value ?? id).trim();
        if (!id) return null;
        return { id, text: text || id };
    }

    return null;
}

export function getPMChoiceOptions(item: any): PMChoiceOption[] {
    const rawChoices = item?.answerChoices ?? item?.choices ?? item?.options;
    if (!Array.isArray(rawChoices)) return [];

    return rawChoices
        .map(normalizeChoiceOption)
        .filter((option): option is PMChoiceOption => Boolean(option));
}

function collectAnswerText(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(collectAnswerText);
    if (value && typeof value === 'object') return Object.values(value).flatMap(collectAnswerText);
    if (typeof value === 'string') return [value];
    return [];
}

export function getPMCorrectChoiceIds(answer: unknown, options: PMChoiceOption[]): string[] {
    const optionIds = new Set(options.map(option => option.id));
    const values = collectAnswerText(answer);
    const ids: string[] = [];

    for (const value of values) {
        if (value.trim() === 'ALL_CORRECT') return ['ALL_CORRECT'];
        for (const option of options) {
            if (value.trim() === option.id || value.trim().startsWith(`${option.id}:`) || value.trim().startsWith(`${option.id}：`)) {
                ids.push(option.id);
            }
        }
        for (const match of value.matchAll(/[A-Za-z]|[0-9]+|[ア-ン]/g)) {
            if (optionIds.has(match[0])) ids.push(match[0]);
        }
    }

    return [...new Set(ids)];
}

export function isPMMultipleChoice(item: any, options = getPMChoiceOptions(item)): boolean {
    if (options.length === 0) return false;
    if (item?.multiple === true || item?.selectionMode === 'multiple' || item?.choiceMode === 'checkbox') return true;
    const prompt = `${item?.promptText ?? ''}\n${item?.text ?? ''}`;
    if (MULTIPLE_CHOICE_PATTERN.test(prompt)) return true;
    return getPMCorrectChoiceIds(item?.answer ?? item?.modelAnswer, options).length > 1;
}

export function isPMChoiceCorrect(selectedIds: string[], answer: unknown, options: PMChoiceOption[]): boolean {
    const correctIds = getPMCorrectChoiceIds(answer, options);
    if (correctIds.includes('ALL_CORRECT')) return selectedIds.length > 0;
    if (selectedIds.length === 0 || selectedIds.length !== correctIds.length) return false;

    const selected = new Set(selectedIds);
    return correctIds.every(id => selected.has(id));
}