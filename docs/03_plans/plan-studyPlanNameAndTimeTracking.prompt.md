# Plan: 学習計画名の改善 + 学習時間トラッキング

**TL;DR**: 現在 Gemini AI が「AP完全制覇プラン」のようなキャッチーなタイトルを自動生成しているが、これを「応用情報技術者試験 2026/04/19 5h/週」のような実用的な初期値に変更し、ユーザーが計画名を自由に編集できるようにする。また、問題解答時間の集計表示と、読書等の手動学習時間記録（タイマー＋事後入力）機能を新設する。

## 前提: 発見された技術的課題

- `hoursWeekday`/`hoursWeekend` はAPIリクエスト時のみ使われ、`StudyPlan` オブジェクトに保存されない → 初期値生成のためにデータモデル拡張が必要
- `StudyPlan` 型が GoalSettingWizard.tsx と api.ts に重複定義されている
- 試験コード → 日本語正式名の変換は exam-utils.ts に3種のみ（IP, SC, PM, NW, SA, ST が未定義）
- `packages/ui/` は空で共通UIコンポーネントは存在しない

---

## Steps

### Phase 1: データモデル拡張とユーティリティ整備

1. **試験種別コード→正式名マッピングの追加** — apps/web/lib/exam-utils.ts に `getExamTypeName(code: string): string` 関数を追加。8種全て（IP→ITパスポート試験, FE→基本情報技術者試験, AP→応用情報技術者試験, SC→情報処理安全確保支援士試験, PM→プロジェクトマネージャ試験, NW→ネットワークスペシャリスト試験, SA→システムアーキテクト試験, ST→ITストラテジスト試験）のマッピングを定義

2. **`StudyPlan` 型にフィールド追加** — GoalSettingWizard.tsx L14-L45 の `StudyPlan` インターフェースに以下を追加:
   - `hoursWeekday?: number` — 平日の学習時間（既存入力値を保存するため）
   - `hoursWeekend?: number` — 休日の学習時間
   - api.ts L92-L128 の重複定義も同期して更新

3. **学習セッション型の新設** — apps/web/lib/api.ts に `StudySession` インターフェースを追加:
   - `id: string`, `userId?: string`, `startTime: string`, `endTime: string`, `durationSeconds: number`, `category: 'exam' | 'reading' | 'review' | 'other'`, `memo?: string`, `createdAt: string`

### Phase 2: 計画名の初期値変更

4. **計画名の自動生成ロジック** — GoalSettingWizard.tsx L173-L177 の `handleSavePlan` 内で、AIが返す `rawPlan.title` を以下のフォーマットでオーバーライド:
   - フォーマット: `{getExamTypeName(targetExam)} {examDate} {weeklyHours}h/週`
   - 例: `応用情報技術者試験 2026/04/19 5h/週`
   - 週間学習時間の計算: `(hoursWeekday * 5 + hoursWeekend * 2)` を週単位で丸める
   - `hoursWeekday` と `hoursWeekend` もプランオブジェクトに保存

### Phase 3: 計画名の編集機能

5. **AI生成直後のプレビュー画面でのタイトル編集** — GoalSettingWizard.tsx の Step 3（結果表示領域）に、タイトルを `<input type="text">` で表示し、保存前にユーザーが自由に編集できるようにする

6. **学習計画ページ (/plan) でのインライン編集** — PlanViewer.tsx L160 の `<h2>{activePlan.title}</h2>` を、クリック or 編集アイコン（✏️）で `<input>` にトグルするインライン編集コンポーネントに変更。既存の `handleUpdatePlan` 関数（L91-L95）を活用して localStorage に保存

7. **ダッシュボードのドロップダウン表示の修正** — DashboardClient.tsx L228-L233 で `title` の文字列から `targetExam` を推測するロジックがあるが、`targetExam` フィールドを直接参照するよう修正（タイトル編集後も正しく動作するため）

### Phase 4: 学習時間トラッキング — 既存データ集計

