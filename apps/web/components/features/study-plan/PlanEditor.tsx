'use client';

/**
 * StudyPlan 編集UI (#189 Phase 1 + #211 Phase 2)
 *
 * Phase 1: カレンダー上のセルをクリック → 通常 / 休 / 集 をローテーション切替
 * Phase 2 (#211): タスクを D&D で別日へ移動。a11y フォールバックとして「移動」ボタン
 *                 → 日付選択ダイアログを提供。
 *
 * - 編集が入るたびに `applyEditState` で plan を書き換え、
 *   `POST /api/study-plan/replan` を `manualMoves` 付きで呼んで diff プレビュー
 * - 「適用」で localStorage('studyPlans') / サーバを更新
 * - Undo/Redo は最大 5 ステップ、Ctrl+Z / Ctrl+Shift+Z 対応
 *
 * 設計書: docs/02_design/21_StudyPlanEditUI.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './PlanEditor.module.css';
import {
    applyEditState,
    cycleEditMode,
    listAllDates,
    type EditMode,
} from '@/lib/study-plan/planEditActions';
import {
    EMPTY_EDITOR_STATE,
    hasAnyEdit,
    manualMovesFromState,
    setMode,
    setMove,
    clearMove,
    type EditorState,
} from '@/lib/study-plan/editorState';
import { useUndoRedo } from '@/lib/study-plan/useUndoRedo';
import type { StudyPlan, DailyTask } from '@/lib/types/studyPlan';

interface ReplanResult {
    plan: StudyPlan;
    diff: {
        moved: { fromDate: string; toDate: string; questionCount: number; reason: string }[];
        overflowed: { fromDate: string; questionCount: number; reason: string }[];
        totalDebtQuestions: number;
        redistributedQuestions: number;
        manualMovesApplied?: number;
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
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const end = new Date(last);
    end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

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
    const editHistory = useUndoRedo<EditorState>(EMPTY_EDITOR_STATE);
    const editor = editHistory.present;

    const [preview, setPreview] = useState<ReplanResult | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [draggingDate, setDraggingDate] = useState<string | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [moveDialogFor, setMoveDialogFor] = useState<string | null>(null);
    const moveDialogSelectRef = useRef<HTMLSelectElement | null>(null);

    const dateMap = useMemo(() => buildDateMap(plan), [plan]);
    const allDates = useMemo(() => listAllDates(plan), [plan]);
    const calendarDates = useMemo(() => buildCalendarDates(allDates), [allDates]);

    // 編集後 plan: modes (rest/focus) のみ反映。moves はプレビュー API 側で処理
    const editedPlan = useMemo(() => applyEditState(plan, editor.modes), [plan, editor.modes]);

    const hasEdits = hasAnyEdit(editor);

    /** モードトグル: normal -> rest -> focus -> normal */
    const handleCellClick = useCallback(
        (date: string) => {
            if (!dateMap.has(date)) return;
            const currentMode: EditMode = editor.modes[date] ?? 'normal';
            const newMode = cycleEditMode(currentMode);
            editHistory.set(setMode(editor, date, newMode));
        },
        [dateMap, editor, editHistory],
    );

    // --- D&D ハンドラ ----------------------------------------------------------
    const handleDragStart = useCallback((date: string, e: React.DragEvent) => {
        if (!dateMap.has(date)) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', date);
        setDraggingDate(date);
    }, [dateMap]);

    const handleDragEnd = useCallback(() => {
        setDraggingDate(null);
        setDragOverDate(null);
    }, []);

    const handleDragOver = useCallback((date: string, e: React.DragEvent) => {
        if (!dateMap.has(date)) return;
        if (draggingDate && draggingDate !== date) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverDate(date);
        }
    }, [dateMap, draggingDate]);

    const handleDrop = useCallback((date: string, e: React.DragEvent) => {
        e.preventDefault();
        const fromDate = e.dataTransfer.getData('text/plain') || draggingDate;
        setDraggingDate(null);
        setDragOverDate(null);
        if (!fromDate || fromDate === date) return;
        if (!dateMap.has(date) || !dateMap.has(fromDate)) return;
        editHistory.set(setMove(editor, fromDate, date));
    }, [dateMap, draggingDate, editor, editHistory]);

    // --- 移動ダイアログ (a11y フォールバック) -----------------------------------
    const openMoveDialog = useCallback((date: string) => {
        setMoveDialogFor(date);
    }, []);
    const closeMoveDialog = useCallback(() => {
        setMoveDialogFor(null);
    }, []);
    useEffect(() => {
        if (moveDialogFor && moveDialogSelectRef.current) {
            moveDialogSelectRef.current.focus();
        }
    }, [moveDialogFor]);
    const confirmMoveDialog = useCallback(() => {
        if (!moveDialogFor) return;
        const select = moveDialogSelectRef.current;
        if (!select) return;
        const toDate = select.value;
        if (!toDate || toDate === moveDialogFor) {
            closeMoveDialog();
            return;
        }
        editHistory.set(setMove(editor, moveDialogFor, toDate));
        closeMoveDialog();
    }, [moveDialogFor, editor, editHistory, closeMoveDialog]);

    /** プレビュー: replan API 呼び出し */
    const requestPreview = useCallback(async () => {
        setPreviewing(true);
        setError(null);
        try {
            const res = await fetch('/api/study-plan/replan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: editedPlan,
                    manualMoves: manualMovesFromState(editor),
                }),
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
    }, [editedPlan, editor]);

    const handleApply = useCallback(() => {
        if (!preview) return;
        onApply?.(preview.plan);
        editHistory.reset(EMPTY_EDITOR_STATE);
        setPreview(null);
        setShowModal(false);
    }, [preview, onApply, editHistory]);

    const handleCancelPreview = useCallback(() => {
        setShowModal(false);
    }, []);

    // モーダル: Esc で閉じる
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showModal) setShowModal(false);
                if (moveDialogFor) closeMoveDialog();
            }
        };
        if (showModal || moveDialogFor) {
            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        }
        return undefined;
    }, [showModal, moveDialogFor, closeMoveDialog]);

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
                    onClick={() => editHistory.reset(EMPTY_EDITOR_STATE)}
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
                    クリックで切替 / ドラッグで別日へ移動
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
                    const mode: EditMode = editor.modes[date] ?? 'normal';
                    if (!task) {
                        return <div key={date} className={`${styles.cell} ${styles.cellEmpty}`} aria-hidden="true" />;
                    }
                    const dayNum = Number(date.slice(-2));
                    const baseline = task.questionCount;
                    const adjusted =
                        mode === 'rest' ? 0 : mode === 'focus' ? Math.round(baseline * 1.5) : baseline;
                    const movedTo = editor.moves[date];
                    const isDragging = draggingDate === date;
                    const isDragOver = dragOverDate === date;
                    const cellClass = [
                        styles.cell,
                        mode === 'rest' ? styles.cellRest : '',
                        mode === 'focus' ? styles.cellFocus : '',
                        isDragOver ? styles.cellDragOver : '',
                        isDragging ? styles.cellDragging : '',
                    ]
                        .filter(Boolean)
                        .join(' ');
                    const wd = WEEKDAYS[weekdayIndex(date)];
                    const ariaLabel = `${date} ${wd}曜日、現在 ${adjusted} 問${
                        mode === 'rest' ? '（休日）' : mode === 'focus' ? '（集中日）' : ''
                    }${movedTo ? `、${movedTo} へ移動予定` : ''}、クリックで切替、移動ボタンで別日へ移動`;
                    return (
                        <div
                            key={date}
                            className={cellClass}
                            role="gridcell"
                            draggable
                            onDragStart={(e) => handleDragStart(date, e)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(date, e)}
                            onDragLeave={() => setDragOverDate(null)}
                            onDrop={(e) => handleDrop(date, e)}
                        >
                            <button
                                type="button"
                                className={styles.moveButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openMoveDialog(date);
                                }}
                                aria-label={`${date} のタスクを別日へ移動`}
                            >
                                移動
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCellClick(date)}
                                aria-label={ariaLabel}
                                aria-pressed={mode !== 'normal'}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                }}
                            >
                                <span className={styles.cellDate}>{dayNum}日 ({wd})</span>
                                <span className={styles.cellCount}>{adjusted} 問</span>
                                {mode === 'rest' && (
                                    <span className={`${styles.cellMode} ${styles.cellModeRest}`}>休日</span>
                                )}
                                {mode === 'focus' && (
                                    <span className={`${styles.cellMode} ${styles.cellModeFocus}`}>集中</span>
                                )}
                                {movedTo && (
                                    <span className={styles.cellMode} style={{ color: '#1d4ed8' }}>
                                        → {movedTo.slice(5)}
                                    </span>
                                )}
                            </button>
                            {movedTo && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        editHistory.set(clearMove(editor, date));
                                    }}
                                    aria-label={`${date} の移動をキャンセル`}
                                    style={{
                                        position: 'absolute',
                                        bottom: 2,
                                        right: 2,
                                        fontSize: 10,
                                        padding: '1px 4px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 3,
                                        background: 'rgba(255,255,255,0.9)',
                                        cursor: 'pointer',
                                        lineHeight: 1,
                                    }}
                                >
                                    取消
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {moveDialogFor && (
                <div
                    className={styles.modalBackdrop}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="move-dialog-title"
                    onClick={closeMoveDialog}
                >
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className={styles.modalHeader}>
                            <h3 id="move-dialog-title" className={styles.modalTitle}>
                                タスク移動: {moveDialogFor}
                            </h3>
                        </div>
                        <p style={{ fontSize: 13, color: '#374151' }}>
                            この日のタスクを移動する先の日付を選択してください。
                        </p>
                        <label style={{ display: 'block', marginTop: 12 }}>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>移動先</span>
                            <select
                                ref={moveDialogSelectRef}
                                defaultValue={editor.moves[moveDialogFor] ?? ''}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    marginTop: 4,
                                    padding: '6px 8px',
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
                                }}
                                aria-label="移動先の日付"
                            >
                                <option value="">選択してください</option>
                                {allDates
                                    .filter((d) => d !== moveDialogFor)
                                    .map((d) => (
                                        <option key={d} value={d}>
                                            {d} ({WEEKDAYS[weekdayIndex(d)]})
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.button} onClick={closeMoveDialog}>
                                キャンセル
                            </button>
                            <button
                                type="button"
                                className={`${styles.button} ${styles.primary}`}
                                onClick={confirmMoveDialog}
                            >
                                移動する
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                {preview.diff.manualMovesApplied !== undefined && preview.diff.manualMovesApplied > 0 && (
                                    <span style={{ marginLeft: 12, color: '#1d4ed8' }}>
                                        手動移動: {preview.diff.manualMovesApplied} 件
                                    </span>
                                )}
                            </div>
                        </div>

                        {preview.diff.moved.length > 0 && (
                            <div className={styles.diffSection}>
                                <div className={styles.diffSectionTitle}>移動 ({preview.diff.moved.length} 件)</div>
                                <ul className={styles.diffList}>
                                    {preview.diff.moved.slice(0, 30).map((m, i) => (
                                        <li key={i}>
                                            {m.fromDate} → {m.toDate}: {m.questionCount} 問
                                            {m.reason === 'manual_move' && (
                                                <span style={{ marginLeft: 8, color: '#1d4ed8', fontSize: 11 }}>
                                                    [手動]
                                                </span>
                                            )}
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
