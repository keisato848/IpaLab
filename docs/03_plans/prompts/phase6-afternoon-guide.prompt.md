## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 7.1「システムプロンプト」に基づき、
午後問題とサイトガイドモードの対応を完成させてください。

### タスク

1. `apps/web/lib/ai-assistant/context-builder.ts` を拡張
   - 午後問題（isDescriptive: true）の場合、コンテキストブロックに以下を追加:
     - 問題文の全文（長文の場合は最初の 3000 文字まで）
     - ユーザーの記述解答
     - 模範解答（あれば）
   - プロンプトに「ステップバイステップで解答プロセスを指導してください」を追加

2. サイトガイドモードの動作確認と調整
   - 演習画面以外で「質問する」を選んだ場合、CategorySelector をスキップして直接 site-guide チャットに遷移
   - site-guide のシステムプロンプトがサイト機能に関する質問のみ応答するよう制限されていることを確認
   - サイト外の話題への応答: 「申し訳ございませんが、シカクノの機能に関する質問のみお答えできます」

3. 午後問題コンテキストのサイズ制限
   - context-builder で questionText + userAnswer の合計トークン数を推定
   - 合計が 4000 文字を超える場合はトランケートし、末尾に「...（省略）」を付与

### 既存コードの参照
- `apps/web/lib/ai-assistant/context-builder.ts` — Phase 4 で作成済みのプロンプト構築
- `apps/web/components/features/exam/QuestionClient.tsx` — 午後問題の isDescriptive フラグ

### 制約
- トランケートは文単位（。で区切り）で行い、文の途中で切らない
- site-guide モードではコンテキスト注入を行わない（context は undefined）
