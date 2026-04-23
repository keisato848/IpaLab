# 学習計画 編集UI 設計書

> 関連Issue: #189 (P2-A-3) / 担当: ux-designer + frontend-engineer
> 依存: #188 (再計画エンジン v1.0)
> Phase 2 で扱う内容: タスク単位 D&D (#211) / サーバ永続化 (#212)

## 0. レビュー反映サマリ (2026-04-22)

PR #209 (#188 v1.0) のレビュー結果、本書を **Phase 1 スコープ** に絞り込みました。
理由は次の 3 点。

1. **永続化I/F 未確定**: 当初書いた `PATCH /api/study-plan` は未実装。現行の計画保存は `localStorage('studyPlans')` 完結 (`DashboardClient.tsx` / `PlanViewer.tsx`)。Phase 1 はこの構造を踏襲し、Cosmos 永続化は Phase 2 で別 Issue 化。
2. **再計画エンジンとの責務境界**: `replan() v1.0` は **日単位の `questionCount` 再配分**のみを扱う純粋関数。タスク単位 D&D は v1.0 で表現できないので Phase 2 に分離。
3. **`StudyPlan` 型の二重定義**: `apps/web/lib/api.ts` (id 無し) と `components/features/dashboard/GoalSettingWizard.tsx` (id あり) で型がブレている。#189 着手前に `lib/types/studyPlan.ts` に1本化する。

## 0.1 v2.0 適応型計画 反映 (#217, 2026-04-23)

v2.0「実績ドリブン AI 適応型計画 (MVP3)」方針により、**集中日 (focus) モードは廃止**。
「特定日に多く解きたい」ニーズは Phase 2 で実装したタスク D&D (#211) で代替する。
本書中の「集中日」「focus」「`pinnedFocusDays`」関連の記述は歴史的経緯として残すが、**実装上は無効** である点に注意。

## 1. 目的

ユーザーが「休む日」をワンタップで設定でき、変更後の **diff を視覚的に確認 → 取り消し** できる編集 UI を実装する。AI に任せきりではなく "ユーザーが主導権を持つ" 体験を最短ルートで提供する。

## 2. Phase 1 スコープ（本書で実装）

| # | UC | 操作 | 結果 |
|---|---|---|---|
| UC-1 | 「明日は予定があるので休みたい」 | 日付セルの「休」トグル | その日の `questionCount` を 0 にし、`replan()` で未来日へ再配分 → diff プレビュー |
| UC-2 | 「週末は集中したい」 | 日付セルの「集中」トグル | その日のキャパを `capacityBoost` で増やし、未来日 debt を吸収 → diff プレビュー |
| UC-4 | 「やっぱり元に戻したい」 | Undo/Redo ボタン or `Ctrl+Z` / `Ctrl+Shift+Z` | 直近 5 ステップを履歴スタックで戻す |

**Phase 1 では計画の「適用」は localStorage への上書き保存** で完了とする。
サーバ永続化は Phase 2 (別 Issue) で扱う。

## 3. Phase 2 以降のスコープ（別 Issue 化）

| # | UC | 別 Issue | 必要な追加実装 |
|---|---|---|---|
| UC-3 | タスクを別の日に動かす (D&D) | **#211** | `replan()` v1.5 で `taskId` 単位移動を扱えるように API 拡張。タスクに安定した `id` を付与する型変更も必要 |
| UC-保存 | 計画をサーバに永続化 | **#212** | `StudyPlanRepository`（Cosmos）+ `PUT /api/study-plan/:id` + ゲスト→ユーザーマージ |
| UC-苦手挿入 | 苦手分野を割り込み | #191 連携時 | `replan()` v1.5 + `weakAreaInjections` |

## 4. 共通型 1 本化（#189 着手時の前提作業）

`apps/web/lib/types/studyPlan.ts` に以下の 1 本に集約する。

```ts
export interface StudyPlan {
    id: string;                          // 必須化（GoalSettingWizard 由来）
    title: string;
    targetExam?: string;                 // 'AP' | 'FE' | 'SC' | ...（暫定 string）
    examDate: string;                    // YYYY-MM-DD
    hoursWeekday?: number;
    hoursWeekend?: number;
    monthlyGoal: string;
    monthlyGoals?: MonthlyGoal[];
    weeklySchedule: WeeklyScheduleItem[];
    generatedAt: string;
    totalXpEarned?: number;
}
```

- 既存の `apps/web/lib/api.ts` と `components/features/dashboard/GoalSettingWizard.tsx` の重複定義を削除し、新ファイルから re-export
- `replan` API の Zod スキーマ (`route.ts:29-68`) も同型を参照するように更新
- 影響範囲: `DashboardClient.tsx` / `PlanViewer.tsx` / `replan/route.ts` / `lib/plan/replan.ts`

これは #189 の最初のコミットで一括対応する。

## 5. 画面構成

### 5.1 カレンダービュー（メイン）

```
┌──────────────────────────────────────┐
│ < 2026年 5月 >          [一覧]│[編集]│
├──────────────────────────────────────┤
│ 日 月 火 水 木 金 土                  │
│  -  -  -  -  1  2  3                  │
│       [3問] [3問]                     │
│  4  5  6  7  8  9 10                  │
│ [休] [3問][3問][3問][集][3問][試験]   │
└──────────────────────────────────────┘
```

各セル: 日付 / `questionCount` / ステータスバッジ（休 / 集 / 試験）

### 5.2 タスク詳細パネル（右サイド or モーダル）

- 選択日のタスク一覧（**Phase 1 は表示のみ。移動ボタンは Phase 2**）
- 各タスク: 分野・問題数・優先度

### 5.3 変更プレビュー

- 「休 / 集」トグル → 即座に `POST /api/study-plan/replan` 呼び出し → diff 表示
- diff: `moved[]` / `overflowed[]` / `warnings[]`
- 「適用する」「やめる」ボタン

### 5.4 取り消し履歴

- ヘッダに「↶ 取り消し」「↷ やり直し」ボタン
- 直近 5 ステップを保持
- ショートカット: `Cmd/Ctrl+Z` / `Cmd+Shift+Z` / `Ctrl+Y`

## 6. インタラクション設計

すべての操作は **複数の入力手段（タッチ / マウス / キーボード）から実行可能** とする（§9 a11y と整合）。

- **休日トグル**: 各日付セル内に「休」トグルボタン。クリック / `H` キー / 右クリックメニュー
- **集中日トグル**: 各日付セル内に「集」トグルボタン。クリック / `F` キー / 右クリックメニュー
- **キーボード**: 日付セルは矢印キーでフォーカス移動、`Enter` / `Space` で選択日のパネル展開
- **Undo / Redo**: `Cmd/Ctrl+Z` / `Cmd+Shift+Z` / `Ctrl+Y`、ヘッダボタン

> モバイル長押し / ダブルタップは Phase 1 では採用しない（誤操作リスク回避）。

## 7. プレビュー UX

```
[操作: 休/集 トグル]
  ▼
[ローディング 0.3s]  「再計画中...」
  ▼
[プレビュー表示]    「3 件の日付の問題数が変更されます」
  ┌─────────────────────────────┐
  │ 5/4 (休): 3問 → 0問          │
  │ 5/8 (集): 3問 → 6問 (+3)     │
  │ 5/9      : 3問 → 5問 (+2)    │
  │ ⚠ 7問が試験日までに収まりません │
  └─────────────────────────────┘
  [適用する] [やめる]
  ▼
[適用完了]          「計画を更新しました」
```

## 8. ディレクトリ構成

```
apps/web/components/features/study-plan/
├─ StudyPlanCalendar.tsx
├─ StudyPlanCalendarCell.tsx
├─ TaskDetailPanel.tsx          (Phase 1 は表示のみ)
├─ ReplanPreviewModal.tsx
├─ UndoRedoControls.tsx
└─ StudyPlanCalendar.module.css

apps/web/lib/study-plan/
├─ useReplan.ts                 (POST /api/study-plan/replan ラッパ)
├─ useUndoRedo.ts               (履歴管理)
└─ planEditActions.ts           (休/集トグルで plan を変換 → replan に渡す)

apps/web/lib/types/studyPlan.ts (§4 で1本化)
```

## 9. 状態管理

- 編集中の計画は **ローカル State** + 履歴スタック（最大 5）
- 「適用」で `localStorage('studyPlans')` を上書き保存
- 楽観的更新は行わない（diff 確認 UX が価値の中心）
- サーバ永続化は Phase 2（別 Issue）

### 9.1 休/集トグルの内部表現

`replan()` v1.0 は `pinnedRestDays` / `pinnedFocusDays` を直接扱えないため、Phase 1 では **`plan` 自体を書き換えてから replan に渡す** 方式を取る。

| トグル | plan への変換 |
|---|---|
| 休日 ON | 対象日の `questionCount = 0` にして `replan()` を呼ぶ → 元の問題数が debt として未来日へ再配分される |
| 集中日 ON | 対象日の `questionCount` を `* 1.5` にして `replan()` を呼ぶ → 未来日の debt を吸収できる枠が広がる |
| トグル OFF | 編集前の plan に戻して `replan()` を再実行 |

> Phase 2 で `replan()` v1.5 に `pinnedRestDays` / `pinnedFocusDays` を正規パラメータとして昇格させる。

## 10. アクセシビリティ

- カレンダーセルはキーボード操作可能（矢印キー / Tab）
- 各セルに `aria-label`（例: "5月8日、集中日、3問予定、未消化"）
- スクリーンリーダ向け diff 読み上げ（`aria-live="polite"`）

## 11. レスポンシブ

- モバイル: 週ビューを基本
- デスクトップ: 月ビュー + サイドパネル

## 12. テスト

- ユニット: `planEditActions.toggleRest` / `toggleFocus` が plan を期待通り変換すること
- 統合: 休/集トグル → `useReplan` → diff 表示 → 適用で localStorage 更新の一連
- a11y（axe-core）パス
- E2E (Playwright): 休日トグル → diff → 適用 → リロード後も状態維持

## 13. DoD（Phase 1 #189）

- [ ] 共通型 `apps/web/lib/types/studyPlan.ts` に 1 本化（既存の二重定義を解消）
- [ ] 休/集トグルでカレンダーセルが切替可能
- [ ] トグル時に `POST /api/study-plan/replan` を呼び diff プレビュー表示
- [ ] 「適用」で `localStorage('studyPlans')` を更新、リロード後も維持
- [ ] Undo/Redo（最大 5 ステップ）
- [ ] a11y (axe-core) パス
- [ ] レスポンシブ動作確認（モバイル 375px / デスクトップ）

## 14. 関連

- #188 再計画エンジン v1.0 / #194 統合ダッシュボード
- Phase 2 派生: #211 タスク D&D / #212 計画サーバ永続化
