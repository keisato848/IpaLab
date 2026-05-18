# Azure Cosmos DB 設定設計書

## 基本情報
- **設定項目 ID:** DB-001
- **リソース種別:** Azure Cosmos DB for NoSQL
- **名称:** `cosmos-pm-exam-dx-db` (Azure Global等で作成された既存リソース)

## 詳細設定
| 項目                         | 設定値               | 備考                                                                  |
| :--------------------------- | :------------------- | :-------------------------------------------------------------------- |
| **リソースグループ**         | `rg-pm-exam-dx-prod-grobal` | (既存のグローバルRGを利用)                                            |
| **API**                      | Core (SQL)           | JSONドキュメントの標準操作                                            |
| **ロケーション**             | Global (East Asia含む)|                                                                       |
| **キャパシティモード**       | Serverless           | スパイクアクセス対応、低負荷時のコスト削減 (< 1000 RU/s 平均なら有利) |
| **Geo冗長**                  | 無効                 | コスト優先 (必要に応じて有効化)                                       |
| **マルチリージョン書き込み** | 無効                 |                                                                       |

## コンテナ設計 (Database: `PMExamDB` / `IPA_Exam_DB`)
| コンテナ名         | パーティションキー       | 備考                                                             |
| :----------------- | :----------------------- | :--------------------------------------------------------------- |
| `Items`            | `/pk`                    | 汎用コンテナ (typeプロパティで種別判定: User, Question, History) |
| **または個別設計** |                          |                                                                  |
| `Users`            | `/userId`                | ユーザー情報                                                     |
| `Questions`        | `/category` or `/examId` | 問題データ                                                       |
| `LearningHistory`  | `/userId`                | 学習履歴 (クエリ頻度が高いキー)                                  |

※ 本プロジェクトではMonorepo構成かつ小規模スタートのため、単一コンテナまたは論理ごとの分割を検討。初期は `Users`, `Questions`, `History` の3つを推奨。

## ネットワークセキュリティ (ゼロトラスト保護)

CosmosDB へのアクセスを **Selected Networks モード**で制限し、許可された VNet / IP アドレス以外からの通信をすべて遮断しています。

### ファイアウォール構成

| 項目 | 設定値 | 備考 |
| :--- | :--- | :--- |
| **publicNetworkAccess** | `Enabled` | Selected Networks モードで運用 |
| **isVirtualNetworkFilterEnabled** | `true` | VNet ルールフィルタ有効 |
| **Azure サービスからのアクセス許可** | `無効` | 0.0.0.0 は未登録 |

### VNet ルール (サービスエンドポイント)

| VNet / サブネット | リソースグループ | 用途 |
| :--- | :--- | :--- |
| `vnet-pm-exam-dx-ea/snet-appservice` | `rg-pm-exam-dx-prod` | App Service からのアクセス (East Asia) |

### IP ルール (ファンクションアプリ用)

Function App (`func-pm-exam-dx-ai-us`, US East 2) の `possibleOutboundIpAddresses` を登録。
Y1 Consumption Plan のため VNet 統合が使用できず、IP フィルタで対応。

> **注意**: Function App のスケールインイベント等で `possibleOutboundIpAddresses` が変更される可能性があります。  
> 定期的に `az functionapp show --query possibleOutboundIpAddresses` で確認し、不一致があれば CosmosDB の IP ルールを更新してください。

### ローカルアクセス

通常時はローカル PC からのアクセスは遮断されます。  
`packages/data` の同期スクリプト実行時は、一時的に IP を追加し、作業後に削除します。  
詳細は `docs/azure-sync-guide.md` を参照。

Azure 接続文字列を使わない開発時の API/DB 結合確認には、Linux 版 Azure Cosmos DB Emulator を使用する。リポジトリルートの `npm run cosmos:emulator` は `cosmos-emulator/docker-compose.yml` を通じて Emulator を HTTPS mode で起動し、`npm run cosmos:verify-local` は `pm-exam-dx-db`、主要コンテナ、`Metrics` コンテナでの write/read/delete を検証する。devcontainer / Docker コンテナ内からホスト OS 上の Emulator を使う場合は `host.docker.internal:8081` をローカル接続として扱う。検証スクリプトはローカル host だけを許可し、本番・Staging Cosmos DB への誤実行を防ぐ。

### Bicep テンプレート

ネットワーク構成は `infra/azure/network.bicep` で IaC 管理。  
CosmosDB のファイアウォール設定は `infra/azure/resources.bicep` に定義。
