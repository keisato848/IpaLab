const LIMIT_PATTERN = /(\d{1,4})\s*(?:字|文字)\s*(?:以内|以下|まで)/g;
const CHOICE_STYLE_PATTERN = /解答群.*(?:記号|番号)で答えよ|(?:記号|番号)で答えよ|(?:選び|選択し).*(?:記号|番号)/;
const MULTIPLE_CHOICE_PATTERN = /(?:全て|すべて|全問|全て選び|すべて選び|二つ|2つ|三つ|3つ|複数|該当するもの)/;
const DESCRIPTIVE_PATTERN = /(?:述べよ|論ぜよ|説明せよ|考察せよ|あなたの考え|具体的に述べよ)/;
const SHORT_TEXT_PATTERN = /(?:本文中の字句|本文中から|本文中の.*用いて|名称|字句|用語|項目|プロトコル名|アルファベット\d*字|片仮名\d*字|漢字\d*字|\d{1,2}\s*(?:字|文字)\s*(?:以内|以下|まで)で答えよ)/;

const JAPANESE_CHOICE_SYMBOLS = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ'];
const ASCII_CHOICE_SYMBOLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const JAPANESE_CHOICE_CLASS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

export type AfternoonAnswerMode = 'single-choice' | 'multiple-choice' | 'short-text' | 'descriptive';

export interface AfternoonAnswerOption {
    id: string;
    label: string;
    text: string;
}

export interface AfternoonAnswerField {
    id: string;
    label: string;
    mode: AfternoonAnswerMode;
    prompt: string;
    options?: AfternoonAnswerOption[];
    correctOptionIds?: string[];
    correctText?: string;
    acceptableTexts?: string[];
    limit?: number;
    explanation?: string;
    point?: number;
}

export interface AfternoonObjectiveAnswerSubmission {
    answerFieldId: string;
    label: string;
    mode: Exclude<AfternoonAnswerMode, 'descriptive'>;
    prompt: string;
    userAnswer: string;
    selectedOptionIds?: string[];
    correctAnswer: string;
    isCorrect: boolean;
    explanation?: string;
}

export interface AfternoonObjectiveAnswerHistory {
    userAnswer: string;
    selectedOptionIds?: string[];
    correctAnswer?: string;
    isCorrect: boolean;
}

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

export function extractAnswerLimits(text?: string | null): number[] {
    if (!text) return [];

    const limits: number[] = [];
    for (const match of text.matchAll(LIMIT_PATTERN)) {
        const limit = Number(match[1]);
        if (Number.isFinite(limit) && limit > 0) {
            limits.push(limit);
        }
    }

    return limits;
}

export function isChoiceStylePrompt(text?: string | null): boolean {
    if (!text) return false;
    return CHOICE_STYLE_PATTERN.test(text);
}

export function isShortTextPrompt(text?: string | null, limit = extractAnswerLimit(text)): boolean {
    if (!text) return false;
    if (DESCRIPTIVE_PATTERN.test(text) && (!limit || limit >= 100)) return false;
    if (typeof limit === 'number' && limit > 0 && limit <= 80) return true;
    return SHORT_TEXT_PATTERN.test(text);
}

export function classifyAfternoonAnswerMode(
    text?: string | null,
    answer?: string | null,
    explicitMode?: AfternoonAnswerMode | null
): AfternoonAnswerMode {
    if (explicitMode) return explicitMode;

    const prompt = text || '';
    const answerText = answer || '';
    const limit = extractAnswerLimit(prompt);

    if (isChoiceStylePrompt(prompt)) {
        const correctIds = extractChoiceIdsFromText(answerText);
        return MULTIPLE_CHOICE_PATTERN.test(prompt) || correctIds.length > 1 ? 'multiple-choice' : 'single-choice';
    }

    if (isShortTextPrompt(prompt, limit)) {
        return 'short-text';
    }

    if (typeof limit === 'number' && limit >= 100) {
        return 'descriptive';
    }

    if (DESCRIPTIVE_PATTERN.test(prompt)) {
        return 'descriptive';
    }

    if (answerText && answerText.length <= 80 && !DESCRIPTIVE_PATTERN.test(prompt)) {
        return 'short-text';
    }

    return 'descriptive';
}

