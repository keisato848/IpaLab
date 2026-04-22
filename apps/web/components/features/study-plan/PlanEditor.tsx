'use client';

/**
 * StudyPlan 編集UI Phase 1 (#189)
 *
 * - カレンダー上のセルをクリック → 通常 / 休 / 集 をローテーション切替
 * - トグルが入るたびに `applyEditState` で plan を書き換え、
 *   `POST /api/study-plan/replan` を呼んで diff プレビュー表示
 * - 「適用」で localStorage('studyPlans') を更新（リロード後も維持）
 * - Undo/Redo は最大 5 ステップ、Ctrl+Z / Ctrl+Shift+Z 対応
 *
 * 設計書: docs/02_design/21_StudyPlanEditUI.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './PlanEditor.module.css';
import {
    applyEditState,
    cycleEditMode,
    listAllDates,
    type EditMode,
    type EditState,
} from '@/lib/study-plan/planEditActions';
import { useUndoRedo } from '@/lib/study-plan/useUndoRedo';
import type { StudyPlan, DailyTask } from '@/lib/types/studyPlan';

interface ReplanResult {
    plan: StudyPlan;
    diff: {
        moved: { fromDate: string; toDate: string; questionCount: number; reason: string }[];
        overflowed: { fromDate: string; questionCount: number; reason: string }[];
        totalDebtQuestions: number;
        redistributedQuestions: number;
    };
    warnings?: string[];
}

interface Props {
    plan: StudyPlan;
    /** 「適用」が押されたとき呼ばれる。新しい plan を localStorage 等に保存する責務は呼び出し側 */
    onApply?: (newPlan: StudyPlan) => void;
    /** 「キャンセル」が押されたとき呼ばれる（編集モード解除など） */
    onCancel?: () => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function weekdayIndex(date: string): number {
    return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function buildDateMap(plan: StudyPlan): Map<string, DailyTask> {
    const map = new Map<string, DailyTask>();
    for (const week of plan.weeklySchedule) {
        for (const task of week.dailyTasks ?? []) {
            map.set(task.date, task);
        }
    }
    return map;
}

/** 連続するカレンダー grid（最初の週の日曜から、最後の週の土曜まで）を作る */
function buildCalendarDates(allDates: string[]): string[] {
    if (allDates.length === 0) return [];
    const first = new Date(`${allDates[0]}T00:00:00Z`);
    const last = new Date(`${allDates[allDates.length - 1]}T00:00:00Z`);

    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // back to Sunday

    const end = new Date(last);
    end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay())); // forward to Saturday

    const result: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
        result.push(
            `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(
                cur.getUTCDate(),
            ).padStart(2, '0')}`,
        );
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return result;
}

