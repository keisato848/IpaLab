/**
 * SQLite スキーマ（詳細設計 26_AndroidPlayDetailedDesign.md §7）
 * - Token は保存しない（SecureStore のみ）
 * - learning_events は追記専用の端末側正本
 * - 検索対象はJSONに埋めず正規カラムを持つ
 */
import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';

/** 現在ユーザーの非機密情報 */
export const appUsers = sqliteTable('app_users', {
    id: text('id').primaryKey(),
    displayName: text('display_name'),
    authType: text('auth_type', { enum: ['oauth', 'guest'] }).notNull(),
    provider: text('provider'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
});

export const exams = sqliteTable(
    'exams',
    {
        id: text('id').primaryKey(),
        year: integer('year').notNull(),
        type: text('type').notNull(),
        category: text('category').notNull(),
        title: text('title').notNull(),
        questionCount: integer('question_count').notNull(),
        contentHash: text('content_hash'),
        downloadState: text('download_state', {
            enum: ['not_downloaded', 'downloading', 'downloaded', 'corrupted'],
        })
            .notNull()
            .default('not_downloaded'),
        updatedAt: text('updated_at').notNull(),
    },
    (t) => [index('idx_exams_download_state').on(t.downloadState), index('idx_exams_updated_at').on(t.updatedAt)]
);

export const questions = sqliteTable(
    'questions',
    {
        id: text('id').primaryKey(),
        examId: text('exam_id')
            .notNull()
            .references(() => exams.id),
        qNo: integer('q_no').notNull(),
        category: text('category'),
        questionText: text('question_text').notNull(),
        choicesJson: text('choices_json'),
        correctAnswer: text('correct_answer'),
        explanation: text('explanation'),
    },
    (t) => [uniqueIndex('uq_questions_exam_qno').on(t.examId, t.qNo)]
);

export const learningSessions = sqliteTable(
    'learning_sessions',
    {
        id: text('id').primaryKey(),
        ownerId: text('owner_id').notNull(),
        examId: text('exam_id').notNull(),
        startedAt: text('started_at').notNull(),
        completedAt: text('completed_at'),
        lastQNo: integer('last_q_no'),
    },
    (t) => [index('idx_sessions_owner_started').on(t.ownerId, t.startedAt)]
);

/** 学習履歴の追記型正本 */
export const learningEvents = sqliteTable(
    'learning_events',
    {
        eventId: text('event_id').primaryKey(),
        ownerId: text('owner_id').notNull(),
        sessionId: text('session_id'),
        type: text('type').notNull(),
        occurredAt: text('occurred_at').notNull(),
        payloadJson: text('payload_json').notNull(),
        schemaVersion: integer('schema_version').notNull().default(1),
    },
    (t) => [index('idx_events_owner_occurred').on(t.ownerId, t.occurredAt)]
);

export const studyPlans = sqliteTable('study_plans', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    version: integer('version').notNull(),
    planJson: text('plan_json').notNull(),
    syncStatus: text('sync_status', { enum: ['synced', 'dirty', 'conflict'] })
        .notNull()
        .default('synced'),
    updatedAt: text('updated_at').notNull(),
});

/** Outbox（詳細設計§8: 回答保存と同一トランザクションで追加） */
export const outboxEvents = sqliteTable(
    'outbox_events',
    {
        eventId: text('event_id').primaryKey(),
        ownerId: text('owner_id').notNull(),
        state: text('state', {
            enum: ['pending', 'in_flight', 'acknowledged', 'conflict', 'dead_letter', 'retry_wait'],
        })
            .notNull()
            .default('pending'),
        attemptCount: integer('attempt_count').notNull().default(0),
        nextAttemptAt: text('next_attempt_at'),
        leaseUntil: text('lease_until'),
        acknowledgedAt: text('acknowledged_at'),
        createdAt: text('created_at').notNull(),
    },
    (t) => [index('idx_outbox_state_next').on(t.state, t.nextAttemptAt), index('idx_outbox_created').on(t.createdAt)]
);

export const syncCursors = sqliteTable('sync_cursors', {
    scope: text('scope').primaryKey(),
    cursor: text('cursor'),
    contentVersion: text('content_version'),
    updatedAt: text('updated_at').notNull(),
});

export const syncConflicts = sqliteTable('sync_conflicts', {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    reason: text('reason').notNull(),
    serverDataJson: text('server_data_json'),
    resolvedAt: text('resolved_at'),
    createdAt: text('created_at').notNull(),
});

/** ゲスト統合の再開・完了保証（詳細設計§5.3: 完了ACKまでローカル削除禁止） */
export const guestMerges = sqliteTable('guest_merges', {
    mergeId: text('merge_id').primaryKey(),
    guestId: text('guest_id').notNull(),
    targetUserId: text('target_user_id').notNull(),
    state: text('state', { enum: ['pending', 'requested', 'completed', 'rejected'] })
        .notNull()
        .default('pending'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull(),
});

/** コンテンツ原子入替用ステージング（詳細設計§8: hash検証後に切替） */
export const contentStaging = sqliteTable(
    'content_staging',
    {
        examId: text('exam_id').notNull(),
        qNo: integer('q_no').notNull(),
        dataJson: text('data_json').notNull(),
        contentHash: text('content_hash').notNull(),
        stagedAt: text('staged_at').notNull(),
    },
    (t) => [primaryKey({ columns: [t.examId, t.qNo] })]
);

export const schemaMetadata = sqliteTable('schema_metadata', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});
