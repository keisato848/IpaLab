'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LearningRecord, getLearningRecords, getQuestions, getExams, StudyPlanJob, Question, listStudyPlans, upsertStudyPlan, migrateLocalStudyPlansToServer } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { getExamLabel } from '@/lib/exam-utils';
import ThemeToggle from '@/components/common/ThemeToggle';
import { useUserProgress } from '@/hooks/useUserProgress';
import { useMonthlyProgress, createDefaultMonthlyGoals } from '@/hooks/useMonthlyProgress';
import { useMonthlyStats } from '@/hooks/useMonthlyStats';
import GoalSettingWizard, { StudyPlan, MonthlyGoal } from './GoalSettingWizard';
import MonthlyGoalEditor from './MonthlyGoalEditor';
import PerformanceInsights from './PerformanceInsights';
import PlanHealthToast from './PlanHealthToast';
import PlanReadyNotification from './PlanReadyNotification';
import { usePlanHealthCheck } from '@/hooks/usePlanHealthCheck';
import styles from './DashboardClient.module.css';

// PR-E: 重い可視化コンポーネントは dynamic import で遅延ロード（First Load JS 削減）
const HeatmapWidget = dynamic(() => import('./HeatmapWidget'), {
    ssr: false,
    loading: () => <div style={{ minHeight: 160, opacity: 0.5 }}>読み込み中...</div>,
});
const MonthlyProgressCard = dynamic(() => import('./MonthlyProgressCard'), {
    ssr: false,
    loading: () => <div style={{ minHeight: 120, opacity: 0.5 }}>読み込み中...</div>,
});

