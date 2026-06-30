/**
 * 学習セッション・回答保存ユースケース（詳細設計§7/§8）
 *
 * - createSession: learning_sessions に INSERT
 * - saveAnswer: learning_events + outbox_events を同一トランザクションで追記
 * - completeSession: learning_sessions.completedAt を更新
 *
 * 設計制約:
 * - eventId は UUID v4（再送時も変更しない）
 * - payloadJson にメール・自由記述回答は含めない
 * - ownerId は JWT sub から取得（引数として受け取る）
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/infrastructure/db/client';
import {
    learningSessions,
    learningEvents,
    outboxEvents,
} from '../../../src/infrastructure/db/schema';
import { randomUUID } from 'expo-crypto';

export interface SaveAnswerInput {
    ownerId: string;
    sessionId: string;
    examId: string;
    qNo: number;
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    occurredAt: string;
}

/** learning_sessions に新規セッションを作成し sessionId を返す */
export async function createLearningSession(ownerId: string, examId: string): Promise<string> {
    const db = getDb();
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    await db.insert(learningSessions).values({
        id: sessionId,
        ownerId,
        examId,
        startedAt: now,
        lastQNo: 1,
    });
    return sessionId;
}

/** 回答を learning_events と outbox_events に同一トランザクションで保存 */
export async function saveAnswer(input: SaveAnswerInput): Promise<string> {
    const db = getDb();
    const eventId = randomUUID();
    const now = new Date().toISOString();
    const isCorrect = input.selectedIndex === input.correctIndex;

    // payloadJson: 識別可能だが個人情報を含まない
    const payloadJson = JSON.stringify({
        examId: input.examId,
        qNo: input.qNo,
        questionId: input.questionId,
        selectedIndex: input.selectedIndex,
        isCorrect,
    });

    await db.transaction(async (tx) => {
        // 1. 学習イベント追記
        await tx.insert(learningEvents).values({
            eventId,
            ownerId: input.ownerId,
            sessionId: input.sessionId,
            type: 'question_answered',
            occurredAt: input.occurredAt,
            payloadJson,
            schemaVersion: 1,
        });

        // 2. Outbox に積む（同期デーモンが後処理）
        await tx.insert(outboxEvents).values({
            eventId,
            ownerId: input.ownerId,
            state: 'pending',
            attemptCount: 0,
            createdAt: now,
        });

        // 3. セッションの lastQNo を更新
        await tx
            .update(learningSessions)
            .set({ lastQNo: input.qNo })
            .where(eq(learningSessions.id, input.sessionId));
    });

    return eventId;
}

/** セッション完了を記録 */
export async function completeLearningSession(sessionId: string): Promise<void> {
    const db = getDb();
    await db
        .update(learningSessions)
        .set({ completedAt: new Date().toISOString() })
        .where(eq(learningSessions.id, sessionId));
}

/** 最近のセッション一覧（ヒストリー用） */
export async function listRecentSessions(
    ownerId: string,
    limit = 50,
): Promise<
    Array<{
        id: string;
        examId: string;
        startedAt: string;
        completedAt: string | null;
        lastQNo: number | null;
    }>
> {
    const db = getDb();
    const rows = await db
        .select()
        .from(learningSessions)
        .where(eq(learningSessions.ownerId, ownerId))
        .orderBy(learningSessions.startedAt)
        .limit(limit);
    return rows.map((r) => ({
        id: r.id,
        examId: r.examId,
        startedAt: r.startedAt,
        completedAt: r.completedAt ?? null,
        lastQNo: r.lastQNo ?? null,
    }));
}
