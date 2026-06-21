/**
 * 問題解答画面 — 午前演習（詳細設計§4・§8、WP-3.3）
 *
 * - 4択選択 → 即時採点 → 解説表示
 * - 回答を SQLite learning_events + outbox_events へ保存（オフライン対応）
 * - ナビボタンで前後問題へ移動
 * - セッション初回アクセス時に createLearningSession を呼ぶ
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Mobile } from '@ipa-lab/shared';
import { useAuthStore } from '../../../../src/store/auth-store';
import { useExamSessionStore } from '../../../../src/store/exam-session-store';
import { fetchExamContent } from '../../../../src/infrastructure/api/content-api';
import { queryKeys } from '../../../../src/query/query-keys';
import {
    createLearningSession,
    saveAnswer,
} from '../../../../src/application/usecases/learning-session';

type AnswerState = { selected: number | null; submitted: boolean };

/** correctAnswer ('a'-'d') を選択肢インデックス(0-3)へ変換する。未知値は -1。 */
function correctAnswerToIndex(correctAnswer: string | undefined): number {
    if (!correctAnswer) return -1;
    return 'abcd'.indexOf(correctAnswer.trim().toLowerCase());
}

export default function QuestionScreen() {
    const { examId, qNo } = useLocalSearchParams<{ examId: string; qNo: string }>();
    const router = useRouter();
    const { session } = useAuthStore();
    const userId = session?.userId ?? '';
    const examSession = useExamSessionStore();

    const currentQNo = parseInt(qNo ?? '1', 10);

    const { data } = useQuery<Mobile.ExamContentResponse | null>({
        queryKey: queryKeys.examContent(userId, examId ?? ''),
        queryFn: () => fetchExamContent(examId ?? ''),
        enabled: !!userId && !!examId,
        staleTime: 10 * 60 * 1000,
    });

    const question = useMemo(() => {
        if (!data) return null;
        return data.questions.find((q) => q.qNo === currentQNo) ?? null;
    }, [data, currentQNo]);

    const totalQuestions = data?.questions.length ?? 0;

    // セッション初期化（最初の問題アクセス時）
    useEffect(() => {
        if (!userId || !examId || examSession.sessionId) return;
        createLearningSession(userId, examId)
            .then((sid) => examSession.startSession(sid, examId))
            .catch(() => {
                // SQLite 未初期化（テスト環境等）は無視
            });
    }, [userId, examId]); // eslint-disable-line react-hooks/exhaustive-deps

    // 既存回答の復元
    const existingAnswer = examSession.answers.get(currentQNo);
    const [answerState, setAnswerState] = useState<AnswerState>({
        selected: existingAnswer?.selectedIndex ?? null,
        submitted: existingAnswer !== undefined,
    });

    // qNo が変わったら回答状態をリセット（復元あり）
    useEffect(() => {
        const prev = examSession.answers.get(currentQNo);
        setAnswerState({
            selected: prev?.selectedIndex ?? null,
            submitted: prev !== undefined,
        });
    }, [currentQNo]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelect = useCallback(
        (idx: number) => {
            if (answerState.submitted) return;
            setAnswerState({ selected: idx, submitted: false });
        },
        [answerState.submitted],
    );

    const handleSubmit = useCallback(async () => {
        if (answerState.selected === null || !question) {
            Alert.alert('選択してください', '選択肢を選んでから確認してください。');
            return;
        }

        const correctIdx = correctAnswerToIndex(question.correctAnswer);
        const isCorrect = answerState.selected === correctIdx;
        const now = new Date().toISOString();

        // Zustand に記録
        examSession.recordAnswer({
            qNo: currentQNo,
            selectedIndex: answerState.selected,
            isCorrect,
            submittedAt: now,
        });

        // SQLite に非同期保存（失敗しても UI は継続）
        if (examSession.sessionId && userId) {
            saveAnswer({
                ownerId: userId,
                sessionId: examSession.sessionId,
                examId: examId ?? '',
                qNo: currentQNo,
                questionId: question.id ?? `${examId}-${currentQNo}`,
                selectedIndex: answerState.selected,
                correctIndex: correctIdx,
                occurredAt: now,
            }).catch(() => {
                // オフライン or DB 未初期化 — UI は継続
            });
        }

        setAnswerState((prev) => ({ ...prev, submitted: true }));
    }, [answerState.selected, question, currentQNo, examSession, userId, examId]);

    const handleNext = useCallback(() => {
        if (currentQNo < totalQuestions) {
            router.replace(`/exam/${examId}/question/${currentQNo + 1}`);
        } else {
            router.replace(`/exam/${examId}/result`);
        }
    }, [currentQNo, totalQuestions, examId, router]);

    const handlePrev = useCallback(() => {
        if (currentQNo > 1) {
            router.replace(`/exam/${examId}/question/${currentQNo - 1}`);
        }
    }, [currentQNo, examId, router]);

    if (!question) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>問題データがありません</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.linkText}>← 戻る</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const choices = question.choices ?? [];
    const correctIdx = correctAnswerToIndex(question.correctAnswer);
    const isCorrect = answerState.selected === correctIdx;

    return (
        <View style={styles.container}>
            {/* ナビゲーションバー */}
            <View style={styles.navBar}>
                <TouchableOpacity
                    onPress={handlePrev}
                    disabled={currentQNo <= 1}
                    style={[styles.navBtn, currentQNo <= 1 && styles.navBtnDisabled]}
                    accessibilityLabel="前の問題"
                >
                    <Text style={styles.navText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.progress}>
                    {currentQNo} / {totalQuestions}
                </Text>
                <TouchableOpacity
                    onPress={handleNext}
                    style={styles.navBtn}
                    accessibilityLabel="次の問題"
                >
                    <Text style={styles.navText}>›</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* 問題文 */}
                <Text style={styles.questionText}>{question.questionText}</Text>

                {/* 選択肢 */}
                <View style={styles.choices}>
                    {choices.map((choice, idx) => {
                        const isSelected = answerState.selected === idx;
                        const isSubmitted = answerState.submitted;
                        let borderColor = '#2E2418';
                        if (isSelected && !isSubmitted) borderColor = '#C9A16A';
                        if (isSubmitted && idx === correctIdx) borderColor = '#66BB6A';
                        if (isSubmitted && isSelected && !isCorrect) borderColor = '#E57373';

                        return (
                            <TouchableOpacity
                                key={idx}
                                style={[styles.choiceBtn, { borderColor }]}
                                onPress={() => handleSelect(idx)}
                                disabled={isSubmitted}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: isSelected }}
                            >
                                <Text style={styles.choiceLabel}>
                                    {String.fromCharCode(65 + idx)}
                                </Text>
                                <Text style={styles.choiceText}>{choice}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 採点結果・解説 */}
                {answerState.submitted && (
                    <View style={styles.result}>
                        <Text
                            style={[styles.resultLabel, isCorrect ? styles.correct : styles.wrong]}
                        >
                            {isCorrect ? '✓ 正解' : '✗ 不正解'}
                        </Text>
                        {question.explanation ? (
                            <Text style={styles.explanation}>{question.explanation}</Text>
                        ) : null}
                    </View>
                )}
            </ScrollView>

            {/* フッターボタン */}
            <View style={styles.footer}>
                {!answerState.submitted ? (
                    <TouchableOpacity
                        style={[
                            styles.actionBtn,
                            answerState.selected === null && styles.actionBtnDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={answerState.selected === null}
                        accessibilityLabel="答えを確認する"
                    >
                        <Text style={styles.actionText}>確認する</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleNext}
                        accessibilityLabel={currentQNo < totalQuestions ? '次の問題' : '結果を見る'}
                    >
                        <Text style={styles.actionText}>
                            {currentQNo < totalQuestions ? '次の問題 →' : '結果を見る'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0805' },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0805',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2E2418',
    },
    navBtn: {
        padding: 8,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navBtnDisabled: { opacity: 0.3 },
    navText: { fontSize: 24, color: '#C9A16A' },
    progress: { fontSize: 14, color: '#DCC9A8' },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    questionText: {
        fontSize: 15,
        color: '#DCC9A8',
        lineHeight: 24,
        marginBottom: 24,
    },
    choices: { gap: 10 },
    choiceBtn: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderRadius: 8,
        padding: 14,
        backgroundColor: '#1A1208',
        minHeight: 52,
    },
    choiceLabel: {
        fontSize: 14,
        color: '#C9A16A',
        fontWeight: '600',
        marginRight: 10,
        width: 20,
    },
    choiceText: { flex: 1, fontSize: 14, color: '#DCC9A8', lineHeight: 21 },
    result: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#1A1208',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2E2418',
    },
    resultLabel: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    correct: { color: '#66BB6A' },
    wrong: { color: '#E57373' },
    explanation: { fontSize: 13, color: '#DCC9A8', lineHeight: 20 },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#2E2418',
    },
    actionBtn: {
        height: 52,
        backgroundColor: '#C9A16A',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    actionBtnDisabled: { backgroundColor: '#2E2418' },
    actionText: { fontSize: 16, fontWeight: '600', color: '#0A0805' },
    errorText: { color: '#E57373', fontSize: 14, marginBottom: 16 },
    linkText: { color: '#C9A16A', fontSize: 14 },
});
