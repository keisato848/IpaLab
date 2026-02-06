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
| `NODE_ENV` | `production` | 本番モード |
| `COSMOS_DB_CONNECTION` | `@Microsoft.KeyVault(...)` | Key Vault 参照 |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | 手動設定 | SDK 手動統合用の接続文字列 |
| `ApplicationInsightsAgent_EXTENSION_VERSION` | `disabled` | コードレスエージェント無効化 |
| `XDT_MicrosoftApplicationInsights_Mode` | `disabled` | 自動計測モード無効化 |
| `XDT_MicrosoftApplicationInsights_PreemptSdk` | `disabled` | SDK 先取り無効化 |
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

## 4. Application Insights 統合

### 4.1 SDK 手動統合（Linux App Service 必須）

**重要:** Linux App Service + Node.js ではコードレス監視が利用できないため、SDK を手動で初期化する必要があります。

**注意:** Azure のコードレスエージェント (`ApplicationInsightsAgent_EXTENSION_VERSION: ~3`) と
手動 preload スクリプトを同時に有効にすると、HTTP モジュールの二重パッチにより
Next.js standalone の内部設定が破壊され、`canonicalBase` エラーでクラッシュします。
必ずコードレスエージェントを `disabled` に設定してください。

**無効化が必要な設定:**
| 設定名 | 値 | 理由 |
|--------|-----|------|
| `ApplicationInsightsAgent_EXTENSION_VERSION` | `disabled` | コードレスエージェントを無効化 |
| `XDT_MicrosoftApplicationInsights_Mode` | `disabled` | 自動計測モードを無効化 |
| `XDT_MicrosoftApplicationInsights_PreemptSdk` | `disabled` | SDK 先取りを無効化 |

**不要な設定（削除推奨）:**
- `APPINSIGHTS_INSTRUMENTATIONKEY` - コードレスエージェント用（不要）
- `APPINSIGHTS_CONNECTIONSTRING` - コードレスエージェント用（不要、`APPLICATIONINSIGHTS_CONNECTION_STRING` と重複）
- `APPINSIGHTS_PROFILERFEATURE_VERSION` - 不要
- `APPINSIGHTS_SNAPSHOTFEATURE_VERSION` - 不要
- `DiagnosticServices_EXTENSION_VERSION` - 不要
- `SnapshotDebugger_EXTENSION_VERSION` - 不要

**対応方法:**
1. `instrumentation.ts`（Next.js Instrumentation Hook）で SDK を初期化
2. Next.js サーバー起動時に `register()` が自動的に呼ばれ、SDK が初期化される
3. `applicationinsights` は `next.config.js` の `serverExternalPackages` に登録済み

**環境変数の設定:**
1. Azure Portal > App Service > `app-pm-exam-dx-prod`
2. 「設定」>「構成」>「アプリケーション設定」
3. `APPLICATIONINSIGHTS_CONNECTION_STRING` を設定（Application Insights の接続文字列）

**収集されるデータ:**
- HTTP リクエスト/レスポンス
- 依存関係（Cosmos DB、外部 API）
- 例外・エラー
- パフォーマンスメトリクス

### 4.2 追加カスタムログ

SDK 初期化後、カスタムログを出力可能。

```javascript
// lib/appinsights.ts
const appInsights = require('applicationinsights');
appInsights.setup()
    .setAutoCollectConsole(true, true)
    .start();
```

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
    AUTH_TRUST_HOST=true \
    ApplicationInsightsAgent_EXTENSION_VERSION=disabled \
    XDT_MicrosoftApplicationInsights_Mode=disabled \
    XDT_MicrosoftApplicationInsights_PreemptSdk=disabled
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
        { name: 'ApplicationInsightsAgent_EXTENSION_VERSION', value: 'disabled' }
        { name: 'XDT_MicrosoftApplicationInsights_Mode', value: 'disabled' }
        { name: 'XDT_MicrosoftApplicationInsights_PreemptSdk', value: 'disabled' }
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
**更新日**: 2026-02-06
**ステータス**: 設計完了