export function getPMAnswerInputVariant(text?: string | null, limit?: number): 'textarea' | 'genkoyoshi' {
    if (isChoiceStylePrompt(text) || isShortTextPrompt(text, limit)) {
        return 'textarea';
    }

    if (typeof limit === 'number' && limit < 100) {
        return 'textarea';
    }

    return 'genkoyoshi';
}

export function buildAfternoonObjectiveAnswerFields(item: any, baseAnswerFieldId: string): AfternoonAnswerField[] {
    const explicitFields = normalizeExplicitAnswerFields(item?.answerFields, baseAnswerFieldId, item);
    if (explicitFields.length > 0) {
        return explicitFields.filter(field => field.mode !== 'descriptive');
    }

    const prompt = item?.promptText || item?.text || '';
    const answer = item?.answer || item?.modelAnswer || '';
    const explanation = item?.explanation || '';
    const mode = classifyAfternoonAnswerMode(prompt, answer, item?.mode || item?.answerMode);

    if (mode === 'descriptive') {
        return [];
    }

    if (mode === 'single-choice' || mode === 'multiple-choice') {
        return buildChoiceAnswerFields({ item, baseAnswerFieldId, prompt, answer, explanation, mode });
    }

    return buildShortTextAnswerFields({ item, baseAnswerFieldId, prompt, answer, explanation });
}

export function hasAfternoonObjectiveCorrectAnswer(field: AfternoonAnswerField): boolean {
    if (field.mode === 'single-choice' || field.mode === 'multiple-choice') {
        return Boolean(field.correctOptionIds && field.correctOptionIds.length > 0);
    }

    if (field.mode === 'short-text') {
        return Boolean(field.correctText || (field.acceptableTexts && field.acceptableTexts.length > 0));
    }

    return false;
}

export function gradeAfternoonObjectiveAnswer(field: AfternoonAnswerField, userAnswer: string | string[]): boolean {
    if (field.mode === 'single-choice' || field.mode === 'multiple-choice') {
        const selectedIds = Array.isArray(userAnswer)
            ? userAnswer.map(normalizeChoiceId).filter(Boolean)
            : extractChoiceIdsFromText(userAnswer);
        const correctIds = (field.correctOptionIds || []).map(normalizeChoiceId).filter(Boolean);

        if (selectedIds.length === 0 || correctIds.length === 0) return false;
        if (selectedIds.length !== correctIds.length) return false;

        const selectedSet = new Set(selectedIds);
        return correctIds.every(id => selectedSet.has(id));
    }

    if (field.mode === 'short-text') {
        const normalizedUserAnswer = normalizeShortTextAnswer(Array.isArray(userAnswer) ? userAnswer.join(' ') : userAnswer);
        const acceptedAnswers = [field.correctText, ...(field.acceptableTexts || [])]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map(normalizeShortTextAnswer);

        return acceptedAnswers.length > 0 && acceptedAnswers.includes(normalizedUserAnswer);
    }

    return false;
}

export function normalizeShortTextAnswer(value?: string | null): string {
    if (!value) return '';
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s\u3000]/g, '')
        .replace(/[。、，,.・「」『』（）()［\]\[\]【】]/g, '')
        .trim();
}

export function formatAfternoonCorrectAnswer(field: AfternoonAnswerField): string {
    if (field.mode === 'single-choice' || field.mode === 'multiple-choice') {
        return (field.correctOptionIds || []).join(', ');
    }

    return field.correctText || field.acceptableTexts?.[0] || '';
}

export function parseSelectedOptionIdsFromAnswer(value?: string | null): string[] {
    if (!value) return [];
    return value
        .split(/[、,\s]+/)
        .map(normalizeChoiceId)
        .filter(Boolean);
}

