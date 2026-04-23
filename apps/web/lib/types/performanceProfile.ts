/**
 * PerformanceProfile (#218 / v2.0 適応型計画 MVP3)
 *
 * ユーザの実績シグナルを集約した型。
 * - DailyProgress + LearningRecord + StudyPlan から純粋関数 `buildPerformanceProfile` で生成
 * - replan v2.0 (#222) の重み付け、ヘルスチェック (#220)、可視化UI (#219) で参照
 */

/** カテゴリ別正答率の集計 */
export interface CategoryAccuracy {
    /** 解答数 */
    total: number;
    /** 正答数 */
    correct: number;
    /** 正答率 (0-1) */
    rate: number;
}

export interface PerformanceProfile {
    userId: string;
    /** プロファイル生成時刻 (ISO) */
    generatedAt: string;
    /**
     * 曜日別の平均解答ペース (questionCount/日)。
     * 過去28日に学習記録のある日のみで平均を取る (学習しなかった日は分母に含めない)。
     * index 0=日, 1=月, ..., 6=土
     */
    paceByWeekday: number[];
    /**
     * 直近7日の達成率。sum(actual) / sum(planned)。
     * planned が 0 の場合は 0 を返す。
     * 値域: 0 以上 (130%超え = 1.3 以上もありうる)
     */
    recentAchievementRate: number;
    /**
     * 直近7日のうち、達成率 > 130% を満たした連続日数 (末尾連続)。
     * 「絶好調」(on_fire) ヘルス判定で「連続3日」を見るのに使用。
     */
    consecutiveOnFireDays: number;
    /** カテゴリ別正答率 (LearningRecord.category キー) */
    accuracyByCategory: Record<string, CategoryAccuracy>;
    /**
     * 学習継続率 (過去28日で学習した日数 / 28)。
     * 値域: 0-1
     */
    continuityRate: number;
    /** 過去28日における直近の連続学習日数 (末尾から数えて何日連続学習したか)。1日空きで途切れる。 */
    consecutiveStudyDays: number;
    /**
     * ペース比 γ。直近7日 questionCount合計 / 過去7-14日 questionCount合計。
     * 1.0 = 同等、1.0 超 = 加速、1.0 未満 = 減速。
     * 過去7-14日が 0 の場合は 1.0 を返す (NaN 回避)。
     */
    paceRatio: number;
}
