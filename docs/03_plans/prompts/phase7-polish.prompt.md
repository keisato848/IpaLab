## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 9「CSS 設計」に基づき、
ダークモード対応、モバイルレスポンシブ、アクセシビリティを完成させてください。

### タスク

1. `ai-assistant.module.css` のダークモード対応
   - 既存の CSS 変数（--bg-secondary, --text-primary, --accent-color 等）を使用しているため、
     data-theme="dark" で自動切替されることを確認
   - 追加のダークモード固有スタイルが必要な場合は [data-theme="dark"] セレクタで対応
   - チャットメッセージバブルの背景色がダークモードで読みやすいか確認

2. モバイルレスポンシブ
   - @media (max-width: 768px) でパネルを全画面表示:
     ```css
     .panel { position: fixed; inset: 0; width: 100%; height: 100%; border-radius: 0; }
     ```
   - FAB ボタン: SP では right: 16px, bottom: 16px に調整
   - パネルヘッダー: SP では戻るボタン（←）を追加、閉じるはヘッダー左に配置
   - キーボード表示時の入力欄位置調整: visualViewport API を使用

3. アクセシビリティ
   - FAB ボタン: aria-label="AIアシスタントを開く", role="button"
   - パネル: role="dialog", aria-modal="true", aria-label="AIアシスタント"
   - フォーカストラップ: パネル展開中は Tab キーがパネル内で循環
   - Escape キーでパネルを閉じる
   - チャットメッセージ: role="log", aria-live="polite" で新しいメッセージを読み上げ
   - 送信ボタン: aria-label="メッセージを送信"
   - RateLimitBadge: aria-label="残り質問回数 N回"
   - すべてのインタラクティブ要素に :focus-visible スタイルを設定

4. E2E テスト (`apps/web/e2e/ai-assistant.spec.ts`)
   - テストシナリオ:
     a. FAB クリック → パネル展開 → メニュー表示
     b. 障害報告フロー: フォーム入力 → 送信 → 完了表示（GitHub API はモック）
     c. Q&A フロー: カテゴリ選択 → 質問入力 → ストリーミング応答表示（Gemini API はモック）
     d. レート制限: 10回使用後 → 入力無効化メッセージ表示
     e. モバイル表示: viewport 375px でパネルが全画面展開
     f. ダークモード: data-theme="dark" でコントラスト確認
     g. Escape キーでパネル閉鎖

### 既存コードの参照
- `apps/web/app/globals.css` — CSS 変数のダークモード定義を確認
- `apps/web/app/(main)/layout.module.css` — 既存のレスポンシブパターン
- `apps/web/e2e/` — 既存の E2E テストのセットアップとパターン

### 制約
- WCAG 2.1 AA 準拠を目標
- 新しい CSS 変数は追加しない（既存変数のみ使用）
- E2E テストの外部 API は必ずモック化
