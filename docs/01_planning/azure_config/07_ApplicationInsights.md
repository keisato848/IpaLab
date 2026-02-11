# Azure Application Insights 設定設計書

## 基本情報
- **設定項目 ID:** APPI-001
- **リソース種別:** Application Insights
- **名称:** `appi-pm-exam-dx`

## 詳細設定
| 項目                        | 設定値                      | 備考                           |
| :-------------------------- | :-------------------------- | :----------------------------- |
| **リソースグループ**        | `rg-pm-exam-dx-prod`        |                                |
| **リージョン**              | Japan East (東日本)         |                                |
| **リソースモード**          | Workspace-based             | Log Analytics Workspace と連携 |
| **Log Analytics Workspace** | `log-pm-exam-dx` (新規作成) | ログデータの保存先             |

## 監視設定
| 項目             | 設定                                  | 備考                      |
| :--------------- | :------------------------------------ | :------------------------ |
| **サンプリング** | Adaptive Sampling (有効)              | データ量に応じた調整      |
| **保持期間**     | 90日                                  | Log Analyticsの設定に依存 |
| **アラート**     | Server Error > 1%, Response Time > 2s | 異常検知用アラート設定    |

## App Service 統合時の注意事項

### IPA コードレスエージェントの回避

Linux App Service + Node.js 環境では、Azure の IPA コードレスエージェントが
`APPLICATIONINSIGHTS_*` や `APPINSIGHTS_*` プレフィックスの環境変数を自動検出し、
手動 SDK 初期化と競合する。これを回避するため:

1. **IPA 関連環境変数はすべて削除済み**（`disabled` ではなく完全削除）
   - `ApplicationInsightsAgent_EXTENSION_VERSION` → 削除
   - `XDT_MicrosoftApplicationInsights_Mode` → 削除
   - `XDT_MicrosoftApplicationInsights_PreemptSdk` → 削除
   - `APPLICATIONINSIGHTS_CONNECTION_STRING` → 削除
2. **接続文字列は `TELEMETRY_CONNECTION_STRING`（カスタム名）を使用**
   - IPA が認識しない環境変数名にすることで、自動有効化を防止

### SDK 初期化

- `instrumentation.ts`（Next.js Instrumentation Hook）で `applicationinsights` v3 の `useAzureMonitor()` API を使用
- 接続文字列は `process.env.TELEMETRY_CONNECTION_STRING` から読み取り

### serverExternalPackages（Next.js Webpack バンドル回避）

`next.config.js` の `serverExternalPackages` に Application Insights v3 SDK の
全依存パッケージを指定し、Webpack バンドルを回避する。
これにより、OpenTelemetry のグローバルレジストリが分離せず、テレメトリが正常に送信される。

指定パッケージ: `applicationinsights`, `@azure/monitor-opentelemetry`,
`@azure/monitor-opentelemetry-exporter`, `@opentelemetry/api`, `@opentelemetry/sdk-trace-node` 等
