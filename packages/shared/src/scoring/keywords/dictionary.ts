/**
 * 必須キーワード辞書（系統A: 記述式）
 *
 * # 設計思想：エビデンスベースの必須度ティア（公開情報限定）
 *
 * 「必須キーワード」は採点根拠の中核となるため、登録時に **何を根拠に必須としたか** を
 * 監査可能な形で記録する。各エントリは以下の4ティアのいずれかに属する。
 *
 * **重要: 著作権リスク回避のため、市販書籍からの直接抽出は採用しない。**
 * ソースは「IPA公式（公開・引用許諾範囲）」または「自社蓄積データ」に限定する。
 *
 * | Tier | 根拠ソース | 必須度 | 採点扱い |
 * |---|---|---|---|
 * | **T1** | IPA公式採点講評で加点要件と明記された語 (公開) | 必須 | keyword_coverage を 1件あたり 25 点減点 |
 * | **T2** | IPA公式解答例の主語/目的語抽出 (公開) | 必須 | keyword_coverage を 1件あたり 12 点減点 |
 * | **T3** | 自社プラットフォームのユーザー解答コーパスで正答群頻出語 (自社データ) | 推奨 | keyword_coverage を 1件あたり 4 点減点 |
 * | **T4** | LLMがIPA公式解答例から抽出した未レビュー候補 | 参考 | 採点には使わずLLMプロンプトの「参考」欄に注入 |
 *
 * ## ティアの活用箇所（バックエンド #176 / フロントエンド #178/#179）
 *
 * 1. **`keyword_coverage` スコア算出** (`scoreKeywordCoverage` in `aggregator.ts`)
 *    `score = max(0, 100 - 25*|T1miss| - 12*|T2miss| - 4*|T3miss|)`
 *
 * 2. **LLM 採点プロンプト生成** (`buildShortAnswerPrompt`)
 *    T1/T2 を「必須キーワード」、T3 を「望ましいキーワード」、T4 を「参考キーワード」と
 *    別ラベルで提示し、観点別 LLM が差別的に評価できるようにする。
 *
 * 3. **UI フィードバック** (#178/#179 採点結果ページ)
 *    T1miss→赤「最重要」/ T2miss→橙「必須」/ T3miss→グレー「推奨」のバッジ表示。
 *
 * 4. **学習進捗集計への入力** (#187)
 *    T1 hit率・T2 hit率を可観測指標として記録し、ユーザーの「公式必須キーワード習得度」を可視化。
 *
 * ## 運用
 * - 辞書追加時は `source.refs` に**公開情報の具体的な参照（公式PDF名・URL）**を必須記載
 * - 自社データ起源 (T3) の場合は集計クエリのID等を refs に記載
 * - `evidence` には「なぜ必須か」を1文で記述
 * - T1/T2/T3 は `reviewedBy` (ai-engineer) のレビュー必須
 * - 詳細なSOPは `docs/02_design/22_KeywordDictionarySOP.md` 参照
 */

export type KeywordTier = 'T1' | 'T2' | 'T3' | 'T4';

export type KeywordSourceType =
  | 'ipa_review'            // IPA 公式採点講評 (公開)
  | 'ipa_model_answer'      // IPA 公式解答例の主語/目的語抽出 (公開)
  | 'internal_corpus'       // 自社プラットフォームのユーザー解答コーパス (自社データ)
  | 'llm_extracted';        // LLM 自動抽出（未レビュー）

export interface KeywordSource {
  type: KeywordSourceType;
  /** 具体参照リスト。例: ["IPA公式採点講評 AP 2023春 午後 問1 §2 (公式PDF URL)", "internal-corpus query: ..."] */
  refs: string[];
}

