# Azure Key Vault 設定設計書

## 基本情報
- **設定項目 ID:** KV-001
- **リソース種別:** Key Vault
- **名称:** `kv-pm-exam-dx-prod`

## 詳細設定
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
