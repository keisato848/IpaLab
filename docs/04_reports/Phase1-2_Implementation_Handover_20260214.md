# Phase 1-2 実装完了報告書と Phase 3 への引き継ぎ事項

## エグゼクティブサマリー

**実施日**: 2026-02-14  
**実装範囲**: Phase 1（データモデル拡張とユーティリティ整備）および Phase 2（計画名の初期値変更）  
**実装状況**: ✅ 完了  
**テスト結果**: 全ユニットテスト 277 個通過、全 E2E テスト 49 個通過

---

## 1. 実装完了内容

### Phase 1: データモデル拡張とユーティリティ整備 ✅

#### 1.1 試験種別コード→正式名マッピングの追加

**ファイル**: `apps/web/lib/exam-utils.ts`

新規追加した関数:
```typescript
export function getExamTypeName(code: string): string
```

**マッピング内容**:
- `IP` → ITパスポート試験
- `FE` → 基本情報技術者試験
- `AP` → 応用情報技術者試験
- `SC` → 情報処理安全確保支援士試験
- `PM` → プロジェクトマネージャ試験
- `NW` → ネットワークスペシャリスト試験
- `SA` → システムアーキテクト試験
- `ST` → ITストラテジスト試験
- `SG` → 情報セキュリティマネジメント試験

**リファクタリング**:
- 既存の `getExamLabel()` 関数も `getExamTypeName()` を使うように変更
- コードの重複を削減し、保守性を向上

**テスト**:
- `apps/web/__tests__/lib/exam-utils.test.ts` に 10 個の新規テストを追加
- 全 26 テスト通過

#### 1.2 `StudyPlan` 型にフィールド追加

**変更ファイル**:
1. `apps/web/components/features/dashboard/GoalSettingWizard.tsx` (L15-L42)
2. `apps/web/lib/api.ts` (L92-L121)

**追加フィールド**:
```typescript
hoursWeekday?: number;  // 平日の学習時間
hoursWeekend?: number;  // 休日の学習時間
```

**影響範囲**:
- 既存コードに破壊的変更なし（オプショナルフィールドとして追加）
- 後方互換性を維持

#### 1.3 学習セッション型の新設

**ファイル**: `apps/web/lib/api.ts`

新規追加した型定義:
```typescript
export interface StudySession {
    id: string;
    userId?: string;          // 認証ユーザーの場合のみ
    startTime: string;        // ISO 8601 形式
    endTime: string;          // ISO 8601 形式
    durationSeconds: number;  // 学習時間（秒）
    category: 'exam' | 'reading' | 'review' | 'other';
    memo?: string;            // メモ（任意）
    createdAt: string;        // ISO 8601 形式
}
```

**用途**:
- Phase 5 で実装予定の手動学習時間記録機能で使用
- 問題演習以外の学習時間（読書、復習など）を記録

### Phase 2: 計画名の初期値変更 ✅

#### 2.1 計画名の自動生成ロジック実装

**ファイル**: `apps/web/components/features/dashboard/GoalSettingWizard.tsx`

**新規追加した関数**:
```typescript
const generatePlanTitle = (
    examCode: string, 
    date: string, 
    weekdayHours: number, 
    weekendHours: number
): string => {
    const examName = getExamTypeName(examCode);
    const weeklyHours = Math.round(weekdayHours * 5 + weekendHours * 2);
    return `${examName} ${date} ${weeklyHours}h/週`;
};
```

**生成例**:
- `応用情報技術者試験 2026/04/19 11h/週`
- `基本情報技術者試験 2026/03/15 18h/週`
- `プロジェクトマネージャ試験 2026/10/12 20h/週`

**週間学習時間の計算**:
- 計算式: `(平日時間 × 5 + 休日時間 × 2)`
- 四捨五入して整数表示

#### 2.2 プランオブジェクトへの保存

**変更箇所**: `GoalSettingWizard.tsx` L169-L189

AI が生成した `rawPlan` に対して、以下をオーバーライド/追加:
```typescript
const plan: StudyPlan = {
    ...rawPlan,
    id: crypto.randomUUID(),
    targetExam: targetExam,
    title: generatePlanTitle(targetExam, examDate, hoursWeekday, hoursWeekend),
    hoursWeekday: hoursWeekday,
    hoursWeekend: hoursWeekend
};
```

**設計判断**:
- AI のプロンプトは変更せず、フロントエンドで title をオーバーライド
- 理由: プロンプト変更はデプロイが必要で影響範囲が大きいため

#### 2.3 テストの追加

**ファイル**: `apps/web/__tests__/components/GoalSettingWizard.test.ts` (新規作成)

