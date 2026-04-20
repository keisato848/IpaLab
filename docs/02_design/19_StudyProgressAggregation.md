# 学習進捗集計基盤 設計書

> 関連Issue: #187 (P2-A-1) / 担当: backend-engineer
> Phase: Priority 2 - Phase 2-A

## 1. 目的

ユーザーの日次学習進捗（完了 / 未完了 / 部分完了）を自動集計し、再計画エンジン（#188）・ダッシュボード（#194）・通知（#196）の共通データソースとなる基盤を構築する。

## 2. 集計対象データ

| ソース | 内容 | 取得方法 |
|---|---|---|
| `LearningRecord` | 個別問題の解答ログ | CosmosDB Change Feed |
| `LearningSession` | セッション単位の学習 | 同上 |
| `ExamProgress` | 模試・試験の進捗 | 同上 |
| `StudyPlan` | 立てられた計画タスク | 同上 |
| `AfternoonScoringResult` | AI採点結果（→#176） | 同上 |

## 3. 集計レイヤー

### Layer A: リアルタイム集計 (Hot Path)
- 解答イベント発生時に即時加算
- Redis に当日分のメトリクスを保持（TTL 48h）
- ダッシュボード即時反映用

### Layer B: バッチ集計 (Cold Path)
- 日次バッチ（深夜 3:00 JST）
- 集計結果を `daily_progress_aggregates` に永続化
- 過去データ参照・再計画エンジンの入力に使用

### Layer C: 派生メトリクス
- ストリーク（連続学習日数）
- 週次達成率
- 分野別正答率の時系列

## 4. データスキーマ

```typescript
interface DailyProgressAggregate {
  userId: string;
  date: string;                       // YYYY-MM-DD (JST)
  planned: {
    taskCount: number;
    estimatedMinutes: number;
  };
  actual: {
    completedTaskCount: number;
    partialTaskCount: number;
    skippedTaskCount: number;
    studiedMinutes: number;
  };
  performance: {
    correctAnswerCount: number;
    totalAnswerCount: number;
    accuracyRate: number;             // 0-1
    afternoonAvgScore: number | null;
  };
  streak: {
    currentDays: number;
    isStreakAlive: boolean;
  };
  byCategory: Array<{
    categoryId: string;
    accuracyRate: number;
    studiedMinutes: number;
  }>;
  aggregatedAt: string;               // ISO8601
  version: '1.0';
}
```

## 5. アーキテクチャ

```
[App Events] ──► [Event Bus / Service Bus]
                          │
              ┌───────────┴───────────┐
              ▼                        ▼
     [Hot Aggregator]          [Cold Aggregator]
     (Functions: 即時)         (Functions: 日次)
              │                        │
              ▼                        ▼
            [Redis]              [CosmosDB]
              │                        │
              └────────┬───────────────┘
                       ▼
            [Aggregation Read API]
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   [Replanner]   [Dashboard]    [Notifications]
   (#188)        (#194)         (#196)
```

## 6. API

### `GET /api/progress/daily?userId=&from=&to=`
- 期間指定で日次集計を返却
- 当日分は Redis、過去分は CosmosDB

### `GET /api/progress/summary?userId=`
- 試験日までの累計 / 残タスク / ストリーク
- ダッシュボードの主要データソース

## 7. 非機能要件

| 項目 | 目標 |
|---|---|
| Hot Path 反映遅延 | ≤ 2 秒 |
| Cold Path バッチ完了時刻 | 4:00 JST までに完了 |
| 集計 API レスポンス | P95 ≤ 200ms |
| データ保持期間 | Hot: 48h / Cold: 5 年 |

## 8. 監視

- バッチ失敗・遅延アラート
- 集計値の整合性チェック（Hot vs Cold の乖離）
- アクセスメトリクス（API 利用状況）

## 9. DoD

- Hot/Cold 両方のアグリゲーター実装
- 集計仕様書（本書）
- API ドキュメント（OpenAPI）
- 整合性テスト（Hot/Cold で同値）

## 10. 関連

- #188 動的再計画エンジン / #194 統合ダッシュボード / #195 ストリーク機能
