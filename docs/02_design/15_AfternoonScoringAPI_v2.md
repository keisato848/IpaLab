# 午後試験 採点API v2 設計書

> 関連Issue: #176 (P1-A-2) / 担当: backend-engineer
> 依存: #175 (ルーブリック)

## 1. 目的

観点別スコアと根拠テキストを返却する採点API v2 を設計する。レイテンシ P95 ≤ 10秒、ストリーミング対応で「思考が見える」体験を実現する。

## 2. エンドポイント

### `POST /api/ai/scoring/afternoon/v2`

#### Request
```json
{
  "questionId": "ap-r6-pm-q3",
  "userAnswer": "...",
  "mode": "stream" | "batch"
}
```

#### Response (batch)
`AfternoonScoringResult`（→ #175 設計書 §6 参照）

#### Response (stream / SSE)
```
event: perspective
data: { "id": "keyword_coverage", "score": 78, "rationale": "...", ... }

event: perspective
data: { "id": "logical_structure", ... }

event: complete
data: { "totalScore": 6.5, "maxScore": 8, ... }
```

## 3. 内部処理フロー

```
[Client]
   │  POST /v2
   ▼
[API Route Handler]
   │  1. 認証/レート制限
   │  2. 設問メタ取得 (cache: 24h)
   │  3. 観点 4本を Promise.all で並列実行
   ▼
[ScoringOrchestrator]
   │  ├─ keyword_coverage (LLM)
   │  ├─ logical_structure (LLM)
   │  ├─ expression_accuracy (LLM)
   │  └─ conciseness (rule + LLM)
   ▼
[Aggregator]
   │  - 観点スコア → 重み付け合計
   │  - 差分計算 (diff-match-patch)
   │  - スコアを設問配点へスケール
   ▼
[Response (stream/batch)]
```

## 4. 非機能要件

| 項目 | 目標 |
|---|---|
| レイテンシ P95 | ≤ 10 秒 |
| レイテンシ P50 | ≤ 6 秒 |
| 同時リクエスト | 50 req/sec |
| 採点コスト | 1 採点あたり ≤ ¥3 (LLM コスト) |

## 5. キャッシュ戦略

- 設問メタ（模範解答・キーワード）: Redis 24h
- 同一ユーザー解答（ハッシュ一致）: Redis 1h（誤連打対策）
- 採点結果（永続化）: CosmosDB `afternoon_scoring_results`

## 6. エラーハンドリング

| エラー | HTTP | 対応 |
|---|---|---|
| LLM タイムアウト | 504 | 軽量モデルでフォールバック |
| 設問が存在しない | 404 | クライアントへエラー表示 |
| ユーザー解答が空 | 422 | バリデーションエラー |
| レート制限超過 | 429 | リトライアフター付与 |

## 7. 監視・テレメトリ

- Application Insights: `ai.scoring.afternoon.v2.latency` / `.error_rate` / `.cost`
- 観点別レイテンシも個別計測
- 失敗時は requestId をユーザー側に提示

## 8. 互換性

- v1 エンドポイント (`/v1`) は 90 日間並行稼働
- 互換用に v1 形式へ変換するアダプタを提供

## 9. DoD

- OpenAPI 仕様書 `packages/api-ai/openapi/afternoon-scoring-v2.yaml` 公開
- ストリーミング対応動作確認
- レイテンシ P95 ≤ 10 秒を負荷試験で確認
- v1 互換アダプタの動作確認

## 10. 関連

- #175 ルーブリック / #178 採点結果ページ実装 / #183 品質モニタリングダッシュボード
