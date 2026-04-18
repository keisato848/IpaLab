## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 5.1「POST /api/ai-assistant/chat」、
セクション 5.3「GET /api/ai-assistant/usage」、セクション 7「Gemini プロンプト設計」に基づき、
チャット機能とレート制限を実装してください。

### タスク

1. `apps/web/lib/ai-assistant/rate-limiter.ts` を作成
   - `checkRateLimit(userId: string): Promise<{ allowed: boolean; used: number; remaining: number }>`
   - CosmosDB AiAssistantUsage コンテナに対し、本日（JST 0:00〜23:59）の userId のレコード数をクエリ
   - 上限: 10 回/日
   - `recordUsage(userId: string, category: string, questionId?: string, examId?: string): Promise<void>`
   - AiAssistantUsage にレコードを INSERT（id は cuid()、usedAt は ISO 8601）

2. `apps/web/lib/ai-assistant/context-builder.ts` を作成
   - Category 型: "qa-explain" | "qa-related" | "qa-analysis" | "qa-afternoon" | "site-guide"
   - SYSTEM_PROMPTS: カテゴリごとのシステムプロンプト（設計書セクション 7.1 の内容をそのまま使用）
   - `buildPrompt(category, message, context?): { systemPrompt: string; userMessage: string }`
   - context がある場合、ユーザーメッセージに問題情報ブロックを付与（設計書セクション 7.2 のフォーマット）

3. `apps/web/lib/ai-assistant/gemini-chat.ts` を作成
   - `streamChatResponse(systemPrompt: string, userMessage: string): AsyncGenerator<string>`
   - @google/generative-ai パッケージを使用（既存の apps/web/app/api/score/route.ts と同じパターン）
   - モデル: gemini-2.5-flash
   - generateContentStream() でストリーミング応答を取得
   - 安全設定: 設計書セクション 7.3 の safetySettings をそのまま適用

4. `apps/web/app/api/ai-assistant/chat/route.ts` を作成
   - POST ハンドラ（SSE ストリーミング）
   - 処理フロー:
     a. getServerSession で認証チェック（401）
     b. リクエストボディをパース・バリデーション
     c. checkRateLimit で制限チェック（429 → { error, remaining: 0 }）
     d. buildPrompt でプロンプト構築
     e. streamChatResponse でストリーミング開始
     f. ReadableStream + TextEncoder で SSE 形式でクライアントに送信
     g. 完了後 recordUsage でカウント記録
     h. 最後に { done: true, remaining } を送信
   - レスポンスヘッダー: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
   - SSE フォーマット: `data: {"token":"テキスト"}\n\n` / `data: {"done":true,"remaining":7}\n\n`

5. `apps/web/app/api/ai-assistant/usage/route.ts` を作成
   - GET ハンドラ
   - getServerSession で認証チェック（401）
   - checkRateLimit で現在の使用状況を取得
   - レスポンス: { used, limit: 10, remaining, resetsAt: "本日 JST 24:00 の ISO 8601" }

6. `apps/web/components/features/ai-assistant/ChatView.tsx` を作成
   - メッセージ一覧表示（チャットUI）
   - テキスト入力欄 + 送信ボタン
   - SSE クライアント: EventSource または fetch + ReadableStream でストリーミング受信
   - 受信中のメッセージはリアルタイムで文字追加表示
   - 自動スクロール: 新しいメッセージ/トークン追加時にスクロール最下部へ
   - 送信中は入力無効化
   - レート制限到達時: 入力欄を無効化し「本日の質問回数上限に達しました」を表示

7. `apps/web/components/features/ai-assistant/ChatMessage.tsx` を作成
   - role='user' と role='assistant' で左右に分ける
   - assistant メッセージは Markdown レンダリング（既存のマークダウン表示があれば同じライブラリを使用）
   - タイムスタンプ表示（HH:mm形式）

8. `apps/web/components/features/ai-assistant/RateLimitBadge.tsx` を作成
   - パネルヘッダーに残回数を表示: 「残り 7/10 回」
   - 残3回以下で警告色（--error-text）
   - 0回で「明日リセットされます」を表示

### 既存コードの参照
- `apps/web/app/api/score/route.ts` — Gemini API の使い方（GoogleGenerativeAI, getGenerativeModel, generateContent のパターン）
- `apps/web/lib/cosmos.ts` — getContainer, クエリの書き方
- `apps/web/auth.ts` — authOptions のインポートパス

### 制約
- SSE はネイティブの Web API（ReadableStream + TextEncoder）で実装、追加ライブラリ不要
- Gemini のストリーミングエラー時は SSE で { error: "回答の生成に失敗しました" } を送信してストリームを閉じる
- JST 日付の判定は UTC+9 で計算（new Date() に +9h してから日付を取得）
- API Route からのレスポンスに runtime = 'nodejs' を指定（ストリーミング対応）
