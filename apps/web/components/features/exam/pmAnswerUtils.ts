const LIMIT_PATTERN = /(\d{1,4})\s*(?:字|文字)\s*(?:以内|以下|まで)/g;

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

export function buildPMAnswerFieldId(baseId: string, sectionIndex: number, fieldIndex?: number): string {
    return `${baseId}-${sectionIndex}${fieldIndex !== undefined ? `-${fieldIndex}` : ''}`;
}

export function buildPMDraftKey(answerFieldId: string): string {
    return `ipalab_pm_answer_draft_v1:${answerFieldId}`;
}