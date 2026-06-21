/**
 * 学習計画タブ（詳細設計§4・WP-4.2 / 設計確定記録 27 §3）
 *
 * - アクティブな計画を表示（今日のタスクを前面）。
 * - オンライン取得 → SQLite キャッシュ。オフライン時はキャッシュを表示。
 * - 作成/編集/完了の操作は次の増分で追加（本画面は閲覧）。
 */
import { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import type { Mobile } from '@ipa-lab/shared';
import { useAuthStore } from '../../src/store/auth-store';
import { loadStudyPlans, type PlanSource } from '../../src/application/usecases/study-plan';
import {
    selectActivePlan,
    selectTodayTask,
    daysUntilExam,
} from '../../src/application/usecases/plan-selectors';

const GOLD = '#C9A16A';

export default function PlanScreen() {
    const { session } = useAuthStore();
    const userId = session?.userId ?? '';

    const [plan, setPlan] = useState<Mobile.MobileStudyPlan | null>(null);
    const [source, setSource] = useState<PlanSource>('network');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        if (!userId) return;
        try {
            const result = await loadStudyPlans(userId);
            setPlan(selectActivePlan(result.plans));
            setSource(result.source);
            setError(false);
        } catch {
            setError(true);
        }
    }, [userId]);

    useEffect(() => {
        setLoading(true);
        load().finally(() => setLoading(false));
    }, [load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={GOLD} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>計画の取得に失敗しました</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Text style={styles.link}>再試行</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!plan) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyTitle}>学習計画がありません</Text>
                <Text style={styles.emptyBody}>
                    Web 版で計画を作成すると、ここに表示されます。
                </Text>
            </View>
        );
    }

    const todayISO = new Date().toISOString();
    const todayTask = selectTodayTask(plan, todayISO);
    const remaining = daysUntilExam(plan.examDate, todayISO);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />
            }
        >
            {source === 'cache' ? (
                <Text style={styles.offlineBadge}>オフライン表示（最終取得データ）</Text>
            ) : null}

            <Text style={styles.title}>{plan.title}</Text>
            <Text style={styles.examDate}>
                試験日: {plan.examDate.slice(0, 10)}
                {remaining !== null && remaining >= 0 ? `（あと ${remaining} 日）` : ''}
            </Text>

            {/* 今日のタスク（最優先） */}
            <View style={styles.todayCard}>
                <Text style={styles.sectionLabel}>今日のタスク</Text>
                {todayTask ? (
                    <>
                        <Text style={styles.todayGoal}>
                            {todayTask.missionTitle ?? todayTask.goal}
                        </Text>
                        <Text style={styles.todayMeta}>
                            {todayTask.questionCount} 問
                            {todayTask.targetCategory ? ` ・ ${todayTask.targetCategory}` : ''}
                        </Text>
                    </>
                ) : (
                    <Text style={styles.todayEmpty}>
                        今日のタスクはありません。週間スケジュールから取り組めます。
                    </Text>
                )}
            </View>

            {/* 月間目標 */}
            {plan.monthlyGoals && plan.monthlyGoals.length > 0 ? (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>月間目標</Text>
                    {plan.monthlyGoals.map((g) => (
                        <Text key={g.id} style={styles.goalRow}>
                            {g.iconEmoji} {g.label}（{g.targetValue}
                            {g.unit}）
                        </Text>
                    ))}
                </View>
            ) : plan.monthlyGoal ? (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>月間目標</Text>
                    <Text style={styles.goalRow}>{plan.monthlyGoal}</Text>
                </View>
            ) : null}

            {/* 週間スケジュール */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>週間スケジュール</Text>
                {plan.weeklySchedule.map((week) => (
                    <View key={week.weekNumber} style={styles.weekRow}>
                        <Text style={styles.weekTitle}>
                            第 {week.weekNumber} 週{week.theme ? ` ・ ${week.theme}` : ''}
                        </Text>
                        <Text style={styles.weekGoal}>{week.goal}</Text>
                        <Text style={styles.weekDates}>
                            {week.startDate.slice(0, 10)} 〜 {week.endDate.slice(0, 10)}
                        </Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A140D' },
    content: { padding: 16, gap: 12 },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 10,
        backgroundColor: '#1A140D',
    },
    offlineBadge: { color: '#D6B98A', fontSize: 12 },
    title: { color: '#F5ECDD', fontSize: 22, fontWeight: '700' },
    examDate: { color: '#D6B98A', fontSize: 14 },
    todayCard: {
        backgroundColor: '#2E2418',
        borderColor: GOLD,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        gap: 6,
    },
    sectionLabel: { color: GOLD, fontSize: 13, fontWeight: '700' },
    todayGoal: { color: '#F5ECDD', fontSize: 18, fontWeight: '600' },
    todayMeta: { color: '#D6B98A', fontSize: 13 },
    todayEmpty: { color: '#B9A88E', fontSize: 14 },
    section: { gap: 8, marginTop: 4 },
    goalRow: { color: '#E7DAC6', fontSize: 14 },
    weekRow: {
        backgroundColor: '#241B11',
        borderRadius: 10,
        padding: 12,
        gap: 4,
    },
    weekTitle: { color: '#F5ECDD', fontSize: 15, fontWeight: '600' },
    weekGoal: { color: '#E7DAC6', fontSize: 13 },
    weekDates: { color: '#9C8B72', fontSize: 12 },
    errorText: { color: '#E8B4A0', fontSize: 15 },
    link: { color: GOLD, fontSize: 15, fontWeight: '600' },
    emptyTitle: { color: '#F5ECDD', fontSize: 18, fontWeight: '600' },
    emptyBody: { color: '#B9A88E', fontSize: 14, textAlign: 'center' },
});
