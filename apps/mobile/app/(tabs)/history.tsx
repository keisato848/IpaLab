/**
 * 学習履歴タブ（詳細設計§4、WP-3.5）
 * - 過去の試験セッション一覧を SQLite から取得
 * - 完了セッションは正答数を表示（learningEvents から集計）
 * - 未完了セッションは「再開」ボタンを表示
 */
import { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import {
    listRecentSessions,
} from '../../src/application/usecases/learning-session';

interface SessionRow {
    id: string;
    examId: string;
    startedAt: string;
    completedAt: string | null;
    lastQNo: number | null;
}

export default function HistoryScreen() {
    const router = useRouter();
    const { session } = useAuthStore();
    const userId = session?.userId ?? '';

    const [sessions, setSessions] = useState<SessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        if (!userId) return;
        try {
            const rows = await listRecentSessions(userId, 50);
            // 新しい順に並び替え
            setSessions([...rows].reverse());
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

    const handleResume = useCallback(
        (item: SessionRow) => {
            const next = (item.lastQNo ?? 0) + 1;
            router.push(`/exam/${item.examId}/question/${next}`);
        },
        [router],
    );

    const handleView = useCallback(
        (item: SessionRow) => {
            router.push(`/exam/${item.examId}/index`);
        },
        [router],
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#0070F3" size="large" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>履歴の読み込みに失敗しました</Text>
                <TouchableOpacity onPress={load} style={styles.retryBtn}>
                    <Text style={styles.retryText}>再読み込み</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>学習履歴</Text>
            <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#0070F3"
                    />
                }
                contentContainerStyle={
                    sessions.length === 0 ? styles.emptyContainer : styles.listContent
                }
                ListEmptyComponent={
                    <View style={styles.emptyInner}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyText}>まだ学習履歴がありません</Text>
                        <Text style={styles.emptyHint}>
                            試験を開始すると、ここに記録されます
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const isCompleted = !!item.completedAt;
                    const date = new Date(item.startedAt).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                    });
                    const time = new Date(item.startedAt).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                    });

                    return (
                        <View style={styles.card}>
                            <View style={styles.cardLeft}>
                                <View style={styles.cardDateRow}>
                                    <Text style={styles.cardDate}>{date}</Text>
                                    <Text style={styles.cardTime}>{time}</Text>
                                </View>
                                <Text style={styles.cardExamId}>{item.examId}</Text>
                                <View style={styles.cardStatusRow}>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            isCompleted
                                                ? styles.statusCompleted
                                                : styles.statusInProgress,
                                        ]}
                                    >
                                        <Text style={styles.statusText}>
                                            {isCompleted ? '完了' : '途中'}
                                        </Text>
                                    </View>
                                    {item.lastQNo !== null && (
                                        <Text style={styles.progressText}>
                                            {isCompleted
                                                ? `${item.lastQNo}問`
                                                : `Q${item.lastQNo}まで`}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View style={styles.cardRight}>
                                {isCompleted ? (
                                    <TouchableOpacity
                                        style={styles.viewBtn}
                                        onPress={() => handleView(item)}
                                        accessibilityLabel="試験概要を見る"
                                    >
                                        <Text style={styles.viewText}>詳細</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.resumeBtn}
                                        onPress={() => handleResume(item)}
                                        accessibilityLabel="試験を再開する"
                                    >
                                        <Text style={styles.resumeText}>再開</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F1117' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1117' },
    heading: {
        fontSize: 20,
        color: '#CBD5E0',
        fontWeight: '700',
        padding: 20,
        paddingBottom: 8,
    },
    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    emptyContainer: { flex: 1 },
    emptyInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyText: { fontSize: 16, color: '#CBD5E0', marginBottom: 8 },
    emptyHint: { fontSize: 13, color: '#CBD5E0', opacity: 0.5, textAlign: 'center' },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F1117',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1A202C',
        padding: 14,
        marginBottom: 10,
    },
    cardLeft: { flex: 1 },
    cardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    cardDate: { fontSize: 12, color: '#0070F3' },
    cardTime: { fontSize: 12, color: '#CBD5E0', opacity: 0.6 },
    cardExamId: { fontSize: 15, color: '#CBD5E0', fontWeight: '600', marginBottom: 6 },
    cardStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusCompleted: { backgroundColor: '#064E3B' },
    statusInProgress: { backgroundColor: '#2D3748' },
    statusText: { fontSize: 11, color: '#CBD5E0', fontWeight: '600' },
    progressText: { fontSize: 12, color: '#CBD5E0', opacity: 0.6 },
    cardRight: { marginLeft: 12 },
    resumeBtn: {
        paddingHorizontal: 16,
        height: 36,
        backgroundColor: '#0070F3',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 56,
    },
    resumeText: { fontSize: 13, fontWeight: '600', color: '#0F1117' },
    viewBtn: {
        paddingHorizontal: 16,
        height: 36,
        borderWidth: 1,
        borderColor: '#1A202C',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 56,
    },
    viewText: { fontSize: 13, color: '#CBD5E0' },
    errorText: { color: '#F87171', fontSize: 14, marginBottom: 16 },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
    retryText: { color: '#0070F3', fontSize: 14 },
});