export default function DashboardClient() {
    const { data: session, status } = useSession();
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // #221 計画ヘルスチェック (認証済みユーザのみ)
    const { health: planHealth, visible: planHealthVisible, dismiss: dismissPlanHealth } =
        usePlanHealthCheck({
            userId: session?.user?.id ?? '',
            enabled: status === 'authenticated',
        });

    // Goal Setting State
    const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
    const [allPlans, setAllPlans] = useState<StudyPlan[]>([]);
    const [showWizard, setShowWizard] = useState(false);
    const [pendingJob, setPendingJob] = useState<StudyPlanJob | null>(null);

    // Mission Question List State
    const [showMissionQuestions, setShowMissionQuestions] = useState(false);
    const [missionQuestions, setMissionQuestions] = useState<{ examId: string; qNo: number; category: string; text: string }[]>([]);
    const [missionQuestionsLoading, setMissionQuestionsLoading] = useState(false);
    // Monthly Goal Editor State
    const [showGoalEditor, setShowGoalEditor] = useState(false);

    // Collapsible sections (persisted in localStorage)
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    useEffect(() => {
        try {
            const raw = localStorage.getItem('dashboard:collapsedSections');
            if (raw) setCollapsedSections(JSON.parse(raw));
        } catch {}
    }, []);
    const toggleSection = (id: string) => {
        setCollapsedSections(prev => {
            const next = { ...prev, [id]: !prev[id] };
            try { localStorage.setItem('dashboard:collapsedSections', JSON.stringify(next)); } catch {}
            return next;
        });
    };
    const renderCollapseToggle = (id: string, label: string, variant?: 'light') => {
        const isCollapsed = !!collapsedSections[id];
        return (
            <button
                type="button"
                className={`${styles.collapseToggle}${variant === 'light' ? ' ' + styles.collapseToggleLight : ''}`}
                aria-expanded={!isCollapsed}
                aria-controls={`section-body-${id}`}
                aria-label={isCollapsed ? `${label}を展開` : `${label}を折りたたむ`}
                title={isCollapsed ? '展開' : '折りたたむ'}
                onClick={() => toggleSection(id)}
            >
                {isCollapsed ? '▶' : '▼'}
            </button>
        );
    };
    const {
        progress,
        achievements,
        levelInfo,
        achievementTotal,
        completeMission,
        updateAchievementProgress,
        lastMissionReward,
        lastLevelUp,
        clearMissionReward,
        clearLevelUp
    } = useUserProgress();

    const userName = session?.user?.name || "ゲスト";

    // 1. Load Data & Plan
    // 1. Load Data
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                let fetchedRecords: LearningRecord[] = [];
                if (status === 'authenticated' && session?.user?.id) {
                    fetchedRecords = await getLearningRecords(session.user.id);
                } else {
                    fetchedRecords = guestManager.getHistory();
                }
                // Filter out records with invalid or missing answeredAt
                const validRecords = fetchedRecords
                    .filter(r => r && r.answeredAt)
                    .map(r => ({
                        ...r,
                        // Defensive normalization of examId to avoid propagating unexpected characters into URLs
                        examId: typeof r.examId === 'string'
                            ? r.examId.replace(/[^A-Za-z0-9_-]/g, '')
                            : r.examId,
                    }));
                // Sort by answeredAt desc
                validRecords.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
                setRecords(validRecords);
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            } finally {
                setLoading(false);
            }
        }

        if (status !== 'loading') {
            loadData();
        }
    }, [status, session]);

    // 2. Load Plan & Check URL Action
    useEffect(() => {
        let cancelled = false;

        const hydrateFromPlans = (allPlans: StudyPlan[]) => {
            if (cancelled) return;
            setAllPlans(allPlans);
            if (allPlans.length === 0) return;
            const sorted = [...allPlans].sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
            const future = sorted.filter(p => new Date(p.examDate) >= new Date(new Date().setHours(0, 0, 0, 0)));
            let active = future.length > 0 ? future[0] : sorted[sorted.length - 1];
            if (active && !active.monthlyGoals) {
                const defaults = createDefaultMonthlyGoals(active.weeklySchedule || []);
                active = { ...active, monthlyGoals: defaults };
                const updatedPlans = allPlans.map(p => p.id === active.id ? active : p);
                localStorage.setItem('studyPlans', JSON.stringify(updatedPlans));
                setAllPlans(updatedPlans);
                // 認証ユーザーは server にも反映（best-effort, 非同期）
                if (status === 'authenticated') {
                    upsertStudyPlan(active).catch(() => {});
                }
            }
            setStudyPlan(active);
        };

        const loadFromLocalStorage = (): StudyPlan[] => {
            const savedPlansStr = localStorage.getItem('studyPlans');
            if (savedPlansStr) {
                try {
                    return JSON.parse(savedPlansStr);
                } catch (e) {
                    console.error("Failed to parse studyPlans", e);
                    return [];
                }
            }
            // legacy single plan migration
            const legacyPlanStr = localStorage.getItem('studyPlan');
            if (legacyPlanStr) {
                try {
                    const legacyPlan = JSON.parse(legacyPlanStr);
                    if (!legacyPlan.id) legacyPlan.id = crypto.randomUUID();
                    const arr = [legacyPlan];
                    localStorage.setItem('studyPlans', JSON.stringify(arr));
                    return arr;
                } catch (e) {
                    console.error("Failed to migrate legacy plan", e);
                }
            }
            return [];
        };

        const run = async () => {
            // 1) 認証済み: localStorage → server へ一括移行（初回のみ）
            //    その後 server → state、エラー時は localStorage へフォールバック
            if (status === 'authenticated' && session?.user?.id) {
                await migrateLocalStudyPlansToServer(session.user.id);
                const fromServer = await listStudyPlans();
                if (cancelled) return;
                if (fromServer) {
                    // server が正本。localStorage はオフラインフォールバック用に同期更新
                    localStorage.setItem('studyPlans', JSON.stringify(fromServer));
                    hydrateFromPlans(fromServer);
                    return;
                }
                // server エラー → localStorage フォールバック
            }
            // 2) 未認証 / フォールバック: localStorage 経路
            hydrateFromPlans(loadFromLocalStorage());
        };

        run();

        // Check query param for replan trigger
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'replan') {
            setShowWizard(true);
            window.history.replaceState({}, '', '/dashboard');
        }

        return () => { cancelled = true; };
    }, [status, session?.user?.id]);

    // 2.5. Check for pending completed jobs (async job notification)
    useEffect(() => {
        async function checkPendingJobs() {
            if (status !== 'authenticated') return;
            
            try {
                const res = await fetch('/api/ai/jobs/pending');
                if (res.ok) {
                    const jobs = await res.json();
                    if (jobs && jobs.length > 0) {
                        // Show notification for the most recent completed job
                        setPendingJob(jobs[0]);
                    }
                }
            } catch (e) {
                console.error('Failed to check pending jobs:', e);
            }
        }

        checkPendingJobs();
    }, [status]);

    // Handle async job created callback
    const handleAsyncJobCreated = (jobId: string) => {
        console.log('Async job created:', jobId);
        setShowWizard(false);
        // Could show a toast notification here
    };

    // Handle applying plan from notification
    const handleApplyPlanFromNotification = (planData: any) => {
        const plan: StudyPlan = {
            ...planData,
            id: crypto.randomUUID(),
        };
        handleSavePlan(plan);
        setPendingJob(null);
    };

    // Handle dismissing notification
    const handleDismissNotification = () => {
        setPendingJob(null);
    };

    const handleSavePlan = (plan: StudyPlan) => {
        // 新規プランに定量目標がなければデフォルトを自動付与
        if (!plan.monthlyGoals) {
            plan = { ...plan, monthlyGoals: createDefaultMonthlyGoals(plan.weeklySchedule || []) };
        }
        setStudyPlan(plan);
        // Save to array
        const allPlansStr = localStorage.getItem('studyPlans');
        let allPlans: StudyPlan[] = allPlansStr ? JSON.parse(allPlansStr) : [];

        // Current Wizard generates NEW ID every time. Append for history.
        allPlans.push(plan);
        localStorage.setItem('studyPlans', JSON.stringify(allPlans));
        setAllPlans(allPlans);

        // Server 永続化 (#212): 認証済みなら best-effort で upsert
        if (status === 'authenticated') {
            upsertStudyPlan(plan).catch(() => {});
        }

        setShowWizard(false);
    };

    // 3. Stats & Goals Logic
    const todayStr = new Date().toISOString().split('T')[0];

    // -- Filter Records Logic --
    // Convert 'ALL' selection to a boolean check
    const isAllPlans = studyPlan?.id === 'ALL';

    // Heper to get targetExam from plan (handling legacy)
    const getTargetExam = (p: StudyPlan) => {
        if (p.targetExam) return p.targetExam;
        // Legacy fallback
        if (p.title.includes('基本情報') || p.title.includes('FE')) return 'FE';
        if (p.title.includes('応用情報') || p.title.includes('AP')) return 'AP';
        if (p.title.includes('セキュ') || p.title.includes('SC')) return 'SC';
        if (p.title.includes('プロマネ') || p.title.includes('PM')) return 'PM';
        if (p.title.includes('ネット') || p.title.includes('NW')) return 'NW';
        if (p.title.includes('パスポート') || p.title.includes('IP')) return 'IP';
        return '';
    };

    // Monthly Progress Hook - 定量目標の進捗計算
    const targetExamPrefix = (!isAllPlans && studyPlan) ? getTargetExam(studyPlan) : undefined;
    const monthlyProgress = useMonthlyProgress(
        studyPlan?.monthlyGoals,
        records,
        targetExamPrefix
    );

    // 月次統計（目標設定に依存しない定量サマリー）
    const monthlyStats = useMonthlyStats(records, targetExamPrefix);

    // 定量目標の保存ハンドラ
    const handleSaveMonthlyGoals = (goals: MonthlyGoal[], goalText: string) => {
        if (!studyPlan || isAllPlans) return;

        const updatedPlan: StudyPlan = {
            ...studyPlan,
            monthlyGoal: goalText,
            monthlyGoals: goals,
        };
        setStudyPlan(updatedPlan);

        // localStorageにも永続化
        const stored = localStorage.getItem('studyPlans');
        if (stored) {
            try {
                const plans: StudyPlan[] = JSON.parse(stored);
                const updated = plans.map(p => p.id === studyPlan.id ? updatedPlan : p);
                localStorage.setItem('studyPlans', JSON.stringify(updated));
                setAllPlans(updated);
            } catch (e) {
                console.error('Failed to persist monthly goals', e);
            }
        }
        setShowGoalEditor(false);
    };

    // Filter records: If isAllPlans, show all. Else filter by targetExam prefix AND date (start of plan).
    const filteredRecords = records.filter(r => {
        // Validate record has required fields
        if (!r || !r.answeredAt) return false;
        
        if (isAllPlans) return true;
        if (!studyPlan) return true;

        // 1. Exam Type Filter
        const target = getTargetExam(studyPlan);
        if (target && !r.examId?.startsWith(target)) return false;

        // 2. Date Filter (Scope to plan duration)
        // Use weeklySchedule start date (inclusive of the whole start day)
        // If missing, fallback to generatedAt (which might exclude earlier answers on same day, so prefer Schedule)
        const startDateStr = studyPlan.weeklySchedule?.[0]?.startDate;
        if (startDateStr) {
            // startDateStr is YYYY-MM-DD. 
            // We want to include everything from that day 00:00:00 onwards.
            // Since records are stored in UTC/ISO, we need safe comparison.
            // Simplest: Compare YYYY-MM-DD strings in local time? 
            // Records.answeredAt is ISO.
            // Let's assume startDateStr represents user's local start day.

            // Create Midnight Date object for Start Date
            const planStart = new Date(startDateStr);
            planStart.setHours(0, 0, 0, 0);

            const recordDate = new Date(r.answeredAt);
            if (recordDate < planStart) return false;
        } else if (studyPlan.generatedAt) {
            const genDate = new Date(studyPlan.generatedAt);
            // aggressive fallback: start of that day
            genDate.setHours(0, 0, 0, 0);
            const recordDate = new Date(r.answeredAt);
            if (recordDate < genDate) return false;
        }

        return true;
    });

    // ユニーク問題数（同一questionIdへの複数回解答を1件とカウント）
    const totalAnswered = new Set(records.map(r => r.questionId)).size;
    const categoryAccuracy = useMemo(() => {
        const categoryStats = new Map<string, { total: number; correct: number }>();
        records.forEach(record => {
            const category = record.category || 'unknown';
            const entry = categoryStats.get(category) || { total: 0, correct: 0 };
            entry.total += 1;
            if (record.isCorrect) entry.correct += 1;
            categoryStats.set(category, entry);
        });

        const accuracyMap: Record<string, number> = {};
        categoryStats.forEach((value, key) => {
            accuracyMap[key] = value.total > 0 ? value.correct / value.total : 0;
        });
        return accuracyMap;
    }, [records]);

    useEffect(() => {
        updateAchievementProgress({ totalAnswered, categoryAccuracy });
    }, [categoryAccuracy, totalAnswered, updateAchievementProgress]);

    // -- Goal Logic (ゲーミフィケーション対応) --
    let todayTargetCount = 10;
    let todayMissionTitle = "学習を進めましょう";
    let todayGoalLabel = "今日のミッションをクリアしよう！";
    let todayCategoryLabel = "全般";
    let todayDifficulty: 'easy' | 'normal' | 'hard' = 'normal';
    let todayXpReward = 30;
    let todayTaskCompleted = false;
    const todayGoalData = !isAllPlans
        ? studyPlan?.weeklySchedule?.flatMap(w => w.dailyTasks || [])?.filter(t => t)?.find(t => t.date === todayStr)
        : undefined;

    if (isAllPlans) {
        // Aggregate targets from all plans
        let totalCount = 0;
        let totalXp = 0;
        allPlans.forEach(p => {
            const tData = p.weeklySchedule?.flatMap(w => w.dailyTasks || [])?.filter(t => t)?.find(t => t.date === todayStr);
            if (tData) {
                totalCount += tData.questionCount;
                totalXp += tData.xpReward || 30;
            }
        });
        todayTargetCount = totalCount > 0 ? totalCount : 10;
        todayMissionTitle = "🎯 全計画合計ミッション";
        todayGoalLabel = "すべての計画のタスクを消化しよう";
        todayCategoryLabel = "合計";
        todayXpReward = totalXp || 50;
    } else {
        // Single Plan
        if (todayGoalData) {
            todayTargetCount = todayGoalData.questionCount;
            todayMissionTitle = todayGoalData.missionTitle || todayGoalData.goal || "今日のミッション";
            todayGoalLabel = todayGoalData.goal || "学習を進めましょう";
            todayCategoryLabel = todayGoalData.targetCategory || "全般";
            todayDifficulty = todayGoalData.difficulty || 'normal';
            todayXpReward = todayGoalData.xpReward || 30;
            todayTaskCompleted = todayGoalData.isCompleted || false;
        }
    }

    // Weekly Data (Only meaningful for single plan, or we could aggregate)
    const currentWeekData = !isAllPlans ? studyPlan?.weeklySchedule?.find(w =>
        todayStr >= w.startDate && todayStr <= w.endDate
    ) : null;

    // 週のテーマとゴール
    const weekTheme = currentWeekData?.theme || currentWeekData?.goal || "今週の学習";
    const weekGoal = currentWeekData?.goal || "週間目標未設定";

    const today = new Date().toDateString();
    const todayRecords = filteredRecords.filter(r => r && r.answeredAt && new Date(r.answeredAt).toDateString() === today);
    const todayCount = todayRecords.length;
    const progressPercent = Math.min(100, Math.round((todayCount / todayTargetCount) * 100));
    
    // ミッションクリア判定
    const isMissionComplete = todayCount >= todayTargetCount;

    useEffect(() => {
        if (!studyPlan || isAllPlans || !todayGoalData) return;
        if (!isMissionComplete || todayTaskCompleted) return;

        const result = completeMission({
            date: todayStr,
            planId: studyPlan.id,
            missionTitle: todayMissionTitle,
            baseXp: todayXpReward,
            metrics: {
                todayRecords: todayRecords.map(record => ({
                    isCorrect: record.isCorrect,
                    category: record.category
                })),
                totalAnswered,
                categoryAccuracy
            }
        });

        if (result.alreadyCompleted) return;

        const storedPlansStr = localStorage.getItem('studyPlans');
        if (!storedPlansStr) return;
        try {
            const parsedPlans: StudyPlan[] = JSON.parse(storedPlansStr);
            const updatedPlans = parsedPlans.map(plan => {
                if (plan.id !== studyPlan.id) return plan;
                return {
                    ...plan,
                    weeklySchedule: (plan.weeklySchedule || []).map(week => ({
                        ...week,
                        dailyTasks: (week.dailyTasks || []).map(task => {
                            if (!task || task.date !== todayStr) return task;
                            return { ...task, isCompleted: true };
                        })
                    }))
                };
            });
            localStorage.setItem('studyPlans', JSON.stringify(updatedPlans));
            setAllPlans(updatedPlans);
            const refreshed = updatedPlans.find(plan => plan.id === studyPlan.id) || studyPlan;
            setStudyPlan(refreshed);
            // #212: server にも反映（best-effort）
            if (status === 'authenticated') {
                upsertStudyPlan(refreshed).catch(() => {});
            }
        } catch (error) {
            console.error("Failed to update studyPlans completion state", error);
        }
    }, [
        studyPlan,
        isAllPlans,
        todayGoalData,
        isMissionComplete,
        todayTaskCompleted,
        todayStr,
        todayMissionTitle,
        todayXpReward,
        todayRecords,
        totalAnswered,
        categoryAccuracy,
        completeMission
    ]);

    // 難易度に応じたスタイル
    const getDifficultyStyle = (diff: string) => {
        switch (diff) {
            case 'easy': return { bg: '#22c55e', label: '🟢 Easy' };
            case 'hard': return { bg: '#ef4444', label: '🔴 Hard' };
            default: return { bg: '#f59e0b', label: '🟡 Normal' };
        }
    };

    // ミッション問題取得用ヘルパー: examIdからURL生成
    const getQuestionUrl = (examId: string, qNo: number): string => {
        // Ensure examId is in the expected internal format before building the URL
        const safeExamId = (examId || '').replace(/[^A-Za-z0-9_-]/g, '');
        const parts = safeExamId.split('-');
        const typeSuffix = parts[parts.length - 1] || '';
        const yearPart = parts.slice(0, -1).join('-');
        const typeUrl = typeSuffix === 'AM' ? 'AM1' : typeSuffix;
        return `/exam/${yearPart}/${typeUrl}/${qNo}?mode=practice`;
    };

    // ミッション問題一覧を読み込む
    const loadMissionQuestions = async () => {
        if (missionQuestions.length > 0) return;
        setMissionQuestionsLoading(true);
        try {
            // localStorageキャッシュ確認（同日中は固定）
            const planId = studyPlan?.id || 'default';
            const cacheKey = `mission_questions_${todayStr}_${planId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMissionQuestions(parsed);
                    setMissionQuestionsLoading(false);
                    return;
                }
            }

            // ターゲット試験IDを決定
            let targetExamIds: string[] = [];

            if (!isAllPlans && todayGoalData?.targetExamId) {
                // プランに特定の試験IDが指定されている場合
                targetExamIds = [todayGoalData.targetExamId];
            } else if (isAllPlans) {
                // 全プラン合算：各プランの今日のタスクからtargetExamIdを収集
                allPlans.forEach(p => {
                    const tData = p.weeklySchedule?.flatMap(w => w.dailyTasks || [])?.filter(t => t)?.find(t => t.date === todayStr);
                    if (tData?.targetExamId) targetExamIds.push(tData.targetExamId);
                });
            }

            // 特定のexamIdが無い場合はプランの対象試験種別から探す
            if (targetExamIds.length === 0) {
                const examType = studyPlan && !isAllPlans ? getTargetExam(studyPlan) : 'AP';
                if (examType) {
                    const exams = await getExams();
                    targetExamIds = exams
                        .filter(e => e.id.startsWith(examType + '-') && e.id.endsWith('-AM'))
                        .sort((a, b) => b.id.localeCompare(a.id)) // 新しい順
                        .slice(0, 3)
                        .map(e => e.id);
                }
            }

            if (targetExamIds.length === 0) {
                // フォールバック: AP午前
                const exams = await getExams();
                targetExamIds = exams
                    .filter(e => e.id.startsWith('AP-') && e.id.endsWith('-AM'))
                    .sort((a, b) => b.id.localeCompare(a.id))
                    .slice(0, 3)
                    .map(e => e.id);
            }

            // 問題を取得
            let allCandidates: { examId: string; qNo: number; category: string; text: string }[] = [];
            for (const eid of targetExamIds) {
                const questions = await getQuestions(eid);
                questions.forEach(q => {
                    if (q.qNo && q.text) {
                        allCandidates.push({
                            examId: eid,
                            qNo: q.qNo,
                            category: q.category || '未分類',
                            text: q.text.replace(/\n/g, ' ').substring(0, 80)
                        });
                    }
                });
            }

            // カテゴリフィルター
            const targetCat = !isAllPlans ? todayGoalData?.targetCategory : undefined;
            if (targetCat && targetCat !== '全般' && targetCat !== '合計') {
                const filtered = allCandidates.filter(q => q.category.includes(targetCat));
                if (filtered.length >= todayTargetCount) {
                    allCandidates = filtered;
                }
            }

            // まだ回答していない問題を優先
            const answeredSet = new Set(records.map(r => `${r.examId}__${r.questionId?.split('-').pop()}`));
            const unanswered = allCandidates.filter(q => !answeredSet.has(`${q.examId}__${q.qNo}`));
            const pool = unanswered.length >= todayTargetCount ? unanswered : allCandidates;

            // シャッフルして選択
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, todayTargetCount);

            // キャッシュ保存
            localStorage.setItem(cacheKey, JSON.stringify(selected));

            // 古いキャッシュ削除
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const oldKey = `mission_questions_${yesterday.toISOString().split('T')[0]}_${planId}`;
            localStorage.removeItem(oldKey);

            setMissionQuestions(selected);
        } catch (error) {
            console.error("ミッション問題の読み込みに失敗しました", error);
        } finally {
            setMissionQuestionsLoading(false);
        }
    };

    // ミッション問題が回答済みかチェック
    const isMissionQuestionAnswered = (examId: string, qNo: number): boolean => {
        return todayRecords.some(r => {
            if (r.examId !== examId) return false;
            const rQNo = parseInt(r.questionId?.split('-').pop() || '0');
            return rQNo === qNo;
        });
    };

    // Use filtered records for stats
    const statsRecords = filteredRecords;

    // Recent History (Global or filtered based on preference? Usually "Recent Activity" is global log)
    // User requested "Select plan... filter records". So history list should probably also follow suit?
    // Let's keep History list consistent with the filtered specific view.
    const recentRecords = filteredRecords.slice(0, 5);

    // 4. Quick Start Logic
    const [quickStartUrl, setQuickStartUrl] = useState("/exam");
    const [quickStartLabel, setQuickStartLabel] = useState("クイックスタート (続きから)");

    useEffect(() => {
        if (statsRecords.length === 0) {
            const defaultExam = studyPlan && !isAllPlans ? getTargetExam(studyPlan) : 'AP';
            // Default URL if no history
            setQuickStartUrl(`/exam?active=${defaultExam}`);
            return;
        }
        const lastRecord = statsRecords[0];
        if (!lastRecord.examId || !lastRecord.questionId) return;

        const parts = lastRecord.examId.split('-');
        if (parts.length < 2) return;

        const typeSuffix = parts[parts.length - 1];
        const yearPart = parts.slice(0, parts.length - 1).join('-');
        const typeUrl = typeSuffix === 'AM' ? 'AM1' : typeSuffix;

        const qIdParts = lastRecord.questionId?.split('-') || [];
        const lastQNo = parseInt(qIdParts[qIdParts.length - 1] || '0');
        const nextQNo = lastQNo + 1;

        // Simple fallback url construction
        setQuickStartUrl(`/exam/${yearPart}/${typeUrl}/${nextQNo}?mode=practice`);
    }, [statsRecords, studyPlan, isAllPlans]);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.welcomeText}>
                        <h1>こんにちは、{userName}さん 👋</h1>
                        <p className={styles.subtitle}>今日も一日、知識を積み重ねましょう。</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.headerActions}>
                        <div className={styles.dateDisplay}>
                            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
                        </div>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <div className={styles.grid}>
                <PerformanceInsights enabled={status === 'authenticated'} />
                <section className={`${styles.card} ${styles.levelCard} ${styles.fullWidthCard} ${styles.collapsibleSection}`}>
                    {renderCollapseToggle('level', 'レベル情報', 'light')}
                    <div className={styles.levelHeader}>
                        <div>
                            <div className={styles.levelTitle}>
                                Level {levelInfo.level} - {levelInfo.title}
                            </div>
                            <div className={styles.levelXp}>XP: {progress.totalXp.toLocaleString()}</div>
                        </div>
                        <div className={styles.levelMeta}>
                            <span>🔥 連続学習: {progress.streakDays}日目</span>
                            <span>🏆 実績: {achievements.unlocked.length}/{achievementTotal}</span>
                        </div>
                    </div>
                    {collapsedSections['level'] && <div id="section-body-level" hidden aria-hidden="true" />}
                    {!collapsedSections['level'] && (
                    <div id="section-body-level">
                    <div className={styles.levelBar}>
                        <div
                            className={styles.levelFill}
                            style={{ width: `${levelInfo.progressPercent}%` }}
                        />
                    </div>
                    <div className={styles.levelNext}>次のレベルまで {levelInfo.xpToNext} XP</div>
                    {(() => {
                        const NEXT_REWARDS: Record<number, { title: string; perk: string }> = {
                            2: { title: '初心者', perk: '🎖️ 学習者バッジ解放' },
                            3: { title: '学習者', perk: '📊 カテゴリ別正答率の詳細表示' },
                            4: { title: '挑戦者', perk: '🔥 連続学習ストリーク表示強化' },
                            5: { title: '熟練者', perk: '🏅 Lv5実績バッジ獲得' },
                            6: { title: 'エキスパート', perk: '⭐ プロフィール称号「エキスパート」' },
                            7: { title: 'マスター', perk: '🎯 マスター記章' },
                            8: { title: 'グランドマスター', perk: '👑 グランドマスター冠' },
                            9: { title: 'レジェンド', perk: '💎 レジェンドエフェクト' },
                            10: { title: '合格請負人', perk: '🏆 最終称号「合格請負人」' },
                        };
                        const nextLv = levelInfo.level + 1;
                        const reward = NEXT_REWARDS[nextLv];
                        if (!reward) return null;
                        return (
                            <div className={styles.nextReward}>
                                <span className={styles.nextRewardLabel}>NEXT Lv{nextLv}</span>
                                <span className={styles.nextRewardName}>{reward.title}</span>
                                <span className={styles.nextRewardPerk}>{reward.perk}</span>
                            </div>
                        );
                    })()}
                    {(() => {
                        const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
                        const reached = STREAK_MILESTONES.filter(m => progress.streakDays >= m).pop();
                        const upcoming = STREAK_MILESTONES.find(m => progress.streakDays < m);
                        if (!reached && !upcoming) return null;
                        return (
                            <div className={styles.streakRow}>
                                {reached && (
                                    <span className={styles.streakBadge}>🔥 {reached}日達成</span>
                                )}
                                {upcoming && (
                                    <span className={styles.streakNext}>
                                        次のマイルストーン: <strong>{upcoming}日</strong>
                                        （あと {upcoming - progress.streakDays} 日）
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                    <div className={styles.levelMeaning}>
                        💡 XPは「正解 +10 / 不正解 +3 / 連続日数ボーナス +5」で増加。レベルアップで称号と統計バッジが解放されます。
                    </div>
                    </div>
                    )}
                </section>
                {/* 1. Goal Section (Hierarchical) - ゲーミフィケーション対応 */}
                <section className={`${styles.card} ${styles.statusCard} ${styles.fullWidthCard} ${styles.collapsibleSection}`}>
                    {renderCollapseToggle('goal', '学習目標')}
                    <div className={styles.cardHeader} style={{ justifyContent: 'space-between', display: 'flex' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h3>学習目標</h3>
                            {allPlans.length > 0 && (
                                <select
                                    className={styles.planSwitcher}
                                    value={studyPlan?.id || 'ALL'}
                                    onChange={(e) => {
                                        if (e.target.value === 'ALL') {
                                            setStudyPlan({ id: 'ALL' } as any);
                                        } else {
                                            const selected = allPlans.find(p => p.id === e.target.value);
                                            if (selected) setStudyPlan(selected);
                                        }
                                    }}
                                >
                                    {allPlans.length > 1 && <option value="ALL">すべて (合算)</option>}
                                    {allPlans.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.title} ({new Date(p.examDate).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <button
                            type="button"
                            className={`${styles.cardIcon} ${styles.iconButton}`}
                            onClick={() => setShowWizard(true)}
                            aria-label="学習目標を編集"
                        >
                            ✏️
                        </button>
                    </div>
                    {collapsedSections['goal'] && <div id="section-body-goal" hidden aria-hidden="true" />}
                    {!collapsedSections['goal'] && (
                    <div id="section-body-goal">
                    {studyPlan ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                            {/* Monthly Goal - 定量目標 + テキスト */}
                            {!isAllPlans && (
                                <div style={{ width: '100%', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            📊 今月の目標（{monthlyProgress.monthLabel}）
                                        </div>
                                        <button
                                            onClick={() => setShowGoalEditor(true)}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '4px',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                padding: '2px 8px',
                                                fontSize: '0.7rem',
                                                transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.color = 'var(--accent-color)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                        >
                                            目標を編集
                                        </button>
                                    </div>
                                    {/* テキスト目標（1行） */}
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.8rem' }}>
                                        {studyPlan.monthlyGoal}
                                    </div>

                                    {/* 定量目標プログレス */}
                                    {monthlyProgress.goals.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                                            {monthlyProgress.goals.map(goal => (
                                                <div key={goal.id} style={{
                                                    padding: '0.6rem',
                                                    background: 'var(--bg-primary)',
                                                    borderRadius: '8px',
                                                    border: goal.isAchieved ? '1px solid #22c55e' : '1px solid var(--border-color)',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                                            {goal.iconEmoji} {goal.label}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 'bold',
                                                            color: goal.isAchieved ? '#22c55e' : goal.progressPercent >= 70 ? '#f59e0b' : 'var(--text-secondary)',
                                                        }}>
                                                            {goal.isAchieved ? '✅ 達成' : `${goal.progressPercent}%`}
                                                        </span>
                                                    </div>
                                                    {/* プログレスバー */}
                                                    <div style={{
                                                        height: '6px',
                                                        background: 'var(--border-color)',
                                                        borderRadius: '3px',
                                                        overflow: 'hidden',
                                                        marginBottom: '0.25rem',
                                                    }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${goal.progressPercent}%`,
                                                            background: goal.isAchieved
                                                                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                                                : goal.progressPercent >= 70
                                                                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                                                    : 'linear-gradient(90deg, var(--accent-color), #6366f1)',
                                                            borderRadius: '3px',
                                                            transition: 'width 0.5s ease-out',
                                                        }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {goal.currentValue}{goal.unit} / {goal.targetValue}{goal.unit}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: '0.6rem',
                                            background: 'var(--bg-primary)',
                                            borderRadius: '8px',
                                            border: '1px dashed var(--border-color)',
                                            textAlign: 'center',
                                            fontSize: '0.8rem',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            定量目標が未設定です。
                                            <button
                                                onClick={() => setShowGoalEditor(true)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--accent-color)',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    fontSize: '0.8rem',
                                                    marginLeft: '0.3rem',
                                                }}
                                            >
                                                設定する
                                            </button>
                                        </div>
                                    )}

                                    {/* 全体達成サマリー */}
                                    {monthlyProgress.goals.length > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: '0.5rem',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            <span>
                                                達成: {monthlyProgress.achievedCount}/{monthlyProgress.totalGoals} 項目
                                            </span>
                                            <span style={{
                                                fontWeight: 'bold',
                                                color: monthlyProgress.overallPercent >= 100
                                                    ? '#22c55e'
                                                    : monthlyProgress.overallPercent >= 70
                                                        ? '#f59e0b'
                                                        : 'var(--text-primary)',
                                            }}>
                                                総合進捗: {monthlyProgress.overallPercent}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Weekly Theme */}
                            {!isAllPlans && (
                                <div style={{ flex: 1, minWidth: '250px', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                        🎯 今週のテーマ {currentWeekData ? `(Week ${currentWeekData.weekNumber})` : ''}
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {weekTheme}
                                    </div>
                                </div>
                            )}

                            {/* Today's Mission - ゲーム風デザイン */}
                            <div style={{ 
                                flex: 1, 
                                minWidth: '250px', 
                                padding: '1rem', 
                                background: isMissionComplete 
                                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
                                    : 'linear-gradient(135deg, var(--primary-color) 0%, #6366f1 100%)', 
                                borderRadius: '12px', 
                                color: 'white',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* 完了時のエフェクト */}
                                {isMissionComplete && (
                                    <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.5rem' }}>🏆</div>
                                )}
                                
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem'
                                }}>
                                    <span style={{ 
                                        fontSize: '0.7rem', 
                                        fontWeight: 'bold',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: getDifficultyStyle(todayDifficulty).bg
                                    }}>
                                        {getDifficultyStyle(todayDifficulty).label}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>今日のミッション</span>
                                </div>
                                
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                    {isMissionComplete ? '✅ ミッションクリア！' : todayMissionTitle}
                                </div>
                                
                                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                                    {todayGoalLabel}
                                </div>
                                
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginTop: '0.5rem',
                                    paddingTop: '0.5rem',
                                    borderTop: '1px solid rgba(255,255,255,0.2)'
                                }}>
                                    <span style={{ fontSize: '0.85rem' }}>
                                        🎯 目標: <strong>{todayTargetCount}問</strong>
                                        <span style={{ fontSize: '0.75rem', marginLeft: '0.3rem', opacity: 0.8 }}>({todayCategoryLabel})</span>
                                    </span>
                                    <span style={{ 
                                        fontSize: '0.85rem', 
                                        fontWeight: 'bold',
                                        background: 'rgba(255,255,255,0.2)',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        ⭐ +{todayXpReward} XP
                                    </span>
                                </div>
                            </div>

                            {/* ミッション問題一覧 */}
                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                                <button
                                    onClick={() => {
                                        const next = !showMissionQuestions;
                                        setShowMissionQuestions(next);
                                        if (next) loadMissionQuestions();
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem 0.8rem',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <span>📋 今日の問題一覧 ({todayCount}/{todayTargetCount}問 完了)</span>
                                    <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: showMissionQuestions ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                </button>

                                {showMissionQuestions && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        overflow: 'hidden'
                                    }}>
                                        {missionQuestionsLoading ? (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                ⏳ 問題を読み込んでいます...
                                            </div>
                                        ) : missionQuestions.length === 0 ? (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                問題データがありません。学習計画を作成してください。
                                            </div>
                                        ) : (
                                            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                                {missionQuestions.map((q, idx) => {
                                                    const answered = isMissionQuestionAnswered(q.examId, q.qNo);
                                                    const url = getQuestionUrl(q.examId, q.qNo);
                                                    return (
                                                        <li key={`${q.examId}-${q.qNo}`} style={{
                                                            borderBottom: idx < missionQuestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                        }}>
                                                            <Link
                                                                href={url}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.6rem',
                                                                    padding: '0.6rem 0.8rem',
                                                                    textDecoration: 'none',
                                                                    color: answered ? 'var(--text-secondary)' : 'var(--text-primary)',
                                                                    transition: 'background 0.15s',
                                                                    opacity: answered ? 0.7 : 1,
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                {/* チェックマーク */}
                                                                <span style={{
                                                                    width: '22px',
                                                                    height: '22px',
                                                                    borderRadius: '50%',
                                                                    border: answered ? 'none' : '2px solid var(--border-color)',
                                                                    background: answered ? '#22c55e' : 'transparent',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '0.7rem',
                                                                    color: 'white',
                                                                    flexShrink: 0
                                                                }}>
                                                                    {answered && '✓'}
                                                                </span>

                                                                {/* 問題番号 */}
                                                                <span style={{
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 'bold',
                                                                    color: 'var(--text-secondary)',
                                                                    minWidth: '28px',
                                                                    flexShrink: 0
                                                                }}>
                                                                    {idx + 1}.
                                                                </span>

                                                                {/* 問題情報 */}
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: 500,
                                                                        textDecoration: answered ? 'line-through' : 'none',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}>
                                                                        {getExamLabel(q.examId)} Q{q.qNo}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: '0.7rem',
                                                                        color: 'var(--text-secondary)',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}>
                                                                        {q.category} | {q.text}
                                                                    </div>
                                                                </div>

                                                                {/* 矢印 */}
                                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                                                                    {answered ? '✅' : '→'}
                                                                </span>
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                                <button
                                    onClick={() => setShowWizard(true)}
                                    className={styles.quickStartBtn}
                                    style={{ width: 'auto', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', boxShadow: 'none', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                >
                                    計画を見直す
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                            <p style={{ marginBottom: '1rem', opacity: 0.9 }}>まだ目標が設定されていません。<br />AIと一緒に最適な学習プランを作りましょう。</p>
                            <button
                                onClick={() => setShowWizard(true)}
                                className={styles.quickStartBtn}
                            >
                                目標を設定する
                            </button>
                        </div>
                    )}
                    </div>
                    )}
                </section>

                {/* 1.5 Monthly Progress Card - 今月の定量進捗 */}
                <section className={`${styles.fullWidthCard} ${styles.collapsibleSection} ${styles.monthlyProgressWrapper}`}>
                    {renderCollapseToggle('monthly', '今月の進捗')}
                    {collapsedSections['monthly'] && <div id="section-body-monthly" hidden aria-hidden="true" />}
                    {!collapsedSections['monthly'] && (
                    <div id="section-body-monthly">
                        <MonthlyProgressCard stats={monthlyStats} />
                    </div>
                    )}
                </section>

                {/* 2. Today's Status - ゲーミフィケーション対応 */}
                <section className={`${styles.card} ${styles.statusCard} ${styles.todayMissionPriority}`}>
                    <div className={styles.cardHeader}>
                        <h3>今日の進捗</h3>
                        <span className={styles.cardIcon}>{isMissionComplete ? '🏆' : '🎯'}</span>
                    </div>
                    <div className={styles.progressContainer}>
                        <div className={styles.progressBar} style={{ 
                            background: 'var(--bg-secondary)',
                            height: '12px',
                            borderRadius: '6px',
                            overflow: 'hidden'
                        }}>
                            <div 
                                className={styles.progressFill} 
                                style={{ 
                                    width: `${progressPercent}%`,
                                    height: '100%',
                                    background: isMissionComplete 
                                        ? 'linear-gradient(90deg, #22c55e, #16a34a)' 
                                        : progressPercent >= 80 
                                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                            : 'linear-gradient(90deg, var(--primary-color), #6366f1)',
                                    transition: 'width 0.5s ease-out'
                                }}
                            />
                        </div>
                        <div className={styles.progressStats} style={{ marginTop: '0.5rem' }}>
                            <span className={styles.progressText}>
                                {isMissionComplete && '✅ '}{todayCount} / {todayTargetCount} 問
                            </span>
                            <span className={styles.progressPercent} style={{
                                color: isMissionComplete ? '#22c55e' : 'var(--text-primary)',
                                fontWeight: 'bold'
                            }}>
                                {progressPercent}%
                            </span>
                        </div>
                        {isMissionComplete && (
                            <div className={styles.missionClearBanner}>
                                🎉 ミッションクリア！ <strong>+{todayXpReward} XP</strong> 獲得
                            </div>
                        )}
                    </div>
                    <Link href={quickStartUrl} className={styles.quickStartBtn}>{quickStartLabel}</Link>
                </section>

                {/* 3. Overall Accuracy Card */}
                <section className={`${styles.card} ${styles.statusCard} ${styles.collapsibleSection}`} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
                    {renderCollapseToggle('accuracy', '通算正答率', 'light')}
                    <div className={styles.cardHeader}>
                        <h3 style={{ color: 'white' }}>通算正答率 {isAllPlans ? '(全体)' : ''}</h3>
                        <span className={styles.cardIcon}>📊</span>
                    </div>
                    {collapsedSections['accuracy'] && <div id="section-body-accuracy" hidden aria-hidden="true" />}
                    {!collapsedSections['accuracy'] && (
                    <div id="section-body-accuracy" className={styles.progressContainer} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0.5rem 0' }}>
                        {/* Donut Chart - Compact Size */}
                        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                            <svg width="80" height="80" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="transparent"
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="12"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="transparent"
                                    stroke="white"
                                    strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - (statsRecords.length > 0 ? (statsRecords.filter(r => r && r.isCorrect).length / statsRecords.length) : 0))}`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 50 50)"
                                />
                            </svg>
                            <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {statsRecords.length > 0 ? Math.round((statsRecords.filter(r => r && r.isCorrect).length / statsRecords.length) * 100) : 0}%
                            </div>
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.2rem' }}>正解数</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', lineHeight: 1 }}>
                                {statsRecords.filter(r => r && r.isCorrect).length} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', opacity: 0.8 }}>/ {statsRecords.length}</span>
                            </div>
                        </div>
                    </div>
                    )}
                </section>

                {/* 4. Heatmap Widget (Replaces placeholders) */}
                <section className={`${styles.card} ${styles.heatmapCard} ${styles.collapsibleSection}`}>
                    {renderCollapseToggle('heatmap', '学習ヒートマップ')}
                    {collapsedSections['heatmap'] && <div id="section-body-heatmap" hidden aria-hidden="true" />}
                    {!collapsedSections['heatmap'] && (
                    <div id="section-body-heatmap" className={styles.heatmapBody}>
                        <HeatmapWidget records={records} />
                    </div>
                    )}
                </section>

                {/* 5. Recent History */}
                <section className={`${styles.card} ${styles.historyCard} ${styles.collapsibleSection}`}>
                    {renderCollapseToggle('history', '最近の活動')}
                    <div className={styles.cardHeader}>
                        <h3>最近の活動</h3>
                        <Link href="/history" className={styles.viewAllBtn}>すべて見る</Link>
                    </div>
                    {collapsedSections['history'] && <div id="section-body-history" hidden aria-hidden="true" />}
                    {!collapsedSections['history'] && (
                    <div id="section-body-history">
                    {recentRecords.length === 0 ? (
                        <p className={styles.subtitle}>まだ学習履歴がありません。</p>
                    ) : (
                        <ul className={styles.historyList}>
                            {recentRecords.map((r, i) => {
                                const qNo = parseInt(r.questionId?.split('-').pop() || '0');
                                const reviewUrl = qNo > 0 ? `${getQuestionUrl(r.examId, qNo)}&review=true` : null;
                                return (
                                    <li key={i} className={styles.historyItem}>
                                        {reviewUrl ? (
                                            <Link href={reviewUrl} className={styles.historyLink}>
                                                <div className={styles.historyMain}>
                                                    <span className={styles.tag}>{r.category || '未分類'}</span>
                                                    <span className={styles.examName}>{getExamLabel(r.examId)} Q{r.questionId?.split('-').pop() || '?'}</span>
                                                </div>
                                                <div className={styles.historyMeta}>
                                                    <span className={`${styles.result} ${r.isCorrect ? styles.correct : styles.incorrect}`}>
                                                        {r.isCorrect ? '正解' : '不正解'}
                                                    </span>
                                                    <span className={styles.date}>
                                                        {r.answeredAt ? new Date(r.answeredAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <>
                                                <div className={styles.historyMain}>
                                                    <span className={styles.tag}>{r.category || '未分類'}</span>
                                                    <span className={styles.examName}>{getExamLabel(r.examId)} Q{r.questionId?.split('-').pop() || '?'}</span>
                                                </div>
                                                <div className={styles.historyMeta}>
                                                    <span className={`${styles.result} ${r.isCorrect ? styles.correct : styles.incorrect}`}>
                                                        {r.isCorrect ? '正解' : '不正解'}
                                                    </span>
                                                    <span className={styles.date}>
                                                        {r.answeredAt ? new Date(r.answeredAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    </div>
                    )}
                </section>
            </div>

            {lastMissionReward && (
                <div className={styles.missionOverlay} onClick={clearMissionReward}>
                    <div className={styles.missionPopup} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.missionTitle}>🎉 ミッションクリア！</h3>
                        <p className={styles.missionSubtitle}>{todayMissionTitle}</p>
                        <div className={styles.missionXpRow}>
                            <span>⭐ +{lastMissionReward.xpEarned} XP</span>
                            <span>🔥 連続ボーナス +{lastMissionReward.bonusXp} XP</span>
                        </div>
                        {lastMissionReward.achievementXp > 0 && (
                            <div className={styles.missionXpRow}>
                                <span>🏆 実績ボーナス +{lastMissionReward.achievementXp} XP</span>
                            </div>
                        )}
                        <div className={styles.missionTotal}>
                            合計: +{lastMissionReward.totalXpEarned} XP
                        </div>
                        <button className={styles.missionButton} onClick={clearMissionReward}>次のミッションへ</button>
                    </div>
                </div>
            )}

            {lastLevelUp && (
                <div className={styles.levelOverlay} onClick={clearLevelUp}>
                    <div className={styles.levelModal} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.levelUpTitle}>✨ LEVEL UP! ✨</h3>
                        <div className={styles.levelUpBody}>
                            <div className={styles.levelUpLevel}>Level {lastLevelUp.level}</div>
                            <div className={styles.levelUpTitleText}>「{lastLevelUp.title}」</div>
                            <p className={styles.levelUpMessage}>
                                これまでの努力が実を結びました！この調子で合格を目指しましょう！
                            </p>
                        </div>
                        <button className={styles.levelUpButton} onClick={clearLevelUp}>OK</button>
                    </div>
                </div>
            )}

            {showWizard && (
                <GoalSettingWizard
                    onClose={() => setShowWizard(false)}
                    onSave={handleSavePlan}
                    onAsyncJobCreated={handleAsyncJobCreated}
                />
            )}

            {pendingJob && (
                <PlanReadyNotification
                    job={pendingJob}
                    onApply={handleApplyPlanFromNotification}
                    onDismiss={handleDismissNotification}
                />
            )}

            {planHealthVisible && planHealth && (
                <PlanHealthToast
                    health={planHealth}
                    onAction={() => {
                        dismissPlanHealth('apply');
                        const action = planHealth.suggestion.action;
                        if (action === 'open_replan') {
                            // 既存の計画編集ページへ
                            window.location.href = '/plan';
                        } else if (action === 'increase_pace') {
                            // 絶好調: 計画ブースト導線として /plan へ
                            window.location.href = '/plan?action=boost';
                        }
                    }}
                    onLater={() => dismissPlanHealth('later')}
                    onClose={() => dismissPlanHealth('close')}
                />
            )}

            {showGoalEditor && studyPlan && !isAllPlans && (
                <MonthlyGoalEditor
                    goals={studyPlan.monthlyGoals || []}
                    monthlyGoalText={studyPlan.monthlyGoal || ''}
                    onSave={handleSaveMonthlyGoals}
                    onClose={() => setShowGoalEditor(false)}
                />
            )}
        </div>
    );
}
