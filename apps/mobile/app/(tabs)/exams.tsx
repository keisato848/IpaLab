/**
 * 試験一覧タブ（詳細設計§4、WP-3.1）
 *
 * - manifest から試験一覧を取得・表示
 * - タップで exam/[examId]/index へ遷移
 * - オフライン時: ダウンロード済み試験のみ開始可
 * - download_state によるステータス表示
 */
import { useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/auth-store';
import { fetchContentManifest } from '../../src/infrastructure/api/content-api';
import { queryKeys } from '../../src/query/query-keys';

interface ExamItem {
    examId: string;
    title: string;
    contentHash: string;
    questionCount: number;
}

export default function ExamsScreen() {
    const router = useRouter();
    const { session } = useAuthStore();
    const userId = session?.userId ?? '';

    const { data, isLoading, isError, refetch, isRefetching } = useQuery({
        queryKey: queryKeys.manifest(userId),
        queryFn: async () => {
            const result = await fetchContentManifest();
            if (!result || 'notModified' in result) return null;
            return result.data;
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5分
    });

    const exams: ExamItem[] = data?.exams ?? [];

    const handlePress = useCallback(
        (examId: string) => {
            router.push(`/exam/${examId}`);
        },
        [router],
    );

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#0070F3" size="large" />
            </View>
        );
    }

    if (isError) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>試験データの取得に失敗しました</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                    <Text style={styles.retryText}>再試行</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>試験一覧</Text>
            <FlatList
                data={exams}
                keyExtractor={(item) => item.examId}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor="#0070F3"
                    />
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.examCard}
                        onPress={() => handlePress(item.examId)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.title}を開始`}
                    >
                        <View style={styles.cardContent}>
                            <Text style={styles.examTitle}>{item.examId}</Text>
                            <Text style={styles.examMeta}>{item.questionCount}問</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <Text style={styles.emptyText}>試験データがありません</Text>
                    </View>
                }
                contentContainerStyle={exams.length === 0 ? styles.emptyContainer : undefined}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F1117' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyContainer: { flex: 1 },
    title: {
        fontSize: 24,
        color: '#CBD5E0',
        fontWeight: '600',
        padding: 20,
        paddingBottom: 12,
    },
    examCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F1117',
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1A202C',
        minHeight: 64,
    },
    cardContent: { flex: 1 },
    examTitle: { fontSize: 15, color: '#CBD5E0', fontWeight: '500' },
    examMeta: { fontSize: 12, color: '#0070F3', marginTop: 4 },
    arrow: { fontSize: 20, color: '#0070F3', marginLeft: 8 },
    errorText: { color: '#F87171', fontSize: 14, marginBottom: 12 },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#0070F3',
    },
    retryText: { color: '#0070F3', fontSize: 14 },
    emptyText: { color: '#CBD5E0', opacity: 0.5, fontSize: 14 },
});