function buildChoiceAnswerFields({
    item,
    baseAnswerFieldId,
    prompt,
    answer,
    explanation,
    mode,
}: {
    item: any;
    baseAnswerFieldId: string;
    prompt: string;
    answer: string;
    explanation: string;
    mode: AfternoonAnswerMode;
}): AfternoonAnswerField[] {
    const blankLabels = extractBlankLabels(prompt);
    const splitByBlank = blankLabels.length > 1 && !MULTIPLE_CHOICE_PATTERN.test(prompt);
    const labels = splitByBlank ? blankLabels : [blankLabels[0] || item?.label || '解答'];

    return labels.map((label, index) => {
        const correctOptionIds = extractCorrectChoiceOptionIds({ answer, explanation, label: splitByBlank ? label : undefined });
        const fieldMode: AfternoonAnswerMode = splitByBlank
            ? 'single-choice'
            : (mode === 'multiple-choice' || MULTIPLE_CHOICE_PATTERN.test(prompt) || correctOptionIds.length > 1 ? 'multiple-choice' : 'single-choice');

        return {
            id: labels.length > 1 ? `${baseAnswerFieldId}-${index}` : baseAnswerFieldId,
            label: splitByBlank ? `[ ${label} ]` : (item?.label || label || '解答'),
            mode: fieldMode,
            prompt,
            options: normalizeChoiceOptions(item?.options, correctOptionIds),
            correctOptionIds,
            explanation,
            point: item?.point,
        };
    });
}

function buildShortTextAnswerFields({
    item,
    baseAnswerFieldId,
    prompt,
    answer,
    explanation,
}: {
    item: any;
    baseAnswerFieldId: string;
    prompt: string;
    answer: string;
    explanation: string;
}): AfternoonAnswerField[] {
    const blankLabels = extractBlankLabels(prompt);
    const answerMap = extractLabeledAnswerMap(answer);
    const limits = extractAnswerLimits(prompt);
    const extractedAnswers = extractShortTextAnswers(answer, explanation);
    const fieldCount = Math.max(blankLabels.length, Object.keys(answerMap).length, limits.length, 1);

    return Array.from({ length: fieldCount }, (_, index) => {
        const blankLabel = blankLabels[index];
        const mappedAnswer = blankLabel ? answerMap[normalizeBlankLabel(blankLabel)] : undefined;
        const correctText = mappedAnswer || extractedAnswers[index] || (fieldCount === 1 ? answer || undefined : undefined);

        return {
            id: fieldCount > 1 ? `${baseAnswerFieldId}-${index}` : baseAnswerFieldId,
            label: blankLabel ? `[ ${blankLabel} ]` : (fieldCount > 1 ? `解答${index + 1}` : item?.label || '解答'),
            mode: 'short-text',
            prompt,
            correctText,
            acceptableTexts: correctText ? [correctText] : undefined,
            limit: limits[index] || extractAnswerLimit(prompt),
            explanation,
            point: item?.point,
        };
    });
}

function normalizeExplicitAnswerFields(fields: unknown, baseAnswerFieldId: string, item: any): AfternoonAnswerField[] {
    if (!Array.isArray(fields)) return [];

    return fields
        .map((field: any, index): AfternoonAnswerField | null => {
            const mode = classifyAfternoonAnswerMode(field?.prompt || item?.text || '', field?.correctText || '', field?.mode);
            const id = typeof field?.id === 'string' && field.id.trim().length > 0
                ? field.id
                : `${baseAnswerFieldId}-${index}`;

            if (mode === 'descriptive') {
                return {
                    id,
                    label: field?.label || `解答${index + 1}`,
                    mode,
                    prompt: field?.prompt || item?.text || '',
                    limit: field?.limit,
                    explanation: field?.explanation || item?.explanation,
                    point: field?.point || item?.point,
                };
            }

            return {
                id,
                label: field?.label || `解答${index + 1}`,
                mode,
                prompt: field?.prompt || item?.text || '',
                options: normalizeChoiceOptions(field?.options, field?.correctOptionIds),
                correctOptionIds: Array.isArray(field?.correctOptionIds)
                    ? field.correctOptionIds.map(normalizeChoiceId).filter(Boolean)
                    : undefined,
                correctText: field?.correctText,
                acceptableTexts: Array.isArray(field?.acceptableTexts) ? field.acceptableTexts : undefined,
                limit: field?.limit,
                explanation: field?.explanation || item?.explanation,
                point: field?.point || item?.point,
            };
        })
        .filter((field): field is AfternoonAnswerField => field !== null);
}