export interface KeywordEntry {
  /** 主キーワード（模範解答での代表表記） */
  primary: string;
  /** 同義語・表記ゆれ（マッチ時に primary とみなす） */
  synonyms?: string[];
  /** 必須度ティア。T1/T2 は採点で必須扱い、T3 は推奨、T4 は参考 */
  tier: KeywordTier;
  /** 根拠ソース。監査・再現性のため必須 */
  source: KeywordSource;
  /** なぜ必須と判定したかの根拠（1文） */
  evidence: string;
  /** レビュー実施者（T1/T2 は必須、T3/T4 は省略可） */
  reviewedBy?: string;
  /** レビュー日 (ISO 8601) */
  reviewedAt?: string;
  /** 重要度の微調整 (0-1, 省略時はティアに応じた既定値) */
  importance?: number;
}

export type KeywordDictionary = Record<string, KeywordEntry[]>;

/**
 * シードデータ。過去問インポートで段階的に拡充する。
 * 形式の妥当性確認とテスト用途に、AP午後の代表的な設問を数件登録。
 *
 * 注意: 以下のサンプルは設計検証用の最小データセットです。
 * 本番投入時は `docs/02_design/22_KeywordDictionarySOP.md` のパイプラインに従い、
 * IPA公式講評を一次ソースとして再生成してください。
 */
export const SHORT_ANSWER_KEYWORD_DICTIONARY: KeywordDictionary = {
  'AP-2023S-PM-01-q1': [
    {
      primary: '多要素認証',
      synonyms: ['多段階認証', 'MFA'],
      tier: 'T1',
      source: {
        type: 'ipa_review',
        refs: ['IPA公式 採点講評 AP 2023春 午後 問1 §2 加点要件 (https://www.ipa.go.jp/...)'],
      },
      evidence: 'IPA講評で「多要素認証への言及を加点要件」と明記',
    },
    {
      primary: '権限昇格',
      synonyms: ['特権昇格'],
      tier: 'T2',
      source: {
        type: 'ipa_model_answer',
        refs: ['IPA公式解答例 AP 2023春 午後 問1 設問1 (https://www.ipa.go.jp/...)'],
      },
      evidence: 'IPA公式解答例の主語として明示的に記載',
    },
    {
      primary: '最小権限の原則',
      synonyms: ['最小権限'],
      tier: 'T3',
      source: {
        type: 'internal_corpus',
        refs: ['internal-corpus query: AP-2023S-PM-01-q1, correct_user_answers, top_terms_by_tfidf, n=120'],
      },
      evidence: '自社コーパスの正答群で頻出 (出現率 38%)',
    },
  ],
  'AP-2023S-PM-01-q2': [
    {
      primary: 'ログ監視',
      tier: 'T1',
      source: {
        type: 'ipa_review',
        refs: ['IPA公式 採点講評 AP 2023春 午後 問1 §3 設問2'],
      },
      evidence: 'IPA講評でログ監視の実施を加点要件と明記',
    },
    {
      primary: 'インシデント対応',
      tier: 'T2',
      source: {
        type: 'ipa_model_answer',
        refs: ['IPA公式解答例 AP 2023春 午後 問1 設問2'],
      },
      evidence: 'IPA公式解答例の動詞句として記載',
    },
    {
      primary: 'SIEM',
      tier: 'T3',
      source: {
        type: 'internal_corpus',
        refs: ['internal-corpus query: AP-2023S-PM-01-q2, correct_user_answers, top_terms_by_tfidf, n=85'],
      },
      evidence: '自社コーパスの正答群で頻出 (出現率 24%)',
    },
  ],
  'AP-2023S-PM-04-q1': [
    {
      primary: 'スケールアウト',
      synonyms: ['水平スケール'],
      tier: 'T1',
      source: {
        type: 'ipa_review',
        refs: ['IPA公式 採点講評 AP 2023春 午後 問4 §1'],
      },
      evidence: 'IPA講評でスケールアウトを正解の中核と明記',
    },
    {
      primary: 'ロードバランサ',
      synonyms: ['LB', '負荷分散装置'],
      tier: 'T2',
      source: {
        type: 'ipa_model_answer',
        refs: ['IPA公式解答例 AP 2023春 午後 問4 設問1'],
      },
      evidence: 'IPA公式解答例の主語として登場',
    },
    {
      primary: 'ステートレス',
      tier: 'T3',
      source: {
        type: 'internal_corpus',
        refs: ['internal-corpus query: AP-2023S-PM-04-q1, correct_user_answers, top_terms_by_tfidf, n=64'],
      },
      evidence: '自社コーパスの正答群で頻出 (出現率 31%)',
    },
  ],
};