8. **学習時間集計ユーティリティの作成** — `apps/web/lib/study-time-utils.ts`（新規）に以下の集計関数を実装:
   - `getDailyStudyTime(records: LearningRecord[], date: string): number` — 特定日の合計学習秒数
   - `getWeeklyStudyTime(records: LearningRecord[], weekStart: Date): number`
   - `getMonthlyStudyTime(records: LearningRecord[], year: number, month: number): number`
   - `LearningRecord.timeTakenSeconds` と `StudySession.durationSeconds` を合算

9. **ダッシュボードに学習時間ウィジェット追加** — DashboardClient.tsx のグリッド内に「学習時間」セクションを追加。今日/今週/今月の学習時間を表示。既存の「今日の進捗」「通算正答率」ウィジェットと同じ `statusCard` スタイルで統一

10. **学習計画ページに学習時間実績を表示** — PlanViewer.tsx の詳細表示エリアに、計画の `hoursWeekday`/`hoursWeekend` 設定値と実績の比較表示を追加

### Phase 5: 学習時間トラッキング — 手動記録機能

11. **学習セッションの保存・取得ロジック** — ゲストユーザーは `localStorage`（キー: `ipalab_study_sessions`）、認証ユーザーは CosmosDB（将来対応、まずは localStorage のみ）に保存する関数を guest-manager.ts および関連ファイルに追加

12. **学習タイマーコンポーネントの新設** — `apps/web/components/features/dashboard/StudyTimer.tsx`（新規）:
    - 開始/一時停止/停止ボタン（ストップウォッチUI）
    - カテゴリ選択（問題演習/読書/復習/その他）
    - メモ入力（任意）
    - 停止時に `StudySession` として保存
    - ダッシュボードの学習時間ウィジェット内に配置

13. **事後入力フォームの追加** — 同じ `StudyTimer.tsx` 内にタブ切替で「手動入力」モードを用意:
    - 日付選択、時間入力（時間:分）、カテゴリ選択、メモ
    - 登録ボタンで `StudySession` として保存

### Phase 6: 設計書・テスト更新

14. **設計書更新** — docs/ai-planner-design.md に以下を追記:
    - `StudyPlan` データモデルの `hoursWeekday`, `hoursWeekend` フィールド追加
    - `StudySession` 新規データモデルの定義
    - 計画名の命名ルールとユーザー編集仕様
    - 学習時間トラッキング機能の設計

15. **E2Eテスト** — 以下のシナリオを追加:
    - 計画名が初期値フォーマットで表示されることの確認
    - 計画名の編集（PlanViewer + GoalSettingWizard プレビュー）
    - 学習タイマーの動作
    - 学習時間ウィジェットの表示

---

## Verification

- `npm run test:unit` — ユニットテスト（`study-time-utils.ts` の集計ロジック中心）
- `npm run test:e2e` — E2Eテスト（計画名表示/編集、学習時間ウィジェット表示）
- 手動確認:
  - GoalSettingWizard で計画作成 → タイトルが「{試験名} {受験日} {X}h/週」になること
  - プレビュー画面でタイトル編集 → 保存後に反映されること
  - `/plan` ページでタイトルインライン編集 → localStorage更新されること
  - ストップウォッチで学習記録 → ダッシュボードの学習時間に反映されること
  - 手動入力で過去の学習時間登録 → 集計に反映されること

## Decisions

- **計画名の初期値はフロントエンド側でオーバーライド**: AI（Gemini）のプロンプトは変更せず、フロントエンドで `rawPlan.title` を上書きする方針。AI側のプロンプト変更はデプロイが必要で影響範囲が大きいため
- **学習セッションの保存先は当面 localStorage**: CosmosDB への永続化は `StudyPlan` 自体も localStorage 保存の現状に合わせ、将来のクラウド移行時にまとめて対応
- **`StudyPlan` 型の重複定義は今回は解消しない**: 共通パッケージへの切り出しはスコープが大きいため、フィールド追加の同期のみ行う
- **週間学習時間の計算**: `(hoursWeekday × 5 + hoursWeekend × 2)` を週単位で表示。小数は四捨五入して整数表示
