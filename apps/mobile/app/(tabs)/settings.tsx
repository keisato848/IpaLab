/**
 * 設定画面（詳細設計§4・§6・WP-4.4）
 * - 学習計画の表示・編集（WP-4.4）
 * - テーマ切替（WP-4.4 で実装予定）
 * - 手動同期（WP-4.4 で実装予定）
 * - ログアウト（WP-1.4 で実装）
 */
import { useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/auth-store';
import { logout } from '../../src/application/usecases/auth';
import {
    fetchStudyPlans,
    updateStudyPlan,
} from '../../src/infrastructure/api/study-plans-api';
import { queryKeys } from '../../src/query/query-keys';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import type { Mobile } from '@ipa-lab/shared';

interface StudyPlanForm {
    title: string;
    examDate: string;
    monthlyGoal: string;
    hoursWeekday: string;
    hoursWeekend: string;
}

function StudyPlanSection({ userId }: { userId: string }) {
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.studyPlans(userId),
        queryFn: fetchStudyPlans,
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });

    const plan = data?.plans?.[0] ?? null;

    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<StudyPlanForm | null>(null);
    const [saving, setSaving] = useState(false);

    const startEdit = useCallback(() => {
        if (!plan) return;
        setForm({
            title: plan.title,
            examDate: plan.examDate,
            monthlyGoal: plan.monthlyGoal,
            hoursWeekday:
                plan.hoursWeekday !== undefined ? String(plan.hoursWeekday) : '',
            hoursWeekend:
                plan.hoursWeekend !== undefined ? String(plan.hoursWeekend) : '',
        });
        setEditing(true);
    }, [plan]);

    const cancelEdit = useCallback(() => {
        setEditing(false);
        setForm(null);
    }, []);

    const handleSave = useCallback(async () => {
        if (!plan || !form) return;
        setSaving(true);
        try {
            const updated: Mobile.MobileStudyPlan = {
                ...plan,
                title: form.title,
                examDate: form.examDate,
                monthlyGoal: form.monthlyGoal,
                hoursWeekday:
                    form.hoursWeekday === '' ? undefined : Number(form.hoursWeekday),
                hoursWeekend:
                    form.hoursWeekend === '' ? undefined : Number(form.hoursWeekend),
            };

            const result = await updateStudyPlan(updated);

            if (result.status === 'ok') {
                queryClient.setQueryData(
                    queryKeys.studyPlans(userId),
                    (prev: Mobile.StudyPlansListResponse | undefined) =>
                        prev
                            ? {
                                  plans: prev.plans.map((p) =>
                                      p.id === result.plan.id ? result.plan : p,
                                  ),
                              }
                            : prev,
                );
                setEditing(false);
                setForm(null);
            } else if (result.status === 'conflict') {
                Alert.alert(
                    '更新の競合',
                    '他の端末で更新されているため保存できませんでした。最新の内容を再読み込みします。',
                    [
                        {
                            text: 'OK',
                            onPress: () =>
                                queryClient.invalidateQueries({
                                    queryKey: queryKeys.studyPlans(userId),
                                }),
                        },
                    ],
                );
                setEditing(false);
                setForm(null);
            } else {
                Alert.alert('エラー', '学習計画の保存に失敗しました。');
            }
        } finally {
            setSaving(false);
        }
    }, [plan, form, queryClient, userId]);

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>学習計画</Text>
            {isLoading ? (
                <ActivityIndicator color="#0070F3" />
            ) : isError || !plan ? (
                <Text style={styles.hint}>学習計画がありません</Text>
            ) : editing && form ? (
                <View>
                    <Text style={styles.inputLabel}>タイトル</Text>
                    <TextInput
                        style={styles.input}
                        value={form.title}
                        onChangeText={(v) => setForm({ ...form, title: v })}
                        placeholderTextColor="#718096"
                    />
                    <Text style={styles.inputLabel}>目標試験日（YYYY-MM-DD）</Text>
                    <TextInput
                        style={styles.input}
                        value={form.examDate}
                        onChangeText={(v) => setForm({ ...form, examDate: v })}
                        placeholderTextColor="#718096"
                    />
                    <Text style={styles.inputLabel}>月間目標</Text>
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        value={form.monthlyGoal}
                        onChangeText={(v) => setForm({ ...form, monthlyGoal: v })}
                        multiline
                        placeholderTextColor="#718096"
                    />
                    <View style={styles.hoursRow}>
                        <View style={styles.hoursField}>
                            <Text style={styles.inputLabel}>平日学習時間</Text>
                            <TextInput
                                style={styles.input}
                                value={form.hoursWeekday}
                                onChangeText={(v) =>
                                    setForm({ ...form, hoursWeekday: v })
                                }
                                keyboardType="numeric"
                                placeholderTextColor="#718096"
                            />
                        </View>
                        <View style={[styles.hoursField, styles.hoursFieldRight]}>
                            <Text style={styles.inputLabel}>休日学習時間</Text>
                            <TextInput
                                style={styles.input}
                                value={form.hoursWeekend}
                                onChangeText={(v) =>
                                    setForm({ ...form, hoursWeekend: v })
                                }
                                keyboardType="numeric"
                                placeholderTextColor="#718096"
                            />
                        </View>
                    </View>
                    <View style={styles.editActions}>
                        <TouchableOpacity
                            style={[styles.editActionButton, styles.cancelButton]}
                            onPress={cancelEdit}
                            disabled={saving}
                            accessibilityRole="button"
                            accessibilityLabel="編集をキャンセル"
                        >
                            <Text style={styles.cancelText}>キャンセル</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.editActionButton, styles.saveButton]}
                            onPress={handleSave}
                            disabled={saving}
                            accessibilityRole="button"
                            accessibilityLabel="学習計画を保存"
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveText}>保存</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View>
                    <View style={styles.row}>
                        <Text style={styles.label}>タイトル</Text>
                        <Text style={styles.value}>{plan.title}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>目標試験日</Text>
                        <Text style={styles.value}>{plan.examDate}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>月間目標</Text>
                        <Text style={styles.value}>{plan.monthlyGoal}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={startEdit}
                        accessibilityRole="button"
                        accessibilityLabel="学習計画を編集"
                    >
                        <Text style={styles.editText}>編集</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

