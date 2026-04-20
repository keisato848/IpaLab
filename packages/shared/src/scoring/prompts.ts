import { EssayPerspectiveDef, EssaySubQuestion, ShortAnswerPerspectiveDef } from './types';

/**
 * 観点別 採点プロンプト雛形
 * 設計書 §5 / docs/02_design/14_AfternoonAIScoring_Rubric.md
 *
 * バックエンド (#176) は本モジュールでプロンプトを生成し、LLM プロバイダ
 * （Azure OpenAI 等）に投入する。プロンプトは観点ごとに独立し、並列呼び出し可能。
 */

export interface ShortAnswerPromptInput {
  perspective: ShortAnswerPerspectiveDef;
  questionText: string;
  modelAnswer: string;
  requiredKeywords: string[];
  charLimit: number;
  userAnswer: string;
}

export function buildShortAnswerPrompt(input: ShortAnswerPromptInput): string {
  const { perspective, questionText, modelAnswer, requiredKeywords, charLimit, userAnswer } = input;
  return [
    'あなたは情報処理試験の午後試験（記述式）採点官です。',
    `以下のユーザー解答を、観点「${perspective.name}」（${perspective.criteria}）に基づいて 0〜100 のスコアで評価し、`,
    '加点・減点の根拠を 2 文以内で日本語で出力してください。',
    '',
    `【設問】 ${questionText}`,
    `【模範解答】 ${modelAnswer}`,
    `【必須キーワード】 ${requiredKeywords.join('、') || '（指定なし）'}`,
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
