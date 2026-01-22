# Azure Functions 設定設計書 (Managed Functions)

## 基本情報
- **設定項目 ID:** FUNC-001 (Managed)
- **実行環境:** Azure Static Web Apps (Managed Functions)
- **リソース:** SWAリソースに内包 (`swa-pm-exam-dx-prod`)

## 概要
現在は独立した Azure Function App リソースを使用せず、Static Web Apps の **Managed Functions** 機能を利用してバックエンド (API) を提供しています。
Next.js の API Routes (`/app/api/**`) は自動的に Managed Functions としてデプロイされます。

## 詳細設定
| 項目                    | 設定値               | 備考                                      |
| :---------------------- | :------------------- | :---------------------------------------- |
| **ランタイム**          | Node.js 20           | SWAの設定に準拠                           |
| **APIロケーション**     | (Next.jsビルド成果物)| `apps/web/.next` 内のFunctionsコードを使用 |

## 環境変数 (App Settings)
以下の環境変数は、Static Web Apps のリソース設定に追加する必要があります。

| キー                      | 設定値・参照先                             | 用途               |
| :------------------------ | :----------------------------------------- | :----------------- |
| `COSMOS_DB_CONNECTION`    | Key Vault参照 (`@Microsoft.KeyVault(...)`) | DB接続文字列       |
| `AUTH_SECRET`             | Key Vault参照                              | 認証トークン検証用 |
| `BLOB_STORAGE_CONNECTION` | Key Vault参照                              | Blob接続文字列     |

## 将来の拡張 (BYOB)
将来的にバックエンド処理が複雑化し、タイムアウト延長（Managedは通常45秒制限あり）やVNET統合が必要になった場合は、独立した Function App を作成し、**Bring Your Own Backend (BYOB)** 機能でリンクすることを検討します。