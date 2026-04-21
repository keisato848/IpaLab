# 学習進捗集計基盤 設計書

> 関連Issue: #187 (P2-A-1) / 担当: backend-engineer
> Phase: Priority 2 - Phase 2-A

## 1. 目的

ユーザーの日次学習進捗（完了 / 未完了 / 部分完了）を自動集計し、再計画エンジン（#188）・ダッシュボード（#194）・通知（#196）の共通データソースとなる基盤を構築する。

## 2. 集計対象データ

| ソース | 内容 | 取得方法 |
|---|---|---|
| `LearningRecord` | 個別問題の解答ログ | CosmosDB Change Feed → Service Bus |
| `LearningSession` | セッション単位の学習 | CosmosDB Change Feed → Service Bus |
| `ExamProgress` | 模試・試験の進捗 | CosmosDB Change Feed → Service Bus |
| `StudyPlan` | 立てられた計画タスク | CosmosDB Change Feed → Service Bus |
| `AfternoonScoringResult` | AI採点結果（→#176） | CosmosDB Change Feed → Service Bus |

> **取得方式の方針**: 各 CosmosDB コンテナの **Change Feed が起点**。集計コンポーネントは Change Feed を直接 polling せず、Change Feed Processor（Functions）が **Service Bus にイベントを中継**し、各アグリゲーターは Service Bus から購読する構成とする。これにより、複数の購読者（Hot/Cold/通知）でイベントを共有でき、再処理・リプレイも容易になる。

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
[CosmosDB Containers]
        │ Change Feed
        ▼
[Change Feed Processor (Functions)]
        │ relay
        ▼
[Service Bus Topics]
        │
        │ subscribe
        ├────────────────┬────────────────┐
        ▼                ▼                ▼
[Hot Aggregator]  [Cold Aggregator]  [Notifications]
(Functions: 即時) (Functions: 日次)   (#196)
        │                │
        ▼                ▼
     [Redis]        [CosmosDB]
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

> **認証方針**: 認証必須API。ユーザー識別は **`session.user.id` を正本とし、query / body の `userId` は受け付けない**。共通設計 `15_CommonApiAndErrorDesign.md` §12.1 に準拠。

### `GET /api/progress/daily?from=&to=`
- 期間指定で日次集計を返却（対象は認証セッションのユーザー）
- 当日分は Redis、過去分は CosmosDB

### `GET /api/progress/summary`
- 試験日までの累計 / 残タスク / ストリーク（対象は認証セッションのユーザー）
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

---

## 11. Phase 1 MVP実装 (#187)

> Service Bus / Redis / Change Feed Processor を伴う完全構成は将来段階。Phase 1 では **on-demand 集計 + 任意永続化** の最小構成で再計画エンジン (#188) と編集UI (#189) を解禁する。

### 11.1 構成

LearningRecord (Cosmos) -> aggregateDailyProgress (純粋関数) -> GET /api/user-progress/daily (リアルタイム返却) / POST .../daily/recompute (DailyProgress に upsert)

### 11.2 主要モジュール

| モジュール | 役割 |
|---|---|
| apps/web/lib/progress/aggregateDailyProgress.ts | 純粋関数。LearningRecord → DailyProgress[] に変換。同 questionId は最新採用、UTC 日付集計、status 判定。 |
| apps/web/lib/repositories/dailyProgressRepository.ts | Cosmos CRUD。upsert / upsertMany / findByUserAndDateRange |
| apps/web/app/api/user-progress/daily/route.ts | GET: on-demand 集計を返す |
| apps/web/app/api/user-progress/daily/recompute/route.ts | POST: 再集計して永続化 (冪等) |

### 11.3 ステータス判定表

| plannedCount | actual | status |
|---:|---:|---|
| 未指定 / 0 | 0 | none |
| 未指定 / 0 | ≥1 | completed |
| ≥1 | 0 | none |
| ≥1 | < planned | partial |
| ≥1 | ≥ planned | completed |

### 11.4 認証

- GET /api/user-progress/daily: NextAuth セッション必須。常に session.user.id を採用。
- POST .../recompute: NextAuth セッション or x-recompute-secret ヘッダ。後者は管理用 (cron / 手動再集計) で body.userId を尊重。

### 11.5 Phase 2 への発展

- Layer A (Hot Path: Redis) の追加 → 当日分のレイテンシ削減
- Layer B (バッチ): 現状の recompute を Azure Functions Timer / GitHub Actions cron からキック
- ストリーク・派生メトリクスは別 Issue で summarizeDailyProgress を拡張
