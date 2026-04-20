# 動的再計画エンジン 設計書

> 関連Issue: #188 (P2-A-2) / 担当: ai-engineer + backend-engineer
> 依存: #187 (進捗集計基盤)

## 1. 目的

試験日・可処分時間・優先度を制約として、未消化タスクを自動的に再配分する再計画エンジンを構築する。「計画を立てたが続かない」を解決し、AI学習計画の "伴走" 価値を実現する。

## 2. 再計画トリガー

| トリガー | 説明 |
|---|---|
| **日次バッチ** | 毎朝 5:00 JST、前日の進捗を反映して当日以降を再配分 |
| **大幅遅延検知** | 3 日連続未消化 or 達成率 < 50% で即時再計画 |
| **ユーザー編集** | 「休む日」「集中日」追加で即時再計画 |
| **試験日変更** | 試験日を変えた瞬間に全体再計画 |
| **苦手検出** | (#191 と連携) 弱点演習を割り込み挿入 |

## 3. 入力

```typescript
interface ReplanningInput {
  userId: string;
  examTargetDate: string;            // 試験日
  currentDate: string;
  remainingTasks: PlannedTask[];     // 未消化タスク
  recentProgress: DailyProgressAggregate[]; // 直近 7 日 (#187)
  userPreferences: {
    weeklyAvailableMinutes: number[];   // [日, 月, 火, ...]
    pinnedRestDays: string[];           // YYYY-MM-DD
    pinnedFocusDays: string[];
  };
  weakAreaInjections?: WeaknessInjection[]; // (#191)
}
```

## 4. 再計画アルゴリズム

```
1. 残日数 D = examTargetDate - currentDate
2. 各日の利用可能時間配列を作成 (rest=0, focus=1.5x)
3. 残タスクを以下の優先度でソート:
     a. weakAreaInjections (緊急度高)
     b. 試験範囲カバレッジが低い分野
     c. ユーザーが pin したタスク
     d. 既存優先度
4. グリーディに各日へ配分:
     - その日の枠を超えないようにタスクを詰める
     - 同一分野が連続しないよう分散
5. オーバーフローを試験 1 週間前バッファ日に押し出す
6. 配分結果を ReplanningOutput として返却
```

## 5. 出力

```typescript
interface ReplanningOutput {
  reschedule: Array<{
    date: string;
    tasks: PlannedTask[];
    estimatedMinutes: number;
  }>;
  diff: {
    moved: Array<{ taskId: string; from: string; to: string; reason: string }>;
    inserted: Array<{ taskId: string; at: string; reason: string }>;
    overflowed: Array<{ taskId: string; reason: 'time_shortage' | 'skipped' }>;
  };
  warnings: string[];                // 例: "試験まで残3日、未消化タスクが多い"
  generatedAt: string;
  algorithmVersion: '1.0';
}
```

## 6. アルゴリズム種別

| バージョン | 手法 | 用途 |
|---|---|---|
| **v1.0 (MVP)** | グリーディ + 制約充足 | 初期リリース |
| **v1.5** | グリーディ + 苦手重み付け | #191 連携後 |
| **v2.0 (将来)** | 制約最適化ソルバー（OR-Tools） | 大規模ユーザー対応 |

## 7. 説明可能性

- 各 `inserted` / `moved` に `reason` を付与
  - 例: "前日未消化のため翌日に振替"
  - 例: "苦手分野『データベース』を強化するため挿入"
- ユーザー編集UI（#189）で reason をツールチップ表示

## 8. API

> **認証方針**: 全APIで認証必須。ユーザー識別は **`session.user.id` を正本とし、query / body の `userId` は受け付けない**。共通設計 `15_CommonApiAndErrorDesign.md` §12.1 に準拠。`ReplanningInput` の `userId` フィールドはサーバ内部処理用のため、APIリクエストでは送信不要（送信されても無視）。

### `POST /api/study-plan/replan`
- 入力: `ReplanningInput`（`userId` はサーバ側でセッションから補完）
- 出力: `ReplanningOutput`
- 認証必須

### `GET /api/study-plan/current`
- 現在の計画を返却（再計画後の状態）
- 対象ユーザーは認証セッションから取得

## 9. 非機能要件

| 項目 | 目標 |
|---|---|
| 再計画レイテンシ | ≤ 1 秒（ユーザートリガー時） |
| バッチ処理（日次） | 1ユーザーあたり ≤ 100ms |
| 整合性 | 配分された分・休日・上限を全制約遵守 |

## 10. テスト戦略

- 単体: 各制約ごとのケース（休日 / 上限超過 / 苦手挿入）
- ゴールデンテスト: 入力 → 出力スナップショット
- カオステスト: ランダム入力で破綻しないこと

## 11. DoD

- 再計画ロジック仕様書（本書）
- v1.0 アルゴリズム実装
- ユーザー編集にも即時反応（≤ 1 秒）
- ゴールデンテスト 20 ケース合格

## 12. 関連

- #187 進捗集計基盤 / #189 計画編集UI / #191 レコメンドエンジン
