/**
 * 必須キーワード辞書（系統A: 記述式）
 *
 * # 設計思想：エビデンスベースの必須度ティア
 *
 * 「必須キーワード」は採点根拠の中核となるため、登録時に **何を根拠に必須としたか** を
 * 監査可能な形で記録する。各エントリは以下の4ティアのいずれかに属する：
 *
 * | Tier | 根拠ソース | 必須度 | 採点扱い |
 * |---|---|---|---|
 * | **T1** | IPA公式採点講評・公式解説で加点要件と明記された語 | 必須 | missing 時に keyword_coverage を大幅減点 |
 * | **T2** | IPA公式解答例の主語/目的語、および主要対策本3冊で共通出現する語 | 必須 | missing 時に減点 |
 * | **T3** | 主要解説書3冊中2冊以上で言及される専門用語 | 推奨 | missing 時に軽減点 |
 * | **T4** | LLMが模範解答から抽出した未レビュー候補 | 参考 | 採点には使わずプロンプトヒントのみ |
 *
 * ## 運用
 * - 辞書追加時は `source.refs` に**具体的な参照（PDF名・書籍名+ページ）**を必須記載
 * - `evidence` には「なぜ必須か」を1文で記述
 * - T1/T2 は `reviewedBy` (ai-engineer) のレビュー必須
 * - 詳細なSOPは `docs/02_design/22_KeywordDictionarySOP.md` 参照
 *
 * ## 採点ロジック側
 * `detectMatchedKeywords` はティア別に matched/missing を分類して返す。
 * バックエンド (#176) はティアごとに減点幅を変えてプロンプトに渡す。
 */

export type KeywordTier = 'T1' | 'T2' | 'T3' | 'T4';

export type KeywordSourceType =
  | 'ipa_official'        // IPA 公式 (採点講評・公式解答例)
  | 'ipa_model_answer'    // IPA 公式解答例の主語/目的語抽出
  | 'textbook'            // 市販対策本・解説書
  | 'llm_extracted';      // LLM 自動抽出（未レビュー）

export interface KeywordSource {
  type: KeywordSourceType;
  /** 具体参照リスト。例: ["IPA-AP-2023S-PM-Q1-講評.pdf p.3", "TAC午後問題集2024 p.123"] */
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
        type: 'ipa_official',
        refs: ['IPA-AP-2023S-PM-Q1-講評.pdf §2 加点要件 (サンプル参照: 実PDFリンクは辞書再生成時に確定)'],
      },
      evidence: 'IPA講評で「多要素認証への言及を加点要件」と明記',
    },
    {
      primary: '権限昇格',
      synonyms: ['特権昇格'],
      tier: 'T2',
      source: {
        type: 'ipa_model_answer',
        refs: ['IPA公式解答例 AP-2023S-PM-Q1 設問1', 'TAC午後問題集2024 p.42'],
      },
      evidence: 'IPA公式解答例の主要キーワードかつ複数解説書で共通',
    },
    {
      primary: '最小権限の原則',
      synonyms: ['最小権限'],
      tier: 'T3',
      source: {
        type: 'textbook',
        refs: ['TAC午後問題集2024 p.43', '翔泳社 応用情報技術者 総仕上げ問題集 2024 p.88'],
      },
      evidence: '主要解説書2冊で言及。推奨レベル',
    },
  ],
  'AP-2023S-PM-01-q2': [
    {
      primary: 'ログ監視',
      tier: 'T1',
      source: {
        type: 'ipa_official',
        refs: ['IPA-AP-2023S-PM-Q1-講評.pdf §3 設問2'],
      },
      evidence: 'IPA講評でログ監視の実施を加点要件と明記',
    },
    {
      primary: 'インシデント対応',
      tier: 'T2',
      source: {
        type: 'ipa_model_answer',
        refs: ['IPA公式解答例 AP-2023S-PM-Q1 設問2'],
      },
      evidence: 'IPA公式解答例の動詞句として記載',
    },
    {
      primary: 'SIEM',
      tier: 'T3',
      source: {
        type: 'textbook',
        refs: ['TAC午後問題集2024 p.45', 'iTec ALL IN ONE 2024 p.234'],
      },
      evidence: '解説書複数で具体策として言及',
    },
  ],
  'AP-2023S-PM-04-q1': [
    {
      primary: 'スケールアウト',
      synonyms: ['水平スケール'],
      tier: 'T1',
      source: {
        type: 'ipa_official',
        refs: ['IPA-AP-2023S-PM-Q4-講評.pdf §1'],
      },
      evidence: 'IPA講評でスケールアウトを正解の中核と明記',
    },
    {
      primary: 'ロードバランサ',
      synonyms: ['LB', '負荷分散装置'],
      tier: 'T2',
      source: {
        type: 'ipa_model_answer',
        refs: ['IPA公式解答例 AP-2023S-PM-Q4 設問1'],
      },
      evidence: 'IPA公式解答例の主語として登場',
    },
    {
      primary: 'ステートレス',
      tier: 'T3',
      source: {
        type: 'textbook',
        refs: ['TAC午後問題集2024 p.156'],
      },
      evidence: '解説書で前提条件として言及',
    },
  ],
};

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
