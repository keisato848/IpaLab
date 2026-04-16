## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 6「コンポーネント設計」およびセクション 9「CSS 設計」に基づき、
AIアシスタントウィジェットの骨格を作成してください。

### タスク

1. `apps/web/hooks/use-ai-assistant.ts` を作成
   - 状態型:
     ```ts
     type PanelState = 'closed' | 'menu' | 'bug-form' | 'category' | 'chat' | 'submitted';
     ```
   - 管理する状態: panelState, messages, remainingQuota, category, currentPage, examContext, bugReportResult
   - 公開するアクション: openPanel, closePanel, goToMenu, goToBugForm, goToCategory, goToChat, reset

2. `apps/web/components/features/ai-assistant/FloatingButton.tsx` を作成
   - 右下固定ボタン（FAB）
   - クリックでパネル展開/閉鎖をトグル
   - position: fixed, right: 24px, bottom: 24px, z-index: 1050
   - 💬 アイコン（展開時は ✕ に切替）
   - アニメーション: scale transform on hover

3. `apps/web/components/features/ai-assistant/AssistantPanel.tsx` を作成
   - panelState に応じて InitialMenu / BugReportForm / CategorySelector / ChatView を切替
   - PC: 右下固定パネル 400px × 500px, z-index: 1060
   - SP (≤768px): position: fixed; inset: 0（全画面）
   - ヘッダーに「AIアシスタント」タイトルと閉じるボタン

4. `apps/web/components/features/ai-assistant/InitialMenu.tsx` を作成
   - 2つのメニューボタン: 「🐛 障害を報告する」「💡 質問する」
   - 障害報告 → panelState を 'bug-form' に
   - 質問する → panelState を 'category' に（演習画面の場合）/ 'chat' に（その他の画面、category='site-guide'）

5. `apps/web/components/features/ai-assistant/AiAssistantWidget.tsx` を作成
   - エントリポイント。FloatingButton + AssistantPanel を統合
   - 'use client' コンポーネント
   - 条件判定:
     - useSession() で未ログインなら null を返す
     - usePathname() で '/' '/login' '/register' を除外
     - フィーチャーフラグ ai_assistant_enabled が false なら null を返す
   - data-ai-assistant 属性を付与（スクリーンショット除外用）

6. `apps/web/components/features/ai-assistant/ai-assistant.module.css` を作成
   - 既存 CSS 変数を使用: --bg-secondary, --text-primary, --accent-color, --border-color, --card-shadow
   - data-theme="dark" で自動切替（追加の変数定義は不要）
   - FAB: 56px 丸ボタン, box-shadow, hover scale(1.1)
   - パネル: border-radius: 12px, overflow: hidden
   - SP 全画面: @media (max-width: 768px) { .panel { position: fixed; inset: 0; border-radius: 0; } }

7. `apps/web/app/layout.tsx` を修正
   - ThemeProvider の {children} の後に <AiAssistantWidget /> を追加
   - dynamic import で code splitting: `const AiAssistantWidget = dynamic(() => import(...), { ssr: false })`

### 既存コードの参照
- `apps/web/app/layout.tsx` — Provider チェーンの構造を確認
- `apps/web/app/(main)/layout.tsx` — サイドバーの z-index を確認
- `apps/web/app/globals.css` — 利用可能な CSS 変数一覧を確認
- `apps/web/app/(main)/layout.module.css` — 既存 CSS Modules のスタイル慣例を確認
- `apps/web/lib/feature-flags.ts` — getFeatureFlag の使い方を確認

### 制約
- すべてのコンポーネントは 'use client' で作成
- CSS は CSS Modules のみ使用（インラインスタイル禁止）
- 既存の globals.css の CSS 変数を活用し、新しい変数は追加しない
