# Azure Functions 設定設計書

## 基本情報
- **設定項目 ID:** FUNC-001
- **リソース種別:** Function App
- **名称:** `func-pm-exam-dx-api`

## 詳細設定
| 項目                          | 設定値                     | 備考                          |
| :---------------------------- | :------------------------- | :---------------------------- |
| **リソースグループ**          | `rg-pm-exam-dx-prod`       |                               |
| **公開**                      | Code                       |                               |
| **ランタイム スタック**       | Node.js                    | v20 LTS (推奨)                |
| **バージョン**                | 20                         |                               |
| **リージョン**                | Japan East (東日本)        |                               |
| **オペレーティング システム** | Linux                      | Node.jsのパフォーマンス最適化 |
| **プラン**                    | Consumption (サーバーレス) | 待機コストゼロを実現するため  |

## ネットワーク & 監視
- **ストレージアカウント:** `stfuncpmexamdxprod` (新規作成)
- **Application Insights:** `appi-pm-exam-dx` (有効化)

## 環境変数 (App Settings)
| キー                      | 設定値・参照先                             | 用途               |
| :------------------------ | :----------------------------------------- | :----------------- |
| `COSMOS_DB_CONNECTION`    | Key Vault参照 (`@Microsoft.KeyVault(...)`) | DB接続文字列       |
| `NEXTAUTH_SECRET`         | Key Vault参照                              | 認証トークン検証用 |
| `BLOB_STORAGE_CONNECTION` | Key Vault参照                              | Blob接続文字列     |
