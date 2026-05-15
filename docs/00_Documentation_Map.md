# ドキュメント体系図 (Documentation Map)

本プロジェクトにおけるドキュメントの役割と構成を定義します。
**原則: すべての実装は、以下の設計書のいずれかに基づいて行われなければなりません。**

## ドキュメント階層

```text
docs/
├── 00_Documentation_Map.md      # 本ドキュメント。ドキュメント体系の定義。
├── ai-planner-design.md         # AI学習プランナー機能の設計（暫定的に Implementation Level として扱う）
├── 01_planning/                 # [Planning Level] 要件定義・基本設計・全体計画
│   ├── 要件定義書.md            # プロジェクトの目的、機能要件、非機能要件
│   ├── AIアシスタント要件定義書.md # AIアシスタント機能の要件定義
│   ├── 基本設計書.md            # アーキテクチャ全体像、技術選定、開発規約概要
│   ├── 環境設計書.md            # インフラ構成、ネットワーク、CI/CD、セキュリティ
│   ├── DirectoryPlan.md         # ディレクトリ構造の方針
│   ├── WBS.md                   # スケジュールとタスク分解
│   └── azure_config/            # Azure リソース設定詳細
│       ├── 03_AzureFunctions.md # Managed Functions & 独立Function App (api-ai)
│       ├── 10_AppService.md     # App Service 設定（移行後）
│       └── ...
├── 02_design/                   # [Implementation Level] 詳細設計
│   ├── 01_ConfigurationDesign.md # (New) プロジェクト設定、ツーリング、Monorepo構成詳細
│   ├── 02_AppStructureDesign.md  # (New) 各アプリケーション(Web/API)の内部構造、モジュール設計
│   ├── 06_DeploymentDesign.md    # デプロイメント設計（App Service）
│   ├── 10_DetailedDesignGuide.md # 機能別詳細設計を作成・更新する際の標準ガイド
│   ├── 11_AuthAndGuestAccessDesign.md # 認証・ゲスト利用・履歴統合の詳細設計
│   ├── 12_DashboardAndLearningHistoryDesign.md # ダッシュボード・学習履歴・統計表示の詳細設計
│   ├── 13_AMPracticeDesign.md # 午前演習（一覧・出題・保存・結果）の詳細設計
│   ├── 14_PMPracticeAndScoringDesign.md # 午後演習・AI採点・集計表示の詳細設計
│   ├── 15_CommonApiAndErrorDesign.md # 共通 API 契約・HTTP ステータス・エラー応答の整理
│   ├── 16_TelemetryAndMonitoringDesign.md # Application Insights / PageViews / Copilot OTel / 監視設計
│   ├── 17_DataLoadingAndSyncBoundaryDesign.md # packages/data と apps/web のデータ境界設計
│   ├── 18_AiAssistantDesign.md   # AIアシスタントウィジェット（チャット・障害報告）の詳細設計
│   ├── 23_CopilotAgentCustomizationDesign.md # Copilot Agent カスタマイズ設計（Custom Agents/Hooks/MCP/E2E報告書）
│   └── 24_CopilotOtelLangfuseRunbook.md # Copilot OTel / Langfuse 監視・証跡手順書
├── 03_plans/                    # [Execution Plan Level] 整備計画・作業分割・再開用メモ
│   ├── detailed-design-systematization-plan.md # 機能詳細設計を体系化するための実行計画
│   ├── ai-assistant-implementation-plan.md # AIアシスタント機能の実装計画（8フェーズ）
│   └── ...
├── 03_migration/                # [Migration] SWA → App Service 移行計画
│   ├── 00_Migration_Overview.md     # 移行概要・スケジュール
│   ├── 01_Azure_AppService_Design.md # App Service 設計
│   ├── 02_Source_Code_Changes.md    # ソースコード変更点
│   ├── 03_CICD_Workflow_Design.md   # CI/CD 設計
│   ├── 04_Test_Verification_Plan.md # テスト・検証計画
│   └── 05_Rollback_Plan.md          # ロールバック計画
└── agent_logs/                  # AIエージェントとの対話ログ
```

## 各ドキュメントの役割

### 1. Planning Level (`01_planning/`)
プロジェクトの「What (何を作るか)」と「Why (なぜ作るか)」、および高レベルの「How (どう実現するか)」を定義します。
- **要件定義書**: 実装機能の正解基準。
- **基本設計書**:技術スタックとシステム全体像の正解基準。
- **環境設計書**: インフラとデプロイの正解基準。

### 2. Implementation Level (`02_design/`)
開発者がコードを書くための具体的な「How」を定義します。
- **ConfigurationDesign**: `package.json`, `tsconfig`, ESLint, Prettier などの設定値の根拠。
- **AppStructureDesign**: `apps/web` や `apps/api` 内部のファイル配置ルール、コンポーネント設計方針。
- **機能別詳細設計**: 認証、演習、ダッシュボード、API、運用監視など、機能単位の実装仕様。

主要な機能別詳細設計:

- `11_AuthAndGuestAccessDesign.md`
- `12_DashboardAndLearningHistoryDesign.md`
- `13_AMPracticeDesign.md`
- `14_PMPracticeAndScoringDesign.md`
- `15_CommonApiAndErrorDesign.md`
- `16_TelemetryAndMonitoringDesign.md`
- `17_DataLoadingAndSyncBoundaryDesign.md`
- `18_AiAssistantDesign.md`
- `24_CopilotOtelLangfuseRunbook.md`

補足:
- `ai-planner-design.md` は現状 `docs/` 直下にあるが、内容上は Implementation Level として扱う。

### 3. Execution Plan Level (`03_plans/`)
複数セッションに跨る整備作業や、機能横断のドキュメント整備の段取りを定義します。

- **役割**: 実行順序、作業単位、優先順位、再開ポイントの保持。
- **用途**: 会話コンテキストが圧縮されても、次に何を読むか・何から書くかを復元するための運用計画。
- **注意**: 実装仕様の最終版は `02_design/` または該当する正式設計書に反映し、`03_plans/` 単体を実装の正解基準にしない。

## 運用ルール
1. **設計先行**: コードを書く前に、必ず該当する設計書が存在し、内容が承認されていること。
2. **整合性維持**: 実装中に設計変更が必要になった場合、コードではなくまず設計書を更新すること。
3. **新規作成**: 新たな機能やモジュールを追加する場合、適切な詳細設計書を `02_design/` 配下に新規作成または追記すること。
4. **計画と正式設計の分離**: 長期的な整備計画や作業再開メモは `03_plans/` に残し、確定した仕様は `02_design/` に昇格させること。