export default function SettingsScreen() {
    const { session } = useAuthStore();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = useCallback(() => {
        Alert.alert(
            'ログアウト',
            'ログアウトしますか？\n未同期のデータは次回ログイン後に同期されます。',
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: 'ログアウト',
                    style: 'destructive',
                    onPress: async () => {
                        setLoggingOut(true);
                        try {
                            await logout();
                            // _layout.tsx が unauthenticated を検知してログイン画面へ遷移
                        } catch {
                            Alert.alert('エラー', 'ログアウトに失敗しました。');
                        } finally {
                            setLoggingOut(false);
                        }
                    },
                },
            ],
        );
    }, []);

    return (
        <ScreenContainer>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>設定</Text>

            {/* アカウント情報 */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>アカウント</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>利用モード</Text>
                    <Text style={styles.value}>
                        {session?.authType === 'guest' ? 'ゲスト' : 'ログイン済み'}
                    </Text>
                </View>
                {session?.authType === 'guest' && (
                    <Text style={styles.hint}>
                        ログインするとデータがクラウドに同期されます。
                    </Text>
                )}
            </View>

            {/* 学習計画（WP-4.4） */}
            {session?.userId && <StudyPlanSection userId={session.userId} />}

            {/* 同期（WP-4.4 プレースホルダー） */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>同期</Text>
                <View style={[styles.row, styles.disabledRow]}>
                    <Text style={[styles.label, styles.disabledText]}>手動同期</Text>
                    <Text style={styles.badge}>準備中</Text>
                </View>
            </View>

            {/* ログアウト */}
            <View style={styles.section}>
                <TouchableOpacity
                    style={[styles.logoutButton, loggingOut && styles.disabledRow]}
                    onPress={handleLogout}
                    disabled={loggingOut}
                    accessibilityLabel="ログアウト"
                    accessibilityRole="button"
                >
                    {loggingOut ? (
                        <ActivityIndicator color="#F87171" />
                    ) : (
                        <Text style={styles.logoutText}>ログアウト</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F1117' },
    content: { padding: 20 },
    title: { fontSize: 24, color: '#CBD5E0', fontWeight: '600', marginBottom: 24 },
    section: {
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#1A202C',
        paddingBottom: 16,
    },
    sectionTitle: {
        fontSize: 12,
        color: '#0070F3',
        letterSpacing: 1,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        minHeight: 48,
    },
    label: { fontSize: 15, color: '#CBD5E0' },
    value: { fontSize: 15, color: '#CBD5E0', opacity: 0.7 },
    hint: { fontSize: 12, color: '#CBD5E0', opacity: 0.5, marginTop: 4 },
    disabledRow: { opacity: 0.4 },
    disabledText: {},
    badge: {
        fontSize: 11,
        color: '#0070F3',
        borderWidth: 1,
        borderColor: '#0070F3',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    logoutButton: {
        height: 52,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F87171',
        minHeight: 48,
    },
    logoutText: { color: '#F87171', fontSize: 16, fontWeight: '600' },
    inputLabel: {
        fontSize: 12,
        color: '#CBD5E0',
        opacity: 0.7,
        marginTop: 12,
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: '#2D3748',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#CBD5E0',
        fontSize: 15,
        minHeight: 48,
    },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    hoursRow: { flexDirection: 'row', marginTop: 4 },
    hoursField: { flex: 1 },
    hoursFieldRight: { marginLeft: 12 },
    editActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
    editActionButton: {
        flex: 1,
        height: 48,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    cancelButton: { borderWidth: 1, borderColor: '#2D3748' },
    cancelText: { color: '#CBD5E0', fontSize: 15, fontWeight: '600' },
    saveButton: { backgroundColor: '#0070F3' },
    saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    editButton: {
        marginTop: 12,
        height: 48,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#0070F3',
        minHeight: 48,
    },
    editText: { color: '#0070F3', fontSize: 15, fontWeight: '600' },
});
