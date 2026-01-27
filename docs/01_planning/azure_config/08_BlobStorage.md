# Azure Blob Storage 設定設計書

## 基本情報
- **設定項目 ID:** ST-001
- **リソース種別:** Storage Account
- **名称:** `rgpmexamdxprod9991`

## 詳細設定
| 項目                 | 設定値               | 備考                              |
| :------------------- | :------------------- | :-------------------------------- |
| **リソースグループ** | `rg-pm-exam-dx-prod` |                                   |
| **リージョン**       | Japan East (東日本)  |                                   |
| **パフォーマンス**   | Standard             | 画像や論文データ用                |
| **冗長性**           | LRS (ローカル冗長)   | コスト重視。必要に応じてGRS検討。 |
| **アクセス層**       | Hot (ホット)         | 頻繁なアクセス                    |
| **階層型名前空間**   | 無効                 | Data Lake Gen2機能は不要          |

## コンテナ構成
| コンテナ名 | アクセスレベル        | 用途                        |
| :--------- | :-------------------- | :-------------------------- |
| `essays`   | Private               | 論文データ (暗号化保存)     |
| `assets`   | Blob (Anonymous Read) | 公開用静的アセット (画像等) |
| `backups`  | Private               | システムバックアップ        |

## セキュリティ
- **Secure transfer required:** Enabled
- **Blob public access:** Enabled (assetsコンテナ用) または CDN経由とし無効化も検討。MVPではEnabledでassetsのみ公開設定。
