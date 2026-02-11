# Azure App Service 設計書

## 1. 基本情報

- **設定項目 ID:** APPSVC-001
- **リソース種別:** Azure App Service (Web App)
- **名称:** `app-pm-exam-dx-prod`

## 2. リソース構成

### 2.1 App Service リソース

| 項目 | 設定値 | 備考 |
|------|--------|------|
| **リソースグループ** | `rg-pm-exam-dx-prod` | 既存 |
| **名称** | `app-pm-exam-dx-prod` | |
| **リージョン** | East Asia (東アジア) | SWA と同じリージョン |
| **OS** | Linux | Node.js アプリ推奨 |
| **ランタイムスタック** | Node.js 20 LTS | Next.js 14 対応 |

### 2.2 App Service Plan

| 項目 | 設定値 | 備考 |
|------|--------|------|
| **プラン名** | `plan-pm-exam-dx-prod` | |
| **SKU** | B1 (Basic) | Always On 対応、$13/月 |
| **インスタンス数** | 1 | スケールアウト不要（MVP） |
| **OS** | Linux | コスト効率が良い |

### 2.3 SKU 選定理由

| SKU | 月額目安 | Always On | カスタムドメイン | SSL | 選定 |
|-----|---------|-----------|-----------------|-----|------|
| F1 (Free) | $0 | ❌ | ❌ | ❌ | ❌ |
| B1 (Basic) | ~$13 | ✅ | ✅ | ✅ | ✅ **採用** |
| S1 (Standard) | ~$70 | ✅ | ✅ | ✅ | 過剰 |

**B1 を採用**: Always On でコールドスタート回避、カスタムドメイン対応、コスト効率

## 3. 構成設定

### 3.1 アプリケーション設定 (Application Settings)

| キー | 値 | 備考 |
|------|-----|------|
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` | Node.js バージョン |
| `WEBSITES_PORT` | `8080` | Oryx が `PORT=8080` を設定するため合わせる |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` | ZIP パッケージを直接マウントして実行。Oryx の node_modules.tar.gz 展開をバイパスする |
| `NODE_ENV` | `production` | 本番モード |
| `COSMOS_DB_CONNECTION` | `@Microsoft.KeyVault(...)` | Key Vault 参照 |
| `TELEMETRY_CONNECTION_STRING` | 手動設定 | Application Insights 接続文字列（IPA コードレスエージェントが検出しないカスタム名） |
| `AUTH_SECRET` | `@Microsoft.KeyVault(...)` | Key Vault 参照 |
| `AUTH_TRUST_HOST` | `true` | NextAuth 設定 |
| `AUTH_GITHUB_ID` | 設定値 | GitHub OAuth |
| `AUTH_GITHUB_SECRET` | `@Microsoft.KeyVault(...)` | Key Vault 参照 |
| `AUTH_GOOGLE_ID` | 設定値 | Google OAuth |
| `AUTH_GOOGLE_SECRET` | `@Microsoft.KeyVault(...)` | Key Vault 参照 |
| `GEMINI_API_URL` | `https://func-pm-exam-dx-ai-us.azurewebsites.net` | AI API |

### 3.2 全般設定 (General Settings)

| 項目 | 設定値 | 備考 |
|------|--------|------|
| **HTTP バージョン** | 2.0 | パフォーマンス向上 |
| **Web ソケット** | ON | リアルタイム通信 |
| **Always On** | ON | B1 以上で有効 |
| **ARR アフィニティ** | OFF | ステートレスアプリ |
| **HTTPS のみ** | ON | セキュリティ |

### 3.3 スタートアップコマンド

```bash
node server.js
```

※ Next.js standalone モードの出力ファイル
※ Application Insights SDK は `instrumentation.ts`（Next.js Instrumentation Hook）で初期化
※ **CI/CD ワークフロー内で `az webapp config set --startup-file "node server.js"` を毎回実行し、起動コマンドの乖離を防止する**

## 4. Application Insights 統合

### 4.1 SDK 手動統合（v3 useAzureMonitor API）

**重要:** Linux App Service + Node.js ではコードレス監視が利用できないため、SDK を手動で初期化する。

**IPA コードレスエージェントとの競合回避:**

Linux App Service の Oryx スクリプトは `APPLICATIONINSIGHTS_*` や `APPINSIGHTS_*` プレフィックスの
環境変数を検出して IPA コードレスエージェントを自動有効化する。手動 SDK と二重初期化され、
OpenTelemetry のグローバルレジストリが競合するため、以下の対策を適用:

1. **IPA 関連環境変数はすべて完全削除**（`disabled` ではなく削除）
   - `ApplicationInsightsAgent_EXTENSION_VERSION`
   - `XDT_MicrosoftApplicationInsights_Mode`
   - `XDT_MicrosoftApplicationInsights_PreemptSdk`
   - `APPLICATIONINSIGHTS_CONNECTION_STRING`
2. **接続文字列は `TELEMETRY_CONNECTION_STRING`（カスタム名）を使用**

**SDK 初期化方法:**
1. `instrumentation.ts`（Next.js Instrumentation Hook）で `applicationinsights` v3 の `useAzureMonitor()` API を呼び出し
2. Next.js サーバー起動時に `register()` が自動的に呼ばれ、SDK が初期化される
3. `next.config.js` の `serverExternalPackages` に `applicationinsights` および全 OpenTelemetry 依存パッケージを登録し、Webpack バンドルによるモジュールスコープ分離を防止

**環境変数の設定:**
1. Azure Portal > App Service > `app-pm-exam-dx-prod`
2. 「設定」>「構成」>「アプリケーション設定」
3. `TELEMETRY_CONNECTION_STRING` に Application Insights の接続文字列を設定

**収集されるデータ:**
- HTTP リクエスト/レスポンス
- 依存関係（Cosmos DB、外部 API）
- 例外・エラー
- パフォーマンスメトリクス

### 4.2 serverExternalPackages の設定

`next.config.js` の `serverExternalPackages` には、Application Insights v3 SDK の
依存ツリー全体を指定する。不完全な指定では Webpack バンドルにより
OpenTelemetry のグローバルレジストリが分離し、テレメトリがサイレントに失われる。

詳細は `next.config.js` の `serverExternalPackages` 配列を参照。

## 5. カスタムドメイン

### 5.1 ドメイン設定

| 項目 | 設定値 |
|------|--------|
| **カスタムドメイン** | `shikaku-no.com` |
| **SSL 証明書** | App Service Managed Certificate (無料) |
| **TLS バージョン** | 1.2 以上 |

### 5.2 DNS 設定

| レコードタイプ | ホスト | 値 |
|---------------|--------|-----|
| CNAME | `www` | `app-pm-exam-dx-prod.azurewebsites.net` |
| TXT | `asuid.www` | App Service 検証用トークン |
| A | `@` | App Service IP (オプション) |

## 6. ネットワーク・セキュリティ

### 6.1 ネットワーク設定

| 項目 | 設定値 | 備考 |
|------|--------|------|
| **HTTPS のみ** | 有効 | HTTP → HTTPS リダイレクト |
| **最小 TLS バージョン** | 1.2 | セキュリティ要件 |
| **IP 制限** | なし | パブリックアクセス |

### 6.2 マネージド ID

| 項目 | 設定値 | 用途 |
|------|--------|------|
| **システム割り当て** | 有効 | Key Vault アクセス |

**Key Vault アクセスポリシー:**
- `app-pm-exam-dx-prod` に対して「シークレット取得」権限を付与

## 7. デプロイスロット（将来拡張）

B1 プランではデプロイスロット未対応。将来 S1 に移行時に検討。

| スロット | 用途 |
|---------|------|
| `production` | 本番環境 |
| `staging` | ステージング（S1 以上） |

## 8. Azure CLI コマンド

### 8.1 App Service Plan 作成

```bash
az appservice plan create \
  --name plan-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --sku B1 \
  --is-linux \
  --location eastasia
```

### 8.2 Web App 作成

```bash
az webapp create \
  --name app-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --plan plan-pm-exam-dx-prod \
  --runtime "NODE:20-lts"
```

### 8.3 Application Insights 有効化

```bash
az monitor app-insights component connect-webapp \
  --app appi-pm-exam-dx \
  --resource-group rg-pm-exam-dx-prod \
  --web-app app-pm-exam-dx-prod \
  --enable-profiler false \
  --enable-snapshot-debugger false
```

### 8.4 環境変数設定

```bash
az webapp config appsettings set \
  --name app-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --settings \
    NODE_ENV=production \
    WEBSITES_PORT=8080 \
    WEBSITE_RUN_FROM_PACKAGE=1 \
    AUTH_TRUST_HOST=true
```

## 9. Bicep テンプレート

```bicep
// infra/azure/appservice.bicep
param location string = 'eastasia'
param appName string = 'app-pm-exam-dx-prod'
param planName string = 'plan-pm-exam-dx-prod'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: planName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true // Linux
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'WEBSITES_PORT', value: '8080' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
      ]
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}
```

## 10. 移行チェックリスト

- [ ] App Service Plan 作成
- [ ] Web App 作成
- [ ] Application Insights 連携
- [ ] 環境変数設定
- [ ] カスタムドメイン設定
- [ ] SSL 証明書設定
- [ ] マネージド ID 設定
- [ ] Key Vault アクセス権限付与
- [ ] OAuth リダイレクト URI 更新

---

**作成日**: 2026-02-04
**更新日**: 2026-02-11
**ステータス**: 設計完了
