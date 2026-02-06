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

**コードレスエージェントの無効化が必須:**

Linux App Service + Node.js + Next.js standalone 構成では、Azure コードレスエージェント
(`ApplicationInsightsAgent_EXTENSION_VERSION: ~3`) と手動 SDK 初期化の
二重初期化が原因で Next.js がクラッシュする。

以下の設定を必ず `disabled` にすること:
- `ApplicationInsightsAgent_EXTENSION_VERSION` = `disabled`
- `XDT_MicrosoftApplicationInsights_Mode` = `disabled`
- `XDT_MicrosoftApplicationInsights_PreemptSdk` = `disabled`

SDK の初期化は `instrumentation.ts`（Next.js Instrumentation Hook）で行い、
`APPLICATIONINSIGHTS_CONNECTION_STRING` のみを設定する。
