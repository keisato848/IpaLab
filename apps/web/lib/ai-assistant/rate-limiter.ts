import { getContainer } from '@/lib/cosmos';

const DAILY_LIMIT = 10;

/**
 * JST の当日 0:00 に対応する UTC の ISO 文字列を返す。
 * JST 0:00 = UTC 前日 15:00
 */
function getJSTStartOfDayUTC(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const year = jst.getUTCFullYear();
    const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jst.getUTCDate()).padStart(2, '0');
    // JST 当日 0:00 = UTC 前日 15:00
    const jstMidnight = new Date(`${year}-${month}-${day}T00:00:00+09:00`);
    return jstMidnight.toISOString();
}

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; used: number; remaining: number }> {
    const container = await getContainer('AiAssistantUsage');
    if (!container) {
        // DB が利用不可の場合は許可する（フォールバック）
        return { allowed: true, used: 0, remaining: DAILY_LIMIT };
    }

    const startOfDayUTC = getJSTStartOfDayUTC();
    const { resources } = await container.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId AND c.usedAt >= @startOfDay',
        parameters: [
            { name: '@userId', value: userId },
            { name: '@startOfDay', value: startOfDayUTC },
        ],
    }).fetchAll();

    const used = resources[0] || 0;
    const remaining = Math.max(0, DAILY_LIMIT - used);
    return { allowed: used < DAILY_LIMIT, used, remaining };
}

export async function recordUsage(
    userId: string,
    category: string,
    questionId?: string,
    examId?: string,
): Promise<void> {
    const container = await getContainer('AiAssistantUsage');
    if (!container) return;

    await container.items.create({
        id: crypto.randomUUID(),
        userId,
        usedAt: new Date().toISOString(),
        category,
        questionId: questionId ?? null,
        examId: examId ?? null,
    });
}

export function getJSTResetTime(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const tomorrow = new Date(jst);
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    // JST 翌日 0:00 = UTC 前日 15:00
    const resetUTC = new Date(tomorrow.getTime() - 9 * 60 * 60 * 1000);
    return resetUTC.toISOString();
}
