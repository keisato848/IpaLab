/**
 * 試験結果画面（詳細設計§4、WP-3.4）
 * - 正答率・スコアを表示
 * - セッションを completed に更新
 * - ホームへ戻る / もう一度チャレンジ
 */
import { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useExamSessionStore } from '../../../src/store/exam-session-store';
import { completeLearningSession } from '../../../src/application/usecases/learning-session';

export default function ResultScreen() {
    const { examId } = useLocalSearchParams<{ examId: string }>();
    const router = useRouter();
    const examSession = useExamSessionStore();

    const totalAnswered = examSession.answers.size;
    const correct = examSession.correctCount();
    const percentage =
        totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;

    // セッション完了を記録
    useEffect(() => {
        if (!examSession.sessionId) return;
        completeLearningSession(examSession.sessionId).catch(() => {
            // SQLite 未初期化は無視
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleHome = useCallback(() => {
        examSession.clearSession();
        router.replace('/(tabs)/dashboard');
    }, [examSession, router]);

    const handleRetry = useCallback(() => {
        examSession.clearSession();
        router.replace(`/exam/${examId}/index`);
    }, [examId, examSession, router]);

    // スコアに応じたメッセージ
    const message =
        percentage >= 80
            ? '合格圏内！このまま得点力を磨こう'
            : percentage >= 60
              ? 'もう少し！苦手分野を復習しよう'
              : '基礎から着実に積み上げよう';

    const scoreColor =
        percentage >= 80 ? '#66BB6A' : percentage >= 60 ? '#C9A16A' : '#E57373';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* タイトル */}
            <Text style={styles.title}>試験結果</Text>
            <Text style={styles.examId}>{examId}</Text>

            {/* スコアサークル */}
            <View style={styles.scoreCircle}>
                <Text style={[styles.scorePercent, { color: scoreColor }]}>{percentage}%</Text>
                <Text style={styles.scoreDetail}>
                    {correct} / {totalAnswered} 問正解
                </Text>
            </View>

            {/* メッセージ */}
            <Text style={styles.message}>{message}</Text>

            {/* 問題別結果 */}
            {totalAnswered > 0 && (
                <View style={styles.breakdown}>
                    <Text style={styles.breakdownTitle}>問題別結果</Text>
                    <View style={styles.breakdownGrid}>
                        {Array.from(examSession.answers.entries())
                            .sort(([a], [b]) => a - b)
                            .map(([qNo, answer]) => (
                                <View
                                    key={qNo}
                                    style={[
                                        styles.qCell,
                                        { borderColor: answer.isCorrect ? '#66BB6A' : '#E57373' },
                                    ]}
                                >
                                    <Text style={styles.qCellNo}>Q{qNo}</Text>
                                    <Text
                                        style={[
                                            styles.qCellIcon,
                                            { color: answer.isCorrect ? '#66BB6A' : '#E57373' },
                                        ]}
                                    >
                                        {answer.isCorrect ? '○' : '✗'}
                                    </Text>
                                </View>
                            ))}
                    </View>
                </View>
            )}

            {/* アクション */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleHome}
                    accessibilityLabel="ホームに戻る"
                >
                    <Text style={styles.primaryText}>ホームに戻る</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handleRetry}
                    accessibilityLabel="もう一度チャレンジ"
                >
                    <Text style={styles.secondaryText}>もう一度チャレンジ</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0805' },
    content: { padding: 24, alignItems: 'center' },
    title: {
        fontSize: 24,
        color: '#DCC9A8',
        fontWeight: '700',
        marginBottom: 4,
    },
    examId: {
        fontSize: 14,
        color: '#C9A16A',
        marginBottom: 40,
    },
    scoreCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 3,
        borderColor: '#2E2418',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        backgroundColor: '#1A1208',
    },
    scorePercent: {
        fontSize: 52,
        fontWeight: '700',
        lineHeight: 60,
    },
    scoreDetail: {
        fontSize: 14,
        color: '#DCC9A8',
        marginTop: 4,
    },
    message: {
        fontSize: 15,
        color: '#DCC9A8',
        textAlign: 'center',
        marginBottom: 36,
        lineHeight: 22,
    },
    breakdown: { width: '100%', marginBottom: 36 },
    breakdownTitle: {
        fontSize: 13,
        color: '#C9A16A',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    breakdownGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    qCell: {
        width: 52,
        height: 52,
        borderWidth: 1,
        borderRadius: 6,
        backgroundColor: '#1A1208',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qCellNo: { fontSize: 10, color: '#DCC9A8', marginBottom: 2 },
    qCellIcon: { fontSize: 16, fontWeight: '700' },
    actions: { width: '100%', gap: 12 },
    primaryBtn: {
        height: 52,
        backgroundColor: '#C9A16A',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    primaryText: { fontSize: 16, fontWeight: '600', color: '#0A0805' },
    secondaryBtn: {
        height: 52,
        borderWidth: 1,
        borderColor: '#C9A16A',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    secondaryText: { fontSize: 16, color: '#C9A16A' },
});
