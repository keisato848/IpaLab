/**
 * 必須キーワード辞書（系統A: 記述式）
 *
 * 過去問の模範解答から抽出した必須キーワードを設問IDごとに保持する。
 * 採点時はバックエンドが本辞書を参照し、キーワードマッチおよび LLM 採点プロンプトの
 * `required_keywords` 引数として注入する（設計書 §5.1）。
 *
 * 形式: questionId → 必須キーワード配列
 *
 * 注意:
 *  - キーワードは「概念単位」で登録する（同義語・表記ゆれは別途 synonym で吸収）
 *  - LLM側で意味的言い換えを評価するため、ここでの厳密一致は補助シグナル
 *  - 過去問データインポート時に csv → 本辞書を自動生成するパイプラインを #176 で実装予定
 */

export interface KeywordEntry {
  /** 主キーワード（模範解答での代表表記） */
  primary: string;
  /** 同義語・表記ゆれ（マッチ時に primary とみなす） */
  synonyms?: string[];
  /** このキーワードが当該設問でどれほど重要か（0-1, 省略時は 1） */
  importance?: number;
}

export type KeywordDictionary = Record<string, KeywordEntry[]>;

/**
 * シードデータ。過去問インポートで段階的に拡充する。
 * 形式の妥当性確認とテスト用途に、AP午後の代表的な設問を数件登録。
 */
export const SHORT_ANSWER_KEYWORD_DICTIONARY: KeywordDictionary = {
  // 応用情報 R5春 午後 問1（情報セキュリティ）想定例
  'AP-2023S-PM-01-q1': [
    { primary: '多要素認証', synonyms: ['多段階認証', 'MFA'] },
    { primary: '権限昇格', synonyms: ['特権昇格'] },
    { primary: '最小権限の原則', synonyms: ['最小権限'] },
  ],
  // 応用情報 R5春 午後 問1 設問2 想定例
  'AP-2023S-PM-01-q2': [
    { primary: 'ログ監視' },
    { primary: 'インシデント対応' },
    { primary: 'SIEM' },
  ],
  // 応用情報 R5春 午後 問4（システムアーキテクチャ）想定例
  'AP-2023S-PM-04-q1': [
    { primary: 'スケールアウト', synonyms: ['水平スケール'] },
    { primary: 'ロードバランサ', synonyms: ['LB', '負荷分散装置'] },
    { primary: 'ステートレス' },
  ],
};

/**
 * 与えられた問題IDに対する必須キーワードを返す。
 * 該当エントリが無ければ空配列を返す（採点プロセスはキーワード辞書なしでも動作可能）。
 */
export function getRequiredKeywords(questionId: string): KeywordEntry[] {
  return SHORT_ANSWER_KEYWORD_DICTIONARY[questionId] ?? [];
}

/**
 * ユーザー解答テキストから必須キーワード（および同義語）にヒットしたものを返す。
 * 完全一致・部分一致のみ。意味的言い換えは LLM 側で評価する想定。
 */
export function detectMatchedKeywords(
  userAnswer: string,
  required: KeywordEntry[],
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const entry of required) {
    const candidates = [entry.primary, ...(entry.synonyms ?? [])];
    if (candidates.some((c) => userAnswer.includes(c))) {
      matched.push(entry.primary);
    } else {
      missing.push(entry.primary);
    }
  }
  return { matched, missing };
}
