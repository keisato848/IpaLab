# 非同期ジョブシステム Azure環境設計書

## 1. 概要

AI学習計画生成機能において、同期処理がタイムアウトした場合のフォールバックとして、Azure Queue Storage を使用した非同期ジョブシステムを導入する。

### 1.1 背景・課題

| 課題 | 詳細 |
|------|------|
| タイムアウト | Azure Static Web Apps の API Route は最大 45-60秒の制限あり |
| AI生成時間 | Gemini API の応答に 30-90秒かかる場合がある |
| UX低下 | タイムアウト時にユーザーは再試行するしかない |

### 1.2 解決策

**ハイブリッド同期/非同期アーキテクチャ**を採用:
1. まず同期APIを試行（45秒タイムアウト）
2. タイムアウト時は非同期ジョブを作成
3. バックグラウンドで処理完了後、ダッシュボードで通知

---

## 2. アーキテクチャ

### 2.1 リソース構成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              East Asia Region                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Static Web Apps (swa-pm-exam-dx-prod)                                       │
│  ├── Next.js Frontend                                                        │
│  └── Managed Functions                                                       │
│       ├── /api/ai/plan         → 同期処理（US Function へプロキシ）           │
│       ├── /api/ai/jobs         → ジョブ作成（Cosmos + Queue）                │
│       └── /api/ai/jobs/pending → 完了ジョブ取得                              │
│                                                                              │
│  Cosmos DB (pm-exam-dx-db)                                                   │
│  └── Jobs コンテナ (NEW)                                                     │
│       └── PartitionKey: /userId                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Cross-Region
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              US East 2 Region                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Storage Account (stpmexamdxaius)                                            │
│  └── Queue: ai-plan-jobs (NEW)                                               │
│       └── Message: {"jobId": "...", "userId": "...", "createdAt": "..."}    │
│                                                                              │
│  Function App (func-pm-exam-dx-ai-us)                                        │
│  ├── aiPlan (HTTP Trigger)       → 同期処理                                  │
│  └── aiPlanAsync (Queue Trigger) → 非同期処理 (NEW)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 処理フロー

```
[同期成功フロー]
User → /api/ai/plan → aiPlan (US) → Gemini API → 200 OK → 計画表示

[非同期フォールバックフロー]
User → /api/ai/plan → 45秒タイムアウト
    ↓
User → /api/ai/jobs → Cosmos DB (status: pending)
                    → Queue (ai-plan-jobs)
    ↓
Queue Trigger → aiPlanAsync → Gemini API → Cosmos DB (status: completed)
    ↓
User ダッシュボード再訪問 → /api/ai/jobs/pending → 🎉 通知モーダル
```

---

## 3. 新規リソース定義

### 3.1 Azure Queue Storage

| 項目 | 値 |
|------|-----|
| **Storage Account** | `stpmexamdxaius` (既存) |
| **Queue 名** | `ai-plan-jobs` |
| **リージョン** | US East 2 |
| **メッセージ TTL** | 7日間 |
| **Visibility Timeout** | 5分 |
| **Dequeue Count** | 5回（超過でポイズンキューへ） |

#### メッセージフォーマット

```json
{
    "jobId": "job-user123-1707000000000",
    "userId": "user123",
    "createdAt": "2026-02-03T10:00:00.000Z"
}
```

### 3.2 Cosmos DB Jobs コンテナ

| 項目 | 値 |
|------|-----|
| **コンテナ名** | `Jobs` |
| **Partition Key** | `/userId` |
| **TTL** | 30日（2592000秒） |

#### ドキュメントスキーマ

```typescript
interface StudyPlanJob {
    id: string;                    // "job-{userId}-{timestamp}"
    type: "studyPlanJob";
    userId: string;                // Partition Key
    targetExam: string;
    status: "pending" | "processing" | "completed" | "failed";
    requestData: {
        targetExam: string;
        examDate: string;
        studyTimeWeekday: number;
        studyTimeWeekend: number;
        scores: Record<string, number>;
    };
    resultData?: StudyPlan;        // 完了時のみ
    error?: string;                // 失敗時のみ
    createdAt: string;
    processingStartedAt?: string;
    completedAt?: string;
    notifiedAt?: string;           // 通知済みフラグ
    dismissed?: boolean;           // ユーザーが破棄した場合
}
```

---

## 4. 環境変数

### 4.1 Static Web Apps (追加)

| 変数名 | 値 | 用途 |
|--------|-----|------|
| `AZURE_STORAGE_CONNECTION_STRING` | Storage Account接続文字列 | Queue送信用 |
| `AI_JOB_QUEUE_NAME` | `ai-plan-jobs` | キュー名 |

### 4.2 Function App (既存を利用)

| 変数名 | 現在の値 | 用途 |
|--------|----------|------|
| `AzureWebJobsStorage` | Storage Account接続文字列 | ✅ Queue Trigger にも使用 |
| `COSMOS_DB_CONNECTION` | Cosmos DB接続文字列 | ジョブ状態更新 |
| `GEMINI_API_KEY` | Google AI Studio Key | AI生成 |

---

## 5. セキュリティ

| 項目 | 対策 |
|------|------|
| **API認証** | NextAuth セッション検証必須（未認証はジョブ作成不可） |
| **データ分離** | Cosmos DB の Partition Key `/userId` でユーザー間分離 |
| **Queue アクセス** | Storage Account キーによる認証 |
| **Function 保護** | Queue Trigger は内部接続のみ（外部 HTTP 不可） |
| **自動削除** | 30日 TTL で古いジョブを自動削除 |

---

## 6. 監視・運用

### 6.1 メトリクス

| メトリクス | 閾値 | アラート |
|------------|------|----------|
| Queue メッセージ数 | > 100 | 処理遅延警告 |
| ポイズンキュー数 | > 5 | エラー通知 |
| ジョブ完了率 | < 80% | 障害調査 |

### 6.2 Application Insights クエリ

```kusto
// 非同期ジョブ成功率
customEvents
| where name == "aiPlanAsync"
| summarize 
    Success = countif(customDimensions.status == "completed"),
    Failed = countif(customDimensions.status == "failed")
    by bin(timestamp, 1h)
```

---

## 7. コスト試算

| 項目 | 月間想定 | コスト |
|------|----------|--------|
| Queue ストレージ | 60KB | ¥0 |
| Queue トランザクション | 180回 | ¥0.01 |
| Cosmos DB (Jobs) | 1MB, 100 RU/s | 既存枠内 |
| **合計** | - | **≈ ¥0/月** |

---

## 8. デプロイ手順

### 8.1 Bicep デプロイ

```bash
cd infra/azure
az deployment group create \
    --resource-group rg-pm-exam-dx-ai-us \
    --template-file queue-resources.bicep \
    --parameters storageAccountName=stpmexamdxaius
```

### 8.2 Cosmos DB コンテナ作成

```bash
az cosmosdb sql container create \
    --account-name pm-exam-dx-db \
    --database-name pm-exam-dx-db \
    --name Jobs \
    --partition-key-path /userId \
    --ttl 2592000 \
    --resource-group rg-pm-exam-dx
```

### 8.3 環境変数設定

```bash
# Storage 接続文字列取得
STORAGE_CONN=$(az storage account show-connection-string \
    --name stpmexamdxaius \
    --query connectionString -o tsv)

# SWA に設定
az staticwebapp appsettings set \
    --name swa-pm-exam-dx-prod \
    --setting-names \
        "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN" \
        "AI_JOB_QUEUE_NAME=ai-plan-jobs"
```

---

## 9. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|------------|----------|
| 2026/02/03 | 1.0 | 初版作成 |
