import { EssayPerspectiveDef, EssaySubQuestion, ShortAnswerPerspectiveDef } from './types';
import type { KeywordEntry } from './keywords/dictionary';

/**
 * 観点別 採点プロンプト雛形
 * 設計書 §5 / docs/02_design/14_AfternoonAIScoring_Rubric.md
 *
 * バックエンド (#176) は本モジュールでプロンプトを生成し、LLM プロバイダ
 * （Azure OpenAI 等）に投入する。プロンプトは観点ごとに独立し、並列呼び出し可能。
 */

/**
 * ティア別にラベルを付けてキーワード群を整形する。
 * LLM に「公式必須」「公式参考」「自社統計推奨」「LLM参考」の差別を伝える。
 */
function formatKeywordsByTier(keywords: KeywordEntry[]): string {
  if (keywords.length === 0) return '（指定なし）';
  const grouped: Record<string, string[]> = { T1: [], T2: [], T3: [], T4: [] };
  for (const k of keywords) grouped[k.tier].push(k.primary);
  const labels: Record<string, string> = {
    T1: '【最重要・IPA公式講評の加点要件】',
    T2: '【必須・IPA公式解答例の主要句】',
    T3: '【推奨・自社統計の頻出語】',
    T4: '【参考・LLM抽出候補】',
  };
  const lines: string[] = [];
  for (const tier of ['T1', 'T2', 'T3', 'T4']) {
    if (grouped[tier].length > 0) {
      lines.push(`${labels[tier]} ${grouped[tier].join('、')}`);
    }
  }
  return '\n  ' + lines.join('\n  ');
}

export interface ShortAnswerPromptInput {
  perspective: ShortAnswerPerspectiveDef;
  questionText: string;
  modelAnswer: string;
  /** ティア情報を含むキーワードエントリ配列 (推奨)。文字列配列を渡された場合は T2 互換扱い */
  requiredKeywords: KeywordEntry[] | string[];
  charLimit: number;
  userAnswer: string;
}

export function buildShortAnswerPrompt(input: ShortAnswerPromptInput): string {
  const { perspective, questionText, modelAnswer, requiredKeywords, charLimit, userAnswer } = input;
  const keywordSection: string =
    requiredKeywords.length === 0
      ? '（指定なし）'
      : typeof requiredKeywords[0] === 'string'
        ? (requiredKeywords as string[]).join('、')
        : formatKeywordsByTier(requiredKeywords as KeywordEntry[]);
  return [
    'あなたは情報処理試験の午後試験（記述式）採点官です。',
    `以下のユーザー解答を、観点「${perspective.name}」（${perspective.criteria}）に基づいて 0〜100 のスコアで評価し、`,
    '加点・減点の根拠を 2 文以内で日本語で出力してください。',
    '',
    `【設問】 ${questionText}`,
    `【模範解答】 ${modelAnswer}`,
    `【必須キーワード】${keywordSection}`,
    '  ※ 最重要(T1)>必須(T2)>推奨(T3)>参考(T4) の順で重み付けして評価してください。',
    `【字数制限】 ${charLimit}字以内`,
    `【ユーザー解答】 ${userAnswer}`,
    '',
    '出力 (JSON):',
    '{',
    '  "score": <0-100>,',
    '  "matched_keywords": [...],',
    '  "missing_keywords": [...],',
    '  "rationale": "<2 文以内>"',
    '}',
  ].join('\n');
}

export interface EssayPromptInput {
  perspective: EssayPerspectiveDef;
  examType: 'PM' | 'SA' | 'ST';
  theme: string;
  subQuestion: EssaySubQuestion;
  subQuestionRequirements: string;
  charMin: number;
  charMax: number;
  scoringPoints: string[];
  userAnswerForSubQuestion: string;
}

export function buildEssayPrompt(input: EssayPromptInput): string {
  const {
    perspective,
    examType,
    theme,
    subQuestion,
    subQuestionRequirements,
    charMin,
    charMax,
    scoringPoints,
    userAnswerForSubQuestion,
  } = input;
  return [
    'あなたは情報処理試験の論述式（小論文）採点官です。IPA公式の採点ランク（A/B/C/D）と',
    `評価観点に基づき、設問${subQuestion}に対する解答を観点「${perspective.name}」（${perspective.criteria}）で評価してください。`,
    '',
    `【試験区分】 ${examType}午後II`,
    `【全体テーマ】 ${theme}`,
    `【当該設問の要求事項】 ${subQuestionRequirements}`,
    `【字数要件】 ${charMin}〜${charMax} 字`,
    `【模範解答骨子・採点ポイント】`,
    ...scoringPoints.map((p) => `- ${p}`),
    '',
    '【ユーザー解答（当該設問分）】',
    userAnswerForSubQuestion,
    '',
    '評価ルール:',
    '- 「具体性・実体験性」観点では、固有名詞・役割・規模・数値の有無を重視',
    '- 「設問要求への適合」観点では、設問が問うている事項に正面から答えているかを重視',
    '- 抽象的・一般論的な記述は減点',
    '',
    '出力 (JSON):',
    '{',
    '  "score": <0-100>,',
    '  "rationale": "<3 文以内>",',
    '  "evidence_quotes": ["<解答からの引用1>", "<引用2>"],',
    '  "improvement_hint": "<次回への具体的助言 1 文>"',
    '}',
  ].join('\n');
}
