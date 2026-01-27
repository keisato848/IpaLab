# Azure Key Vault 設定設計書

## 基本情報
- **設定項目 ID:** KV-001
- **リソース種別:** Key Vault
- **状態:** **未作成 (Not Created)**
- **名称 (Planned):** `kv-pm-exam-dx-prod`

## 概要
現在、本番環境において独立した Key Vault リソースは作成されていません。
機密情報（Cosmos DB接続文字列、Auth Secret等）は、Azure Static Web Apps の「アプリケーション設定 (Environment Variables)」または GitHub Actions Secrets 経由で管理されています。

将来的なセキュリティ強化時に作成を検討します。

## 詳細設定 (Future Plan)
| 項目                 | 設定値               | 備考                                            |
| :------------------- | :------------------- | :---------------------------------------------- |
| **リソースグループ** | `rg-pm-exam-dx-prod` |                                                 |
| **リージョン**       | Japan East (東日本)  |                                                 |
| **Pricing Tier**     | Standard             | HSM不要のため標準プラン                         |
| **Soft Delete**      | 有効 (90日)          | 誤削除防止                                      |
| **Purge Protection** | 無効                 | 開発段階では無効でも可 (本番運用時は有効化推奨) |

## アクセスポリシー / RBAC
- **Azure RBAC:** 推奨 (Key Vault Administrator等)
- **Functions:** Managed Identity に対して `Key Vault Secrets User` ロールを割り当て。

## 格納シークレット (例)
- `CosmosDbConnectionString`
- `BlobStorageConnectionString`
- `AuthSecret`
- `AuthGithubSecret` 
- `AuthGoogleSecret`