/**
 * keyword_coverage 観点の減点式パラメータ
 * `score = max(0, 100 - T1_PENALTY*|T1miss| - T2_PENALTY*|T2miss| - T3_PENALTY*|T3miss|)`
 *
 * パラメータの根拠:
 *  - T1: IPA公式が加点要件と明記している語の欠落は致命的 → 4件で 0 点
 *  - T2: 公式解答例の主要句の欠落は減点対象 → 8件で 0 点（実質設問あたり最大2-3件想定）
 *  - T3: 自社統計上の頻出語は推奨レベル → 25件で 0 点
 */
export const KEYWORD_COVERAGE_PENALTIES = Object.freeze({
  T1: 25,
  T2: 12,
  T3: 4,
  T4: 0,
}) satisfies Readonly<Record<KeywordTier, number>>;

/** ティア別の既定 importance（採点重み付けに使用） */
export const TIER_DEFAULT_IMPORTANCE: Readonly<Record<KeywordTier, number>> = Object.freeze({
  T1: 1.0,
  T2: 0.8,
  T3: 0.4,
  T4: 0.0, // T4 は採点には使わない
});

/**
 * 与えられた問題IDに対する必須キーワードを返す。
 * 該当エントリが無ければ空配列を返す（採点プロセスはキーワード辞書なしでも動作可能）。
 */
export function getRequiredKeywords(questionId: string): KeywordEntry[] {
  return SHORT_ANSWER_KEYWORD_DICTIONARY[questionId] ?? [];
}

/**
 * ティアでフィルタしたキーワードを返す（例: T1/T2 のみ採点必須として扱う）
 */
export function getKeywordsByTier(
  questionId: string,
  tiers: readonly KeywordTier[],
): KeywordEntry[] {
  return getRequiredKeywords(questionId).filter((k) => tiers.includes(k.tier));
}

export interface MatchResult {
  /** ヒットしたキーワード（primary 表記） */
  matched: string[];
  /** ヒットしなかったキーワード（primary 表記） */
  missing: string[];
  /** ティア別の matched/missing 内訳 */
  byTier: Record<KeywordTier, { matched: string[]; missing: string[] }>;
}

/**
 * ユーザー解答テキストから必須キーワード（および同義語）にヒットしたものを返す。
 * 完全一致・部分一致のみ。意味的言い換えは LLM 側で評価する想定。
 *
 * 戻り値はティア別の内訳も含むため、バックエンド (#176) は T1/T2 missing を重く、
 * T3 missing を軽く扱う等の差別化が可能。
 */
export function detectMatchedKeywords(
  userAnswer: string,
  required: KeywordEntry[],
): MatchResult {
  const matched: string[] = [];
  const missing: string[] = [];
  const byTier: Record<KeywordTier, { matched: string[]; missing: string[] }> = {
    T1: { matched: [], missing: [] },
    T2: { matched: [], missing: [] },
    T3: { matched: [], missing: [] },
    T4: { matched: [], missing: [] },
  };

  for (const entry of required) {
    const candidates = [entry.primary, ...(entry.synonyms ?? [])];
    const hit = candidates.some((c) => userAnswer.includes(c));
    if (hit) {
      matched.push(entry.primary);
      byTier[entry.tier].matched.push(entry.primary);
    } else {
      missing.push(entry.primary);
      byTier[entry.tier].missing.push(entry.primary);
    }
  }
  return { matched, missing, byTier };
}
