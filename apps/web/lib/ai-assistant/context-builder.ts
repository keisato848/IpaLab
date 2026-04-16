import type { ExamContext, Category } from '@/hooks/use-ai-assistant';

const QA_EXPLAIN_PROMPT = `あなたは情報処理技術者試験の学習アシスタントです。
与えられた問題の解説をさらに詳しく、初学者にもわかるように説明してください。
具体例を交えて、なぜその答えが正しいのかを論理的に解説してください。
回答は日本語で、Markdown 形式で返してください。`;

const QA_RELATED_PROMPT = `あなたは情報処理技術者試験の学習アシスタントです。
与えられた問題に関連する概念、用語、過去の類似問題を提示してください。
体系的な理解を促すように、関連分野のつながりを示してください。
回答は日本語で、Markdown 形式で返してください。`;

const QA_ANALYSIS_PROMPT = `あなたは情報処理技術者試験の学習アシスタントです。
ユーザーが選んだ誤答に基づいて、なぜその選択肢を選びやすいのかを分析してください。
正解との違いを明確にし、同様のミスを防ぐためのポイントを示してください。
回答は日本語で、Markdown 形式で返してください。`;

const QA_AFTERNOON_PROMPT = `あなたは情報処理技術者試験の午後問題の学習アシスタントです。
長文読解のポイント解説、模範解答との比較・添削、
解答プロセスのステップバイステップ指導を行ってください。
回答は日本語で、Markdown 形式で返してください。`;

const SITE_GUIDE_PROMPT = `あなたは「シカクノ」サイトの使い方ガイドです。
以下の機能について案内してください:
- ダッシュボード: 学習目標、進捗、正答率、ヒートマップ
- 演習・模擬試験: 区分・時間帯フィルタ、練習/模擬試験モード
- 学習計画: AI による学習プラン生成
- 学習履歴: 過去の学習ログ
- 設定: ダークモード、統計表示
サイト外の質問には「申し訳ございませんが、シカクノの機能に関する質問のみお答えできます」と回答してください。
回答は日本語で、Markdown 形式で返してください。`;

const SYSTEM_PROMPTS: Record<Category, string> = {
    'qa-explain': QA_EXPLAIN_PROMPT,
    'qa-related': QA_RELATED_PROMPT,
    'qa-analysis': QA_ANALYSIS_PROMPT,
    'qa-afternoon': QA_AFTERNOON_PROMPT,
    'site-guide': SITE_GUIDE_PROMPT,
};

const MAX_CONTEXT_LENGTH = 4000;

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    // 文単位（。で区切り）でトランケート
    const sentences = text.split('。');
    let result = '';
    for (const sentence of sentences) {
        if ((result + sentence + '。').length > maxLength) break;
        result += sentence + '。';
    }
    if (!result) {
        // 一文が長すぎる場合はそのまま切る
        result = text.slice(0, maxLength);
    }
    return result + '...（省略）';
}

function buildContextBlock(context: ExamContext): string {
    let questionText = context.questionText;
    let userAnswer = context.userAnswer;

    // 午後問題のサイズ制限
    if (context.isDescriptive) {
        const totalLength = questionText.length + userAnswer.length;
        if (totalLength > MAX_CONTEXT_LENGTH) {
            const maxQuestionLength = Math.min(questionText.length, 3000);
            questionText = truncateText(questionText, maxQuestionLength);
            const remainingLength = MAX_CONTEXT_LENGTH - questionText.length;
            if (userAnswer.length > remainingLength) {
                userAnswer = truncateText(userAnswer, remainingLength);
            }
        }
    }

    return `--- 問題情報 ---
問題文: ${questionText}
ユーザーの回答: ${userAnswer}
正解: ${context.correctAnswer}
判定: ${context.isCorrect ? '正解' : '不正解'}
既存の解説: ${context.explanation}
--- ここまで ---`;
}

export function buildPrompt(
    category: Category,
    message: string,
    context?: ExamContext,
): { systemPrompt: string; userMessage: string } {
    const systemPrompt = SYSTEM_PROMPTS[category];

    if (!context || category === 'site-guide') {
        return { systemPrompt, userMessage: message };
    }

    const contextBlock = buildContextBlock(context);
    const userMessage = `${contextBlock}\n\nユーザーの質問: ${message}`;

    return { systemPrompt, userMessage };
}