function normalizeChoiceOptions(options: unknown, correctOptionIds: string[] = []): AfternoonAnswerOption[] {
    if (Array.isArray(options) && options.length > 0) {
        return options
            .map((option: any) => {
                const id = normalizeChoiceId(option?.id || option?.label || option?.value);
                if (!id) return null;
                return {
                    id,
                    label: option?.label || id,
                    text: option?.text || option?.label || id,
                };
            })
            .filter((option): option is AfternoonAnswerOption => option !== null);
    }

    const useAscii = correctOptionIds.some(id => /^[a-z]$/.test(id));
    const source = useAscii ? ASCII_CHOICE_SYMBOLS : JAPANESE_CHOICE_SYMBOLS;
    const ids = new Set([...source, ...correctOptionIds.map(normalizeChoiceId).filter(Boolean)]);
    return Array.from(ids).map(id => ({ id, label: id, text: id }));
}

function extractCorrectChoiceOptionIds({ answer, explanation, label }: { answer?: string; explanation?: string; label?: string }): string[] {
    const answerMap = extractLabeledAnswerMap(answer);
    if (label) {
        const mappedAnswer = answerMap[normalizeBlankLabel(label)];
        const mappedIds = extractChoiceIdsFromText(mappedAnswer);
        if (mappedIds.length > 0) return mappedIds;

        const explainedIds = extractChoiceIdsNearLabel(explanation, label);
        if (explainedIds.length > 0) return explainedIds;
    }

    const answerIds = extractChoiceIdsFromText(answer);
    if (answerIds.length > 0) return answerIds;

    return extractGenericChoiceIdsFromExplanation(explanation);
}

function extractChoiceIdsNearLabel(text?: string | null, label?: string): string[] {
    if (!text || !label) return [];
    const escapedLabel = escapeRegExp(label);
    const pattern = new RegExp(`\\[\\s*${escapedLabel}\\s*\\][\\s\\S]{0,280}?[（(]\\s*([${JAPANESE_CHOICE_CLASS}A-Za-z])\\s*[）)]`, 'u');
    const match = text.normalize('NFKC').match(pattern);
    return match ? [normalizeChoiceId(match[1])].filter(Boolean) : [];
}

function extractGenericChoiceIdsFromExplanation(text?: string | null): string[] {
    if (!text) return [];
    const normalized = text.normalize('NFKC');
    const patterns = [
        /解答(?:は|：|:)[\s\S]{0,80}?[（(]\s*([アイウエオカキクケコサシスセソA-Za-z])\s*[）)]/u,
        /[（(]\s*([アイウエオカキクケコサシスセソA-Za-z])\s*[）)](?:を選択|に該当|となります|です)/u,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match) return [normalizeChoiceId(match[1])].filter(Boolean);
    }

    return [];
}

export function extractChoiceIdsFromText(text?: string | null): string[] {
    if (!text) return [];
    const normalized = text.normalize('NFKC');
    const bracketed = Array.from(normalized.matchAll(new RegExp(`[（(]\\s*([${JAPANESE_CHOICE_CLASS}A-Za-z])\\s*[）)]`, 'gu')))
        .map(match => normalizeChoiceId(match[1]))
        .filter(Boolean);
    if (bracketed.length > 0) return uniqueValues(bracketed);

    const cleaned = normalized
        .replace(/[\[\]（）()]/g, '')
        .replace(/(?:解答|答え|正答|選択|記号|番号|は|:|：)/g, ' ')
        .trim();
    const tokens = cleaned.split(/[、,\s]+/).map(normalizeChoiceId).filter(Boolean);
    const validTokens = tokens.filter(token => JAPANESE_CHOICE_SYMBOLS.includes(token) || ASCII_CHOICE_SYMBOLS.includes(token));

    return validTokens.length === tokens.length ? uniqueValues(validTokens) : [];
}