**テスト内容**:
1. 計画名のフォーマット検証（9 種類の試験タイプ全て）
2. 週間学習時間の計算ロジック検証
3. 受験日のフォーマット検証
4. エッジケース（小数点、丸め処理）

**テスト結果**: 21 テスト全て通過

---

## 2. テスト結果サマリー

### ユニットテスト

**実行コマンド**: `npm run test:unit`

- **テストファイル数**: 18
- **総テスト数**: 277
- **成功数**: 277
- **失敗数**: 0
- **成功率**: 100%

**新規追加テスト**:
- `exam-utils.test.ts`: 10 テスト追加（計 26 テスト）
- `GoalSettingWizard.test.ts`: 21 テスト追加（新規）

### E2E テスト

**実行コマンド**: `SKIP_EVIDENCE=1 npm run test:e2e`

- **総テスト数**: 49
- **成功数**: 49
- **失敗数**: 0
- **成功率**: 100%
- **実行時間**: 約 52 秒

**テストスイート**:
- `dark-theme.spec.ts`: ダークテーマ表示・切替・永続化
- `error-cases.spec.ts`: 404、OAuth エラー、XSS 耐性、アクセシビリティ
- `top-to-login.spec.ts`: トップページ→ログイン→ゲスト利用フロー

**備考**: 全て既存テストで、Phase 1-2 の変更による影響なし

---

## 3. ファイル変更一覧

### 変更ファイル

| ファイルパス | 変更内容 | 行数変更 |
|--------------|----------|----------|
| `apps/web/lib/exam-utils.ts` | `getExamTypeName()` 関数追加、`getExamLabel()` リファクタリング | +20, -5 |
| `apps/web/components/features/dashboard/GoalSettingWizard.tsx` | `hoursWeekday/hoursWeekend` フィールド追加、`generatePlanTitle()` 実装 | +20, -3 |
| `apps/web/lib/api.ts` | `StudyPlan` に `hoursWeekday/hoursWeekend` 追加、`StudySession` 型定義追加 | +15, 0 |

### 新規作成ファイル

| ファイルパス | 内容 | 行数 |
|--------------|------|------|
| `apps/web/__tests__/lib/exam-utils.test.ts` | `getExamTypeName()` のユニットテスト追加 | +50 |
| `apps/web/__tests__/components/GoalSettingWizard.test.ts` | 計画名生成ロジックのユニットテスト | 120 |

---

## 4. Phase 3 への引き継ぎ事項

### 次フェーズで実装する機能

**Phase 3: 計画名の編集機能** （未実装）

以下の 3 つのタスクが残っています:

#### タスク 5: AI 生成直後のプレビュー画面でのタイトル編集

**実装場所**: `GoalSettingWizard.tsx` の Step 3（結果表示領域）

**実装内容**:
- タイトルを `<input type="text">` で表示
- 保存前にユーザーが自由に編集可能
- バリデーション（空文字列チェックなど）

**現状の実装**:
- 現在は AI が生成したタイトルをそのまま保存
- ユーザーによる編集機能は未実装

**参考実装場所**:
- `GoalSettingWizard.tsx` の Step 3 表示領域（現在は非編集）

#### タスク 6: 学習計画ページ (/plan) でのインライン編集

**実装場所**: `apps/web/components/features/dashboard/PlanViewer.tsx` L160

**実装内容**:
- `<h2>{activePlan.title}</h2>` をインライン編集可能に変更
- クリックまたは編集アイコン（✏️）で `<input>` にトグル
- 既存の `handleUpdatePlan()` 関数（L91-L95）を活用して localStorage に保存

**現状の実装**:
- タイトルは読み取り専用の `<h2>` タグで表示
- 編集機能は未実装

**技術的考慮事項**:
- `handleUpdatePlan()` が既に存在するため、保存ロジックは流用可能
- キーボードショートカット（Enter で保存、Esc でキャンセル）を推奨

#### タスク 7: ダッシュボードのドロップダウン表示の修正

**実装場所**: `apps/web/components/features/dashboard/DashboardClient.tsx` L228-L233

**実装内容**:
- 現在: `title` の文字列から `targetExam` を推測するロジック
- 変更後: `targetExam` フィールドを直接参照
- 理由: タイトル編集後も正しく動作するため

**現状の課題**:
```typescript
// 現状（L228-L233 付近）: title から試験タイプを推測
const examType = plan.title.includes('応用情報') ? 'AP' : 
                 plan.title.includes('基本情報') ? 'FE' : 
                 /* ... */
```

