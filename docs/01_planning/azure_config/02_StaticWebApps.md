# Azure Static Web Apps 設定設計書

## 基本情報
- **設定項目 ID:** SWA-001
- **リソース種別:** Static Web Apps
- **名称:** `swa-pm-exam-dx-prod`

## 詳細設定
| 項目                 | 設定値               | 備考                                                        |
| :------------------- | :------------------- | :---------------------------------------------------------- |
| **リソースグループ** | `rg-pm-exam-dx-prod` |                                                             |
| **SKU (プラン)**     | Standard             | 商用利用、カスタムドメインSSL、SLA適用のため                |
| **リージョン**       | East Asia (東アジア) | SWAのデプロイ先 (Global配信だがメタデータ配置場所)          |
| **ソース**           | GitHub (Other)       | GitHub Actions連携                                          |
| **ビルド設定**       | Framework: Next.js   |                                                             |
| **アプリの場所**     | `/apps/web`          | Monorepo構成に従う                                          |
| **APIの場所**        | (空欄)               | Azure FunctionsをBring Your Own Backendとしてリンクするため |
| **出力先**           | `.next` または `out` | Next.jsの設定に準拠                                         |

## 環境変数 (Application Settings)
NextAuth.js 等の動作に必要な環境変数を設定します。

| キー                                       | 備考                |
| :----------------------------------------- | :------------------ |
| `AUTH_SECRET`                              | Key Vault参照を推奨 |
| `AUTH_TRUST_HOST`                          | `'true'` を設定     |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`     | OAuth連携用         |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`     | OAuth連携用         |

## カスタムドメイン
- **ドメイン:** `pm-exam-dx.com` (仮)
- **SSL証明書:** Managed Certificate (無料)
