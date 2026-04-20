# 午後試験 採点API v2 設計書

> 関連Issue: #176 (P1-A-2) / 担当: backend-engineer
> 依存: #175 (ルーブリック)
> **改訂履歴**: v1.1 系統A（記述式）/ 系統B（論述式）の2エンドポイント構成に変更

## 1. 目的

観点別スコアと根拠テキストを返却する採点API v2 を設計する。**記述式と論述式は別エンドポイント**として実装し、それぞれに最適なレイテンシ・コスト要件を設定する。

## 2. エンドポイント

### 2.0 通信方式の方針

採点APIは **常に POST** を採用する（リクエストボディに長文の解答テキストを含むため）。
ストリーミングは以下の方針とする：

- **採用方式: `fetch` API + ReadableStream（POST + SSE形式のレスポンスボディ）**
  - 理由: ブラウザ標準の `EventSource` は GET 専用で POST/リクエストボディ送信に非対応のため使用しない
  - クライアントは `fetch(url, { method: 'POST', body, headers: { 'Accept': 'text/event-stream' } })` でレスポンスストリームを読み取り、SSEイベント形式（`event: ...\ndata: ...\n\n`）をパースして処理する
- レスポンスヘッダ: `Content-Type: text/event-stream` / `Cache-Control: no-cache` / `Connection: keep-alive`
- `mode` パラメータ: `"stream"` または `"batch"` を指定（後述）

### 2.1 系統A：`POST /api/ai/scoring/afternoon/short-answer/v2`
対象: AP午後 / SC午後 / PM午後I / SA午後I / ST午後I

#### Request
```json
{
  "questionId": "ap-r6-pm-q3",
  "userAnswer": "...",
  "mode": "stream"
}
```

`mode` の許容値:
- `"stream"`: SSE形式でレスポンスをストリーミング（推奨）
- `"batch"`: 全観点完了後に1回のJSONレスポンスを返す

#### Response (batch)
`ShortAnswerScoringResult`（→ #175 設計書 §7.2 参照）

#### Response (stream / SSE)
```
event: perspective
data: { "id": "keyword_coverage", "score": 78, "rationale": "...", ... }
event: complete
data: { "totalScore": 6.5, "maxScore": 8, ... }
```

### 2.2 系統B：`POST /api/ai/scoring/afternoon/essay/v2`
対象: PM午後II / SA午後II / ST午後II（論述式・小論文）

#### Request
```json
{
  "questionId": "pm-r6-pm2-q1",
  "examType": "PM",
  "answer": {
    "setsumonA": "...",
    "setsumonI": "...",
    "setsumonU": "..."
  },
  "mode": "stream"
}
```

`answer` 各フィールドはそれぞれ設問ア（800字以内）/ 設問イ（800〜1600字）/ 設問ウ（600〜1200字）の本文。
`mode` の許容値は §2.1 と同じ（`"stream"` 推奨）。

> **注**: ユーザーが設問分けせずに長文を貼った場合は、サーバ側で章節検出（「設問ア」「1.」等）を試行 → 失敗時は `422 SECTION_SPLIT_FAILED` を返してUIで分割を促す。

#### Response (batch)
`EssayScoringResult`（→ #175 設計書 §7.3 参照）

#### Response (stream / SSE)
```
event: sub_question_start
data: { "subQuestion": "ア" }

event: perspective
data: { "subQuestion": "ア", "id": "question_alignment", "score": 70, "rationale": "...", "evidenceQuotes": [...] }

event: sub_question_complete
data: { "subQuestion": "ア", "score": 72 }

event: complete
data: { "overallRank": "B", "overallScore": 68, ... }
```

## 3. 内部処理フロー

