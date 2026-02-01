# Azure Functions 設定設計書

## 1. 概要

本プロジェクトでは以下の2種類のバックエンド構成を使用している：

1. **Managed Functions** - Azure Static Web Apps に内包されるAPIエンドポイント
2. **独立 Function App (api-ai)** - US リージョンに配置されたAI専用Function

## 2. Managed Functions (SWA内包)

### 基本情報
- **設定項目 ID:** FUNC-001 (Managed)
- **実行環境:** Azure Static Web Apps (Managed Functions)
- **リソース:** SWAリソースに内包 (`swa-pm-exam-dx-prod`)

### 概要
現在は独立した Azure Function App リソースを使用せず、Static Web Apps の **Managed Functions** 機能を利用してバックエンド (API) を提供しています。
Next.js の API Routes (`/app/api/**`) は自動的に Managed Functions としてデプロイされます。

### 詳細設定
| 項目                    | 設定値               | 備考                                      |
| :---------------------- | :------------------- | :---------------------------------------- |
| **ランタイム**          | Node.js 20           | SWAの設定に準拠                           |
| **APIロケーション**     | (Next.jsビルド成果物)| `apps/web/.next` 内のFunctionsコードを使用 |

### モノレポ構成における重要な制約
本プロジェクトはモノレポ構成であり、`@ipa-lab/shared` 等のローカルパッケージに依存しています。
これらのパッケージは npm レジストリに公開されていないため、Azure Static Web Apps の Oryx ビルドシステムが `npm install --production` を実行すると **404 エラー** で失敗します。

**対策:**
- GitHub Actions ワークフローで `skip_api_build: true` を設定
- `next build` 時に API Routes は `.next` フォルダ内にバンドル済みのため、Oryx による再ビルドは不要

### 環境変数 (App Settings)
以下の環境変数は、Static Web Apps のリソース設定に追加する必要があります。

| キー                      | 設定値・参照先                             | 用途               |
| :------------------------ | :----------------------------------------- | :----------------- |
| `COSMOS_DB_CONNECTION`    | Key Vault参照 (`@Microsoft.KeyVault(...)`) | DB接続文字列       |
| `AUTH_SECRET`             | Key Vault参照                              | 認証トークン検証用 |
| `BLOB_STORAGE_CONNECTION` | Key Vault参照                              | Blob接続文字列     |

---

## 3. 独立 Function App (api-ai) - US リージョン

### 3.1 基本情報
| 項目                    | 設定値                           |
| :---------------------- | :------------------------------- |
| **設定項目 ID**         | FUNC-002                         |
| **リソース名**          | `func-pm-exam-dx-ai-us`          |
| **リソースグループ**    | `rg-pm-exam-dx-ai-us`            |
| **リージョン**          | US East 2                        |
| **ランタイム**          | Node.js 20                       |
| **Functions バージョン**| V4                               |
| **ホスティングプラン**  | Consumption (Linux)              |
| **ストレージアカウント**| `stpmexamdxaius`                 |

### 3.2 作成理由

**Gemini API の地域制限への対応:**
- Google Gemini API は特定の地域からのみアクセス可能
- East Asia リージョン（日本）からの呼び出しでは `User location is not supported` エラーが発生
- US East 2 リージョンに専用の Function App を配置することで、この制限を回避

### 3.3 アーキテクチャ

```
[ユーザー] 
    ↓
[Azure SWA (East Asia)]
[shikaku-no.com]
    ↓
[Next.js API Route: /api/ai/plan]
    ↓ (プロキシ)
[Azure Function App (US East 2)]
[func-pm-exam-dx-ai-us.azurewebsites.net]
    ↓
[Google Gemini API]
```

### 3.4 関数一覧

| 関数名   | トリガー    | ルート       | 用途                     |
| :------- | :---------- | :----------- | :----------------------- |
| `aiPlan` | HTTP (POST) | `/api/ai/plan` | AI学習プラン生成         |

### 3.5 使用モデル

| 優先度     | モデル名           | 用途                     |
| :--------- | :----------------- | :----------------------- |
| Primary    | `gemini-2.5-flash` | メイン（高速・低遅延）   |
| Fallback   | `gemini-2.0-flash` | フォールバック           |

**重要**: v1beta API との互換性のため、モデル名は Google ListModels API で確認した正式名を使用すること。

### 3.6 環境変数

| キー                   | 設定値・参照先                        | 用途                       |
| :--------------------- | :------------------------------------ | :------------------------- |
| `GEMINI_API_KEY`       | Google AI Studio APIキー              | Gemini API認証             |
| `COSMOS_DB_CONNECTION` | CosmosDB接続文字列                    | メトリクス保存用           |
| `FUNCTIONS_WORKER_RUNTIME` | `node`                            | ランタイム指定             |
| `FUNCTIONS_EXTENSION_VERSION` | `~4`                           | Functions V4               |

### 3.7 デプロイ手順

**重要**: Linux Consumption Plan では `--build remote` オプションが必須。

```bash
cd apps/api-ai
npm run build
func azure functionapp publish func-pm-exam-dx-ai-us --build remote
```

**デプロイ成功の確認:**
```
Functions in func-pm-exam-dx-ai-us:
    aiPlan - [httpTrigger]
        Invoke url: https://func-pm-exam-dx-ai-us.azurewebsites.net/api/ai/plan
```

### 3.8 トラブルシューティング

#### 関数が登録されない (0 functions found)
- **原因**: Linux Consumption Plan でローカルビルドのバイナリが互換性を持たない
- **解決策**: `--build remote` オプションを使用してAzure側でビルド

#### Gemini API 404エラー
- **原因**: 無効なモデル名
- **解決策**: ListModels API で利用可能なモデルを確認
  ```bash
  curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
  ```

#### fetch failed / Timeout
- **原因**: ネットワーク接続の問題、またはリージョン制限
- **解決策**: Function App が US リージョンにあることを確認

---

## 4. 将来の拡張

### 4.1 BYOB (Bring Your Own Backend)
将来的にバックエンド処理が複雑化し、タイムアウト延長（Managedは通常45秒制限あり）やVNET統合が必要になった場合は、独立した Function App を作成し、**Bring Your Own Backend (BYOB)** 機能でリンクすることを検討します。

### 4.2 api-ai の機能拡張
- 学習進捗分析
- 過去問解説生成
- 弱点診断機能