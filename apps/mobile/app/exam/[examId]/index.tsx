/**
 * 試験入口画面（詳細設計§4、WP-3.2）
 * 試験の概要を表示し、開始・再開ボタンを提供する。
 */
import { useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/store/auth-store';
import { fetchExamContent } from '../../../src/infrastructure/api/content-api';
import { queryKeys } from '../../../src/query/query-keys';

export default function ExamEntryScreen() {
    const { examId } = useLocalSearchParams<{ examId: string }>();
    const router = useRouter();
    const { session } = useAuthStore();
    const userId = session?.userId ?? '';

    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.examContent(userId, examId ?? ''),
        queryFn: () => fetchExamContent(examId ?? ''),
        enabled: !!userId && !!examId,
        staleTime: 10 * 60 * 1000,
    });

    const handleStart = useCallback(() => {
        router.push(`/exam/${examId}/question/1`);
    }, [examId, router]);

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#0070F3" size="large" />
            </View>
        );
    }

    if (isError || !data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>試験データの読み込みに失敗しました</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backText}>← 戻る</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const totalQuestions = data.questions.length;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* ヘッダー */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
                <Text style={styles.backText}>← 試験一覧</Text>
            </TouchableOpacity>

            <View style={styles.header}>
                <Text style={styles.examId}>{examId}</Text>
                <Text style={styles.meta}>{totalQuestions}問</Text>
            </View>

            {/* 問題種別バッジ */}
            <View style={styles.badgeRow}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>午前</Text>
                </View>
            </View>

            {/* 開始ボタン */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.startButton}
                    onPress={handleStart}
                    accessibilityRole="button"
                    accessibilityLabel="試験を開始する"
                >
                    <Text style={styles.startText}>試験を開始する</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.note}>
                回答はオフライン時も端末に保存されます。{'\n'}
                再接続後に自動同期されます。
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F1117' },
    content: { padding: 20 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1117' },
    backRow: { marginBottom: 24 },
    backText: { color: '#0070F3', fontSize: 14 },
    header: { marginBottom: 16 },
    examId: { fontSize: 22, color: '#CBD5E0', fontWeight: '600' },
    meta: { fontSize: 14, color: '#0070F3', marginTop: 4 },
    badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#0070F3',
    },
    badgeText: { fontSize: 12, color: '#0070F3' },
    actions: { gap: 12, marginBottom: 24 },
    startButton: {
        height: 52,
        backgroundColor: '#0070F3',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    startText: { fontSize: 16, color: '#0F1117', fontWeight: '700' },
    errorText: { color: '#F87171', fontSize: 14, marginBottom: 16 },
    backButton: { paddingHorizontal: 20, paddingVertical: 10 },
    note: {
        fontSize: 12,
        color: '#CBD5E0',
        opacity: 0.5,
        textAlign: 'center',
        lineHeight: 18,
    },
});
