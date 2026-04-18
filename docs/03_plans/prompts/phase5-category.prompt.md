## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 6.2「状態管理」に基づき、
カテゴリ選択UIと演習画面からの問題コンテキスト注入を実装してください。

### タスク

1. `apps/web/components/features/ai-assistant/CategorySelector.tsx` を作成
   - 4つのカテゴリボタンをカード形式で表示:
     - 📖 解説を深掘り (qa-explain)
     - ❓ 誤答を分析する (qa-analysis)
     - ❌ 誤答を分析する (qa-analysis) — 不正解時のみ表示
     - 📝 午後問題を解説 (qa-afternoon) — 午後問題の場合のみ表示
   - 選択後、panelState を 'chat' に遷移し category をセット
   - 演習画面以外の場合はこの画面をスキップし、自動で category='site-guide' でチャットに遷移

2. `apps/web/hooks/use-ai-assistant.ts` を拡張
   - examContext を外部から注入する setExamContext 関数を追加
   - currentPage を pathname から自動判定:
     - pathname が /exam/ を含む → 'exam'
     - その他 → 'other'

3. `apps/web/components/features/exam/QuestionClient.tsx` を修正
   - AI アシスタントに現在の問題コンテキストを渡す仕組みを追加
   - 方法: Context API または window カスタムイベント (CustomEvent) で ExamContext を公開
   - 必要な情報: questionId, questionText, userAnswer, correctAnswer, explanation, isCorrect, examId, isDescriptive

### 既存コードの参照
- `apps/web/components/features/exam/QuestionClient.tsx` — 問題データの構造と state を確認
- `apps/web/components/features/exam/AIAnswerBox.tsx` — 既存の AI 連携コンポーネントのデータ受け渡しパターン
- `apps/web/hooks/use-ai-assistant.ts` — Phase 1 で作成済みの hook

### 制約
- QuestionClient への変更は最小限に（既存ロジックを壊さない）
- ExamContext の受け渡しは Context API を使い、グローバル state は避ける
- カテゴリ表示の条件分岐（不正解時のみ、午後問題のみ）を正確に実装すること
