## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 8「スクリーンショットマスキング」に基づき、
スクリーンショットキャプチャとマスキング機能を実装してください。

### タスク

1. `apps/web/lib/ai-assistant/screenshot-masker.ts` を作成
   - `captureWithMasking(): Promise<Blob>` を export
   - マスキング対象セレクタ: '[data-user-identity]', '[data-testid="user-name"]', '.user-display-name'
   - 処理フロー:
     a. 対象要素の textContent を '****' に置換（元の値を保存）
     b. html2canvas で document.body をキャプチャ（ignoreElements で [data-ai-assistant] を除外）
     c. finally ブロックで必ず元の textContent を復元
   - canvas.toBlob で PNG 形式の Blob を返す

2. `apps/web/lib/ai-assistant/blob-upload.ts` を作成
   - サーバーサイド関数: `uploadScreenshot(blob: Buffer, userId: string): Promise<string>`
   - Azure Blob Storage SDK (@azure/storage-blob) を使用
   - ファイル名: `screenshots/${userId}/${Date.now()}.png`
   - Content-Type: image/png
   - アップロード後の Blob URL を返す

3. `apps/web/components/features/ai-assistant/ScreenshotCapture.tsx` を作成
   - 「📸 スクリーンショットを添付」ボタン
   - クリックで captureWithMasking() を実行
   - キャプチャ後: サムネイルプレビューを表示（max-height: 150px）
   - 削除ボタン（✕）でスクリーンショットを除去
   - キャプチャ中: ローディングインジケーター
   - エラー時: 「スクリーンショットの取得に失敗しました」を表示、フォーム送信は可能（スクショは任意）
   - props: `onCapture: (blob: Blob | null) => void`

4. `BugReportForm.tsx` を修正して ScreenshotCapture を統合

5. ユーザー名のマスキング属性を追加
   - `apps/web/components/features/auth/UserMenu.tsx` のユーザー名表示要素に `data-user-identity` 属性を追加
   - その他ユーザー名を表示している箇所があれば同様に属性を追加

### 既存コードの参照
- `apps/web/components/features/auth/UserMenu.tsx` — ユーザー名の表示箇所
- html2canvas の API ドキュメント（ignoreElements オプション）

### 制約
- html2canvas は dynamic import で遅延ロード（バンドルサイズ最適化）
- マスキングの復元は try/finally で必ず実行すること
- blob-upload.ts はサーバーサイドのみ（'use server' または API Route 内で使用）
- ユーザーの PII（個人情報）がスクリーンショットに含まれないことを保証すること