### 3.1 系統A（記述式）
```
[Client] → [API] → [認証/レート制限] → [設問メタ取得 (cache 24h)]
              → [4観点を独立に並列起動]
              │     ├─ keyword_coverage (LLM)
              │     ├─ logical_structure (LLM)
              │     ├─ expression_accuracy (LLM)
              │     └─ conciseness (rule + LLM)
              │
              │  各観点の完了時:
              │   └─ stream時: SSE event: perspective を逐次 flush
              │
              │  全観点完了後:
              → [Aggregator: 重み付け合計 + 差分計算]
              → stream時: event: complete を flush / batch時: JSON 一括返却
```

> ストリーミング時は `Promise.all` で完了を待たず、各観点の Promise が解決するごとに即時 SSE 送信する（`Promise.allSettled` + 個別監視 or `for await` パターン）。`Promise.all` は batch モード時のみ使用。

### 3.2 系統B（論述式）
```
[Client] → [API] → [認証/レート制限] → [設問メタ取得]
              → [章節分割 (ア/イ/ウ)]
              → [3小問 × 6観点 = 18 LLM 呼び出しを独立に並列起動]
              │
              │  各観点の完了時:
              │   └─ stream時: SSE event: perspective (subQuestion 付与) を逐次 flush
              │
              │  小問単位で観点が揃った時:
              │   └─ stream時: event: sub_question_complete を flush
              │
              │  全観点完了後:
              → [小問スコア集計 → 全体スコア → A/B/C/D 判定]
              → stream時: event: complete を flush / batch時: JSON 一括返却
```

## 4. 非機能要件（系統別）

| 項目 | 系統A 記述式 | 系統B 論述式 |
|---|---|---|
| レイテンシ P95 | ≤ 10 秒 | ≤ 45 秒 |
| レイテンシ P50 | ≤ 6 秒 | ≤ 25 秒 |
| 同時リクエスト | 50 req/sec | 10 req/sec |
| 採点コスト/件 | ≤ ¥3 | ≤ ¥30（18 LLM 呼び出し前提） |
| ストリーミング推奨度 | 推奨 | **必須**（体感時間短縮） |

## 5. キャッシュ戦略

- 設問メタ（模範解答・キーワード・採点ポイント）: Redis 24h
- 同一ユーザー解答（ハッシュ一致）: Redis 1h
- 採点結果（永続化）:
  - 記述式 → CosmosDB `short_answer_scoring_results`
  - 論述式 → CosmosDB `essay_scoring_results`（容量確保のため別コンテナ）

## 6. エラーハンドリング

| エラーコード | HTTP | 系統 | 対応 |
|---|---|---|---|
| `LLM_TIMEOUT` | 504 | A/B | 軽量モデルでフォールバック |
| `QUESTION_NOT_FOUND` | 404 | A/B | クライアントへエラー表示 |
| `EMPTY_ANSWER` | 422 | A/B | バリデーションエラー |
| `RATE_LIMITED` | 429 | A/B | リトライアフター付与 |
| `SECTION_SPLIT_FAILED` | 422 | B のみ | UIで設問ア・イ・ウ分割を促す |
| `CHAR_COUNT_VIOLATION_FATAL` | 422 | B のみ | 字数が極端に不足（半分未満）のときは即時返却 |

## 7. 監視・テレメトリ

- App Insights:
  - `ai.scoring.afternoon.short_answer.v2.{latency,error_rate,cost}`
  - `ai.scoring.afternoon.essay.v2.{latency,error_rate,cost}`
- 系統B は **小問別レイテンシ** も計測
- A/B/C/D 判定の分布を週次でモニタリング（極端な偏りの検出）

## 8. 互換性

- v1 エンドポイント（あれば）は 90 日間並行稼働
- 系統B は v1 が存在しないため新規API

## 9. DoD

- OpenAPI 仕様書 2 本（短答 / 論述）公開
- ストリーミング動作確認（SSE）
- 系統A: P95 ≤ 10 秒 / 系統B: P95 ≤ 45 秒 を負荷試験で確認
- 設問分割ロジックのユニットテスト

## 10. 関連

- #175 ルーブリック / #178 採点結果ページ実装（系統別UI分岐） / #183 品質モニタリング