function extractBlankLabels(text?: string | null): string[] {
    if (!text) return [];
    const normalized = text.normalize('NFKC');
    const labels = new Set<string>();

    for (const match of normalized.matchAll(new RegExp(`\\[\\s*([${JAPANESE_CHOICE_CLASS}A-Za-z])\\s*\\]`, 'gu'))) {
        labels.add(normalizeBlankLabel(match[1]));
    }

    for (const match of normalized.matchAll(new RegExp(`\\[\\s*([${JAPANESE_CHOICE_CLASS}A-Za-z])\\s*\\]\\s*[~〜～-]\\s*\\[\\s*([${JAPANESE_CHOICE_CLASS}A-Za-z])\\s*\\]`, 'gu'))) {
        expandLabelRange(match[1], match[2]).forEach(label => labels.add(label));
    }

    return Array.from(labels);
}

function extractLabeledAnswerMap(answer?: string | null): Record<string, string> {
    if (!answer) return {};
    const normalized = answer.normalize('NFKC');
    const result: Record<string, string> = {};
    const pattern = new RegExp(`(?:\\[\\s*)?([${JAPANESE_CHOICE_CLASS}A-Za-z])(?:\\s*\\])?(?:\\([^)]*\\))?\\s*[:：]\\s*([^,、\\n]+)`, 'gu');

    for (const match of normalized.matchAll(pattern)) {
        result[normalizeBlankLabel(match[1])] = match[2].trim();
    }

    return result;
}

function extractShortTextAnswers(answer?: string | null, explanation?: string | null): string[] {
    if (answer && answer.trim().length > 0) {
        const answerMap = extractLabeledAnswerMap(answer);
        if (Object.keys(answerMap).length > 0) return Object.values(answerMap);
        return answer.split(/\r?\n|、(?=\S)|,(?=\S)/).map(value => value.trim()).filter(Boolean);
    }

    if (!explanation) return [];
    const normalized = explanation.normalize('NFKC');
    const quoted = Array.from(normalized.matchAll(/「([^」]{1,80})」/g)).map(match => match[1].trim());
    const bold = Array.from(normalized.matchAll(/\*\*([^*]{1,80})\*\*/g))
        .map(match => match[1].trim())
        .filter(value => !/^(?:設定項目|理由|解説|答え|解答|事象)$/.test(value));

    return uniqueValues([...quoted, ...bold]);
}

function normalizeChoiceId(value?: unknown): string {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const normalized = String(value)
        .normalize('NFKC')
        .replace(/[\s\u3000\[\]（）()]/g, '')
        .trim();

    if (/^[A-Za-z]$/.test(normalized)) return normalized.toLowerCase();
    return normalized;
}

function normalizeBlankLabel(value?: string | null): string {
    const normalized = normalizeChoiceId(value);
    return /^[A-Za-z]$/.test(normalized) ? normalized.toLowerCase() : normalized;
}

function expandLabelRange(start: string, end: string): string[] {
    const normalizedStart = normalizeBlankLabel(start);
    const normalizedEnd = normalizeBlankLabel(end);
    const source = /^[a-z]$/.test(normalizedStart) && /^[a-z]$/.test(normalizedEnd)
        ? ASCII_CHOICE_SYMBOLS
        : JAPANESE_CHOICE_SYMBOLS;
    const startIndex = source.indexOf(normalizedStart);
    const endIndex = source.indexOf(normalizedEnd);

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        return [normalizedStart, normalizedEnd].filter(Boolean);
    }

    return source.slice(startIndex, endIndex + 1);
}

function uniqueValues<T>(values: T[]): T[] {
    return Array.from(new Set(values));
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPMAnswerFieldId(baseId: string, sectionIndex: number, fieldIndex?: number): string {
    return `${baseId}-${sectionIndex}${fieldIndex !== undefined ? `-${fieldIndex}` : ''}`;
}

export function buildPMDraftKey(answerFieldId: string): string {
    return `ipalab_pm_answer_draft_v1:${answerFieldId}`;
}