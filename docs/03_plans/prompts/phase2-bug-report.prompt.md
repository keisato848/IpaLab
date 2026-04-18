## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 5.2「POST /api/ai-assistant/bug-report」に基づき、
障害報告フォームと GitHub Issues 自動起票を実装してください。

### タスク

1. `apps/web/lib/ai-assistant/github-issues.ts` を作成
   - Octokit を使用して GitHub Issues を作成する関数
   - `createBugReportIssue(params: { description, pageUrl, userAgent, errorLogs?, screenshotUrl? }): Promise<{ number, html_url }>`
   - ラベル: ["bug", "ai-assistant-report"]
   - タイトル: `[AI Assistant] ${description の先頭50文字}`
   - ボディ: Markdown テンプレート（報告内容、URL、UA、エラーログ、スクリーンショットリンク）
   - 環境変数: GITHUB_ISSUES_TOKEN, GITHUB_ISSUES_REPO

2. `apps/web/app/api/ai-assistant/bug-report/route.ts` を作成
   - POST ハンドラ: multipart/form-data を受信
   - 認証: getServerSession(authOptions) で検証、未認証なら 401
   - レート制限: CosmosDB BugReports コンテナで本日の userId のレコード数を確認、5 件以上なら 429
   - バリデーション: description 必須 1-2000文字、pageUrl 必須
   - screenshot がある場合: Azure Blob Storage にアップロードして URL を取得
   - github-issues.ts で Issue を作成
   - CosmosDB BugReports に記録を保存
   - レスポンス: { success: true, issueNumber, issueUrl }

3. `apps/web/components/features/ai-assistant/BugReportForm.tsx` を作成
   - フォームフィールド:
     - description: textarea（必須、2000文字上限、文字数カウンター表示）
     - screenshot: ScreenshotCapture コンポーネント（Phase 3 で実装、この段階ではプレースホルダー）
   - 自動収集（hidden）: window.location.href, navigator.userAgent
   - エラーログ自動収集: window.__errorLogs（最大10件）を JSON で送信
   - 送信後: panelState を 'submitted' に遷移、Issue 番号とリンクを表示
   - ローディング中: ボタン無効化 + スピナー表示
   - エラー時: エラーメッセージをフォーム上部に表示

### 既存コードの参照
- `apps/web/auth.ts` — authOptions のインポートパスと getServerSession の使い方
- `apps/web/lib/cosmos.ts` — getContainer の使い方
- `apps/web/app/api/score/route.ts` — 既存の API Route Handler パターン（認証チェック、エラーレスポンス形式）
- `docs/02_design/15_CommonApiAndErrorDesign.md` — 共通エラーレスポンス形式

### 制約
- multipart/form-data のパースには Next.js 組み込みの request.formData() を使用
- GitHub PAT はサーバーサイドのみで使用（クライアントに露出させない）
- エラーレスポンスは既存の共通 API 設計に準拠: { error: string, code?: string }
