# SWA → App Service 移行計画 概要

## 1. 移行の背景

### 1.1 現在の問題

Azure Static Web Apps (SWA) + Next.js Hybrid 構成において、**Application Insights へのログ出力が安定しない**問題が継続的に発生している。

| 問題 | 影響 |
|------|------|
| Application Insights 統合が動作しない | 本番環境のログ・エラー追跡ができない |
| SWA + Next.js Hybrid は**プレビュー**状態 | 機能保証がない |
| NODE_OPTIONS が管理環境で制御不可 | preload script が動作しない |
| 何度修正しても解決しない | 構造的な制約の可能性が高い |

### 1.2 移行の決定理由

| 項目 | Azure SWA (現状) | Azure App Service (移行先) |
|------|-----------------|---------------------------|
| Application Insights | ❌ プレビュー、動作不安定 | ✅ コードレス監視サポート |
| NODE_OPTIONS | ❌ 管理環境で制御不可 | ✅ 完全制御可能 |
| Next.js Hybrid | ⚠️ プレビュー | ✅ 正式サポート |
| コスト | ~$9/月 (Standard) | ~$13/月 (B1) |
| 設定の柔軟性 | 制限あり | 高い |

**結論**: 月額 +$4 程度の追加コストで、安定した監視基盤を確保できる。

## 2. 移行スコープ

### 2.1 対象コンポーネント

| コンポーネント | 移行前 | 移行後 |
|---------------|--------|--------|
| フロントエンド (Next.js) | Azure Static Web Apps | Azure App Service |
| Application Insights | 手動 SDK 統合 | コードレス監視 + SDK |
| カスタムドメイン | swa-pm-exam-dx-prod | app-pm-exam-dx-prod |
| CI/CD | Azure SWA Deploy Action | Azure Web Apps Deploy |

### 2.2 対象外（変更なし）

| コンポーネント | 理由 |
|---------------|------|
| `api-ai` (Azure Functions) | US East 2 で独立運用継続（Gemini API 地域制限対応） |
| CosmosDB | データベース層は変更なし |
| Entra ID / NextAuth 認証フロー | 再設定は必要だが、構成自体は同じ |
| ソースコードの基本構造 | Next.js API Routes はそのまま動作 |
| `apps/api` (Managed Functions) | 現在未使用のため影響なし |

### 2.3 Azure Functions の扱い

#### `apps/api-ai` (独立 Function App)

**変更なし** - 引き続き US East 2 リージョンで稼働。

```
[Azure App Service (East Asia)]
    ↓ プロキシ
[Azure Function App (US East 2)]
    ↓
[Google Gemini API]
```

- Next.js API Route `/api/ai/plan` からのプロキシ呼び出しは変わらない
- 環境変数 `GEMINI_API_URL` の設定も変更なし

#### `apps/api` (Managed Functions)

**影響なし** - 現在このフォルダの関数は使用されていない。

- すべての API は Next.js API Routes (`apps/web/app/api/`) で実装済み
- App Service でも Next.js API Routes がそのまま動作

## 3. 移行フェーズ

```
Phase 1: 準備 (Day 1-2)
├── 設計書・ドキュメント更新
├── Azure App Service リソース作成
└── 環境変数の移行計画

Phase 2: 開発環境構築 (Day 3-4)
├── ソースコード修正
├── CI/CD ワークフロー作成
└── ローカル動作確認

Phase 3: ステージング検証 (Day 5-6)
├── ステージング環境へデプロイ
├── Application Insights ログ出力確認
└── 認証フロー動作確認

Phase 4: 本番移行 (Day 7)
├── DNS 切り替え
├── SWA リソース削除（任意）
└── 移行完了確認
```

## 4. ドキュメント構成

```
docs/03_migration/
├── 00_Migration_Overview.md          # 本ドキュメント（概要）
├── 01_Azure_AppService_Design.md     # App Service 設計書
├── 02_Source_Code_Changes.md         # ソースコード変更点
├── 03_CICD_Workflow_Design.md        # CI/CD 設計書
├── 04_Test_Verification_Plan.md      # テスト・検証計画
└── 05_Rollback_Plan.md               # ロールバック計画
```

## 5. 関連ドキュメント更新

移行完了後、以下のドキュメントを更新する：

| ドキュメント | 更新内容 |
|-------------|---------|
| `01_planning/azure_config/02_StaticWebApps.md` | 廃止 or アーカイブ |
| `01_planning/azure_config/XX_AppService.md` | **新規作成** |
| `02_design/06_DeploymentDesign.md` | App Service 版に全面改訂 |
| `01_planning/azure_config/07_ApplicationInsights.md` | コードレス監視設定を追加 |
| `01_planning/azure_config/09_CostManagement.md` | 予算見直し |

## 6. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| DNS 切り替え時のダウンタイム | 中 | 事前に TTL を短縮（300秒） |
| 認証リダイレクト URI 不整合 | 高 | 事前に OAuth 設定を追加 |
| App Service の cold start 遅延 | 低 | Always On を有効化（B1以上） |
| 月額コスト増加 | 低 | +$4/月 程度、許容範囲 |

## 7. 成功基準

- [ ] Application Insights にログが出力される
- [ ] すべての認証プロバイダー（GitHub, Google）が動作する
- [ ] 本番 URL でアプリケーションが正常動作する
- [ ] CI/CD パイプラインが正常に動作する
- [ ] 月額コストが予算内（¥5,000以内）に収まる

## 8. スケジュール

| フェーズ | 期間 | 成果物 |
|---------|------|--------|
| Phase 1: 準備 | Day 1-2 | 設計書、Azure リソース |
| Phase 2: 開発 | Day 3-4 | ソースコード、CI/CD |
| Phase 3: 検証 | Day 5-6 | ステージング動作確認 |
| Phase 4: 本番移行 | Day 7 | 本番稼働 |

**推定所要期間: 7日間**

---

**作成日**: 2026-02-04
**更新日**: 2026-02-04
**ステータス**: 計画中