**推奨実装**:
```typescript
// 変更後: targetExam フィールドを直接使用
const examType = plan.targetExam; // これで OK
```

---

## 5. 技術的メモと注意事項

### 5.1 後方互換性

- `hoursWeekday` と `hoursWeekend` はオプショナルフィールド
- 既存のプランデータ（これらのフィールドがない）も正常に動作
- localStorage に保存された古いプランとの互換性を維持

### 5.2 今後の拡張性

#### 非同期ジョブからのプラン取得

現在、同期的なプラン生成のみ `generatePlanTitle()` を使用していますが、非同期ジョブからプランを取得する場合も同様の処理が必要です。

**実装が必要な場所**:
- 非同期ジョブのポーリング処理（現在未実装の可能性）
- ジョブ完了後のプラン取得時にも `generatePlanTitle()` を呼び出す

**参考コード**: `GoalSettingWizard.tsx` L132-L211 の `handleGenerate()` 内

#### StudySession の活用

`StudySession` 型は Phase 5 で以下の用途に使用予定:

1. **localStorage への保存**:
   - キー: `ipalab_study_sessions`
   - ゲストユーザー向け

2. **CosmosDB への保存** (将来):
   - 認証ユーザー向け
   - `userId` フィールドを使用

### 5.3 テスト環境

#### Playwright のインストール

E2E テストを実行する際は、以下のコマンドでブラウザをインストール:
```bash
npx playwright install --with-deps chromium
```

#### テストの実行

```bash
# ユニットテストのみ
npm run test:unit

# E2E テストのみ
npm run test:e2e

# エビデンスキャプチャをスキップ（CI 環境用）
SKIP_EVIDENCE=1 npm run test:e2e
```

### 5.4 Husky pre-push フック

プッシュ前に自動的に以下が実行されます:
1. ユニットテスト
2. E2E テスト

いずれかが失敗するとプッシュが中止されます。

---

## 6. 既知の課題と制限事項

### 6.1 計画名の初期値について

**現在の仕様**:
- AI が生成した `rawPlan.title` はフロントエンドで完全にオーバーライド
- AI のプロンプトは変更していない

**将来の改善案**:
- AI のプロンプトを変更して、最初から実用的なタイトルを生成
- ただし、デプロイが必要で影響範囲が大きいため、当面は現状維持

### 6.2 StudyPlan 型の重複定義

**現状**:
- `GoalSettingWizard.tsx` と `api.ts` に重複定義が存在
- 今回は両方に同じフィールドを追加して対応

**将来の改善案**:
- 共通パッケージ（`packages/shared` など）に型定義を集約
- ただし、スコープが大きいため別タスクとして実施

### 6.3 週間学習時間の表示精度

**現在の実装**:
- 週間学習時間は整数に四捨五入して表示
- 例: 12.5h/週 → 13h/週

**将来の改善案**:
- 小数点1桁まで表示（例: 12.5h/週）
- ただし、ユーザーインターフェースの可読性を考慮して整数表示を採用

---

## 7. 推奨される次ステップ

### Phase 3 の実装順序

1. **タスク 7 を最初に実装**（最も影響が小さい）
   - `DashboardClient.tsx` の `targetExam` 参照に修正
   - テスト: ダッシュボードでプランを切り替えて動作確認

2. **タスク 6 を次に実装**（既存機能の拡張）
   - `PlanViewer.tsx` のインライン編集機能
   - テスト: `/plan` ページでタイトルを編集して保存

3. **タスク 5 を最後に実装**（新規 UI）
   - `GoalSettingWizard.tsx` のプレビュー画面にタイトル編集機能
   - テスト: プラン生成→プレビュー→タイトル編集→保存

### テスト戦略

各タスク実装後に以下を実施:
- 関連するユニットテストの追加
- 手動テスト（実際の UI 操作）
- 既存テストの実行（リグレッション確認）

---

## 8. 連絡先・質問

Phase 3 の実装で不明点がある場合は、以下を参照してください:

- **設計書**: `docs/03_plans/plan-studyPlanNameAndTimeTracking.prompt.md`
- **参考実装**: `apps/web/components/features/dashboard/GoalSettingWizard.tsx` L100-L189
- **テスト例**: `apps/web/__tests__/components/GoalSettingWizard.test.ts`

---

## 9. 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|-----------|---------|--------|
| 2026-02-14 | 1.0 | 初版作成（Phase 1-2 完了報告） | Copilot Agent |

---

**次フェーズ担当者へ**:  
Phase 1-2 の実装は完了し、全テストが通過しています。Phase 3 の実装を進めてください。不明点があれば、このドキュメントおよび設計書を参照してください。
