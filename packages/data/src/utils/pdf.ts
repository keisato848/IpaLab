import pdf from 'pdf-parse';

export interface AnswerKey {
    qNo: number;
    correct: string; // 'a', 'b', 'c', 'd' or 'ア', 'イ', 'ウ', 'エ'
}

export async function extractAnswersFromPdf(dataBuffer: Buffer): Promise<AnswerKey[]> {
    const data = await pdf(dataBuffer);
    const text = data.text;

    // IPA Answer PDFs usually list Question No and Answer side-by-side or in a table.
    // Simple heuristic: Look for lines like "問1  ア" or "1   ア"
    // This regex needs implementation specific tuning based on actual PDF layout.
    // For now, we use a generous regex to catch likely candidates.

    const answers: AnswerKey[] = [];
    const lines = text.split('\n');

    // Regex to match "1 ア" or "問1 ア" etc.
    // Assumes Japanese PDF: ア, イ, ウ, エ
    const regex = /(?:問)?\s*(\d+)\s+([アイウエ])/g;

    let match;
    // Iterate over full text or lines. Using regex on full text is often easier if spacing works.
    // However, pdf-parse output layout can be messy.

    // Normalized text (remove extra spaces)
    const normalizedText = text.replace(/\s+/g, ' ');

    while ((match = regex.exec(normalizedText)) !== null) {
        const qNo = parseInt(match[1], 10);
        const jpOption = match[2];
        const enOption = mapJpToEn(jpOption);

        // Deduplicate: If we already have this qNo, valid to check or skip
        if (!answers.find(a => a.qNo === qNo)) {
            answers.push({ qNo, correct: enOption });
        }
    }

    return answers.sort((a, b) => a.qNo - b.qNo);
}

function mapJpToEn(jp: string): string {
    const map: Record<string, string> = {
        'ア': 'a',
        'イ': 'b',
        'ウ': 'c',
        'エ': 'd'
    };
    return map[jp] || jp;
}