export default function PlanEditor({ plan, onApply, onCancel }: Props) {
    const editHistory = useUndoRedo<EditState>({});
    const edits = editHistory.present;

    const [preview, setPreview] = useState<ReplanResult | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    const dateMap = useMemo(() => buildDateMap(plan), [plan]);
    const allDates = useMemo(() => listAllDates(plan), [plan]);
    const calendarDates = useMemo(() => buildCalendarDates(allDates), [allDates]);

    const editedPlan = useMemo(() => applyEditState(plan, edits), [plan, edits]);

    const hasEdits = Object.keys(edits).length > 0;

    /** トグル: normal -> rest -> focus -> normal */
    const handleCellClick = useCallback(
        (date: string) => {
            if (!dateMap.has(date)) return;
            const next: EditState = { ...edits };
            const newMode = cycleEditMode(next[date]);
            if (newMode === 'normal') delete next[date];
            else next[date] = newMode;
            editHistory.set(next);
        },
        [dateMap, edits, editHistory],
    );

    /** プレビュー: replan API 呼び出し */
    const requestPreview = useCallback(async () => {
        setPreviewing(true);
        setError(null);
        try {
            const res = await fetch('/api/study-plan/replan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: editedPlan }),
            });
            if (res.status === 401) {
                throw new Error('プレビューにはログインが必要です');
            }
            if (!res.ok) {
                throw new Error(`プレビュー取得に失敗しました (HTTP ${res.status})`);
            }
            const data = (await res.json()) as ReplanResult;
            setPreview(data);
            setShowModal(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : '不明なエラー');
            setPreview(null);
        } finally {
            setPreviewing(false);
        }
    }, [editedPlan]);

    const handleApply = useCallback(() => {
        if (!preview) return;
        onApply?.(preview.plan);
        editHistory.reset({});
        setPreview(null);
        setShowModal(false);
    }, [preview, onApply, editHistory]);

    const handleCancelPreview = useCallback(() => {
        setShowModal(false);
    }, []);

    // モーダル: Esc で閉じる
    useEffect(() => {
        if (!showModal) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowModal(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [showModal]);

    if (allDates.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.warning} role="status">
                    この計画には編集可能な日次タスクがありません。詳細タスクが生成された計画を選択してください。
                </div>
                {onCancel && (
                    <button
                        type="button"
                        className={`${styles.button} ${styles.danger}`}
                        onClick={onCancel}
                        style={{ alignSelf: 'flex-start' }}
                    >
                        編集を終了
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                <span className={styles.toolbarLabel}>編集モード</span>
                <button
                    type="button"
                    className={styles.button}
                    onClick={editHistory.undo}
                    disabled={!editHistory.canUndo}
                    aria-label="元に戻す (Ctrl+Z)"
                >
                    ↶ 元に戻す
                </button>
                <button
                    type="button"
                    className={styles.button}
                    onClick={editHistory.redo}
                    disabled={!editHistory.canRedo}
                    aria-label="やり直し (Ctrl+Shift+Z)"
                >
                    ↷ やり直し
                </button>
                <button
                    type="button"
                    className={styles.button}
                    onClick={() => editHistory.reset({})}
                    disabled={!hasEdits}
                >
                    リセット
                </button>
                <span style={{ flex: 1 }} />
                <button
                    type="button"
                    className={`${styles.button} ${styles.primary}`}
                    onClick={requestPreview}
                    disabled={!hasEdits || previewing}
                >
                    {previewing ? 'プレビュー中…' : '変更をプレビュー'}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        className={`${styles.button} ${styles.danger}`}
                        onClick={onCancel}
                    >
                        編集を終了
                    </button>
                )}
            </div>

            <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: '#ffffff' }} /> 通常
                </span>
                <span className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: '#fef2f2', borderColor: '#fca5a5' }} /> 休
                </span>
                <span className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: '#fef3c7', borderColor: '#fbbf24' }} /> 集中
                </span>
                <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>
                    クリックで切替（通常 → 休 → 集中 → 通常）
                </span>
            </div>

            {error && <div className={styles.error} role="alert">{error}</div>}

            <div className={styles.calendarGrid} role="grid" aria-label="学習計画カレンダー">
                {WEEKDAYS.map((w) => (
                    <div key={w} className={styles.weekdayHeader} role="columnheader">
                        {w}
                    </div>
                ))}
                {calendarDates.map((date) => {
                    const task = dateMap.get(date);
                    const mode: EditMode = edits[date] ?? 'normal';
                    if (!task) {
                        return <div key={date} className={`${styles.cell} ${styles.cellEmpty}`} aria-hidden="true" />;
                    }
                    const dayNum = Number(date.slice(-2));
                    const baseline = task.questionCount;
                    const adjusted =
                        mode === 'rest' ? 0 : mode === 'focus' ? Math.round(baseline * 1.5) : baseline;
                    const cellClass = [
                        styles.cell,
                        mode === 'rest' ? styles.cellRest : '',
                        mode === 'focus' ? styles.cellFocus : '',
                    ]
                        .filter(Boolean)
                        .join(' ');
                    const wd = WEEKDAYS[weekdayIndex(date)];
                    const ariaLabel = `${date} ${wd}曜日、現在 ${adjusted} 問${
                        mode === 'rest' ? '（休日）' : mode === 'focus' ? '（集中日）' : ''
                    }、クリックで切替`;
                    return (
                        <button
                            key={date}
                            type="button"
                            className={cellClass}
                            onClick={() => handleCellClick(date)}
                            aria-label={ariaLabel}
                            aria-pressed={mode !== 'normal'}
                        >
                            <span className={styles.cellDate}>{dayNum}日 ({wd})</span>
                            <span className={styles.cellCount}>{adjusted} 問</span>
                            {mode === 'rest' && (
                                <span className={`${styles.cellMode} ${styles.cellModeRest}`}>休日</span>
                            )}
                            {mode === 'focus' && (
                                <span className={`${styles.cellMode} ${styles.cellModeFocus}`}>集中</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {showModal && preview && (
                <div
                    className={styles.modalBackdrop}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="replan-preview-title"
                    onClick={handleCancelPreview}
                >
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 id="replan-preview-title" className={styles.modalTitle}>
                                再計画プレビュー
                            </h3>
                        </div>

                        {preview.warnings && preview.warnings.length > 0 && (
                            <div className={styles.warning}>
                                <strong>注意:</strong>
                                <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                                    {preview.warnings.map((w, i) => (
                                        <li key={i}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className={styles.diffSection}>
                            <div className={styles.diffSectionTitle}>
                                総再配分量: {preview.diff.redistributedQuestions} / {preview.diff.totalDebtQuestions} 問
                            </div>
                        </div>

                        {preview.diff.moved.length > 0 && (
                            <div className={styles.diffSection}>
                                <div className={styles.diffSectionTitle}>移動 ({preview.diff.moved.length} 件)</div>
                                <ul className={styles.diffList}>
                                    {preview.diff.moved.slice(0, 30).map((m, i) => (
                                        <li key={i}>
                                            {m.fromDate} → {m.toDate}: {m.questionCount} 問
                                        </li>
                                    ))}
                                    {preview.diff.moved.length > 30 && (
                                        <li>...他 {preview.diff.moved.length - 30} 件</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {preview.diff.overflowed.length > 0 && (
                            <div className={styles.diffSection}>
                                <div className={styles.diffSectionTitle}>
                                    収まりきらない分 ({preview.diff.overflowed.length} 件)
                                </div>
                                <ul className={styles.diffList}>
                                    {preview.diff.overflowed.map((o, i) => (
                                        <li key={i}>
                                            {o.fromDate}: {o.questionCount} 問 ({o.reason})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.button}
                                onClick={handleCancelPreview}
                            >
                                やめる
                            </button>
                            <button
                                type="button"
                                className={`${styles.button} ${styles.primary}`}
                                onClick={handleApply}
                            >
                                適用
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
