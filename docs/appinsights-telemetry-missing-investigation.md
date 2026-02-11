# Application Insights テレメトリ未送信 調査報告書

- **調査日**: 2026-02-11
- **対象**: `app-pm-exam-dx-prod` → `appi-pm-exam-dx` (Application Insights)
- **ステータス**: SDK 初期化は成功しているがテレメトリが一切到着していない
- **前回関連調査**: [appservice-startup-failure-investigation.md](./appservice-startup-failure-investigation.md)

---

## 1. 障害の概要

App Service `app-pm-exam-dx-prod` から Application Insights `appi-pm-exam-dx` に対して、
`requests`、`traces`、`exceptions`、`dependencies`、`pageViews` 等の **すべてのテレメトリが一切出力されていない**。

コンテナログ上は SDK 初期化成功メッセージが出力されており、アプリケーション自体は正常に稼働している。

---

## 2. 確認した事実

### 2.1 Azure リソース状態

| 項目 | 状態 | 備考 |
|------|------|------|
| App Service 状態 | `Running` / `Normal` | 正常稼働中 |
| App Service 種別 | `app,linux` / Node 20 LTS | |
| ホスト名 | `shikaku-no.com`, `app-pm-exam-dx-prod.azurewebsites.net` | |
| Application Insights | `provisioningState: Succeeded` | Japan East |
| InstrumentationKey | `fa3400e8-401e-4493-89a7-23d520eb021b` | 正常 |

### 2.2 環境変数（App Service アプリケーション設定）

**IPA コードレスエージェント関連設定**: **すべて削除済み（0件ヒット）**

| 設定名 | 値 | 備考 |
|--------|-----|------|
| `TELEMETRY_CONNECTION_STRING` | `InstrumentationKey=fa3400e8-...` | Application Insights 接続文字列（正しい値） |
| `WEBSITES_PORT` | `8080` | |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` | zip デプロイ |
| `NODE_ENV` | `production` | |

**注意**: `APPLICATIONINSIGHTS_CONNECTION_STRING`、`ApplicationInsightsAgent_EXTENSION_VERSION`、`XDT_*` 等の IPA トリガー設定はすべて削除済み。

### 2.3 App Service 構成

| 項目 | 値 |
|------|-----|
| `linuxFxVersion` | `NODE\|20-lts` |
| スタートアップコマンド | `node server.js` |
| デプロイ方式 | ZIP Deploy (WEBSITE_RUN_FROM_PACKAGE=1) |

### 2.4 診断設定（Diagnostic Settings）

App Service のプラットフォームレベル診断設定は `logsend-app-pm-exam-dx-prod` として構成済み:

| カテゴリ | 有効 |
|----------|------|
| AppServiceHTTPLogs | ✅ |
| AppServiceConsoleLogs | ✅ |
| AppServiceAppLogs | ❌ |
| AppServiceAuditLogs | ✅ |
| AppServiceIPSecAuditLogs | ✅ |
| AppServicePlatformLogs | ✅ |
| AppServiceAuthenticationLogs | ✅ |
| AllMetrics | ✅ |

送信先: `DefaultWorkspace-27a72f6b-...-EJP` (Log Analytics)

**重要**: これはプラットフォームログの転送設定であり、Application Insights SDK のテレメトリ（requests/traces 等）とは無関係。

### 2.5 Application Insights クエリ結果

```kql
-- 過去1週間の全テレメトリ確認
union requests, traces, pageViews, exceptions, dependencies
| summarize count() by itemType
| order by count_ desc
-- 結果: 空（0行）
```

**過去168時間（1週間）で全テレメトリテーブルが完全に空。**

### 2.6 コンテナログ（2026-02-10）

```
2026-02-10T23:36:53.968 Environment Variables for Application Insight's IPA Codeless Configuration exists..
2026-02-10T23:36:54.702 Running #!/bin/sh
2026-02-10T23:36:54.702 PATH="$PATH:/home/site/wwwroot" node server.js
2026-02-10T23:36:59.990 ▲ Next.js 16.1.5
2026-02-10T23:37:00.029 ○ Starting...
2026-02-10T23:37:16.803 [AppInsights] SDK initialized (useAzureMonitor v3 API)
2026-02-10T23:37:16.843 ✓ Ready in 17s
```

**注目点**:
- `Environment Variables for Application Insight's IPA Codeless Configuration exists..` が出力されている（Oryx スクリプトが IPA 設定を検出）
- ただし `--require` や IPA エージェントの注入は発生していない
- `[AppInsights] SDK initialized (useAzureMonitor v3 API)` → SDK 初期化は成功と報告
- エクスポートエラーやネットワークエラーのログは **一切出力されていない**

---

## 3. 過去の修正履歴（時系列）

| バージョン | コミット | 日付 | 変更内容 |
|-----------|---------|------|---------|
| v0.2.0 | `f765117` | - | `api-ai` に Application Insights SDK を初統合 |
| v0.2.1 | `5c5962b` | - | `appinsights-preload.js` による SDK 統合（PR #83） |
| v0.2.2 | `f03cf5f` | 02-06 | IPA コードレスエージェント無効化 + WEBSITES_PORT修正（canonicalBase クラッシュ解消） |
| v0.2.3 | `de3fb58` | - | `appinsights-preload.js` 除去 → `instrumentation.ts` に一本化 |
| v0.2.5 | `e687c6b` | - | Webpack ビルドでの SDK 初期化エラーを修正 |
| v0.3.1 | `d5f02ed` | - | テレメトリ未送信問題を修正 → **v3 API (`useAzureMonitor`) に移行** |
| v0.4.1 | `10a4e1d` | - | OpenTelemetry DEBUG ログ有効化で調査 |
| v0.4.2 | `ec3fa1e` | - | 手動テレメトリ送信 + 明示的フラッシュで送信経路を検証 |
| v0.5.1 | `d10121f` | - | `disableOfflineStorage=true` でディスクフォールバック防止 |
| v0.6.2 | `6dcdc86` | - | Linux App Service コードレスエージェント無効化修正 |
| v0.6.3 | `a96dc6d` | - | IPA 接続文字列検出回避（`APPINSIGHTS_CS` に改名） |
| v0.7.1 | `9e1f3ee` | 02-11 | IPA トリガー全設定削除 + `TELEMETRY_CONNECTION_STRING` に統一 |

**経緯**: v0.2.2 でコードレスエージェントとの二重初期化によるクラッシュを解消した後、v0.3.1 で v3 API に移行。以降 v0.4.x〜v0.7.1 まで、IPA コードレスエージェントの自動検出との競合回避に注力してきたが、**テレメトリ自体は一度も正常に送信されていない**。

---

## 4. 根本原因の特定

### 4.1 原因: `serverExternalPackages` の不完全な指定による OpenTelemetry グローバルレジストリの分離

**ファイル**: `apps/web/next.config.js` L12-16

```javascript
serverExternalPackages: [
    '@azure/cosmos',
    'applicationinsights',
    '@opentelemetry/api',
],
```

#### 問題のメカニズム

1. `applicationinsights` と `@opentelemetry/api` は `serverExternalPackages` に指定 → **Node.js の `require()` でネイティブに読み込まれる**
2. `applicationinsights` v3 の内部依存（`@opentelemetry/sdk-trace-node`、`@opentelemetry/instrumentation`、`@azure/monitor-opentelemetry-exporter` 等）は **リストに含まれていない** → **Next.js の Webpack がバンドル**する
3. その結果：

```
[ネイティブ require]           [Webpack バンドル]
  @opentelemetry/api ←───×──→ @opentelemetry/sdk-trace-node
  applicationinsights          @opentelemetry/instrumentation
                               @azure/monitor-opentelemetry-exporter
                               @opentelemetry/sdk-metrics
                               @opentelemetry/sdk-logs
```

- OpenTelemetry の設計上、`@opentelemetry/api` はシングルトンのグローバルレジストリを保持する
- Webpack バンドル版の SDK パッケージは、バンドル内に閉じた独自のモジュールスコープで動作する
- **ネイティブ `require()` の `@opentelemetry/api` と Webpack バンドル版の SDK が参照するレジストリオブジェクトが異なる**
- SDK は「初期化成功」と報告するが、エクスポーターが登録されたレジストリと、HTTP インストルメンテーションが使うレジストリが分離している
- → **テレメトリはどこにも送信されない（サイレント failures）**

### 4.2 standalone ビルドの node_modules 状態

standalone ビルド（`.next/standalone/node_modules`）には必要なパッケージはすべて存在することを確認済み:

| パッケージ | 状態 |
|-----------|------|
| `applicationinsights` (3.13.0) | ✅ OK |
| `@azure/monitor-opentelemetry` | ✅ OK |
| `@azure/monitor-opentelemetry-exporter` | ✅ OK |
| `@opentelemetry/api` | ✅ OK |
| `@opentelemetry/sdk-trace-node` | ✅ OK |
| `@opentelemetry/instrumentation` | ✅ OK |
| `@opentelemetry/instrumentation-http` | ✅ OK |
| `@opentelemetry/sdk-node` | ✅ OK |
| `@opentelemetry/sdk-metrics` | ✅ OK |
| `@opentelemetry/sdk-logs` | ✅ OK |
| `import-in-the-middle` | ✅ OK |
| `require-in-the-middle` | ✅ OK |

パッケージの欠落ではなく、**Webpack バンドリングによるモジュールスコープの分離が原因**。

---

## 5. 修正方針

### 対策: `serverExternalPackages` を拡充

`apps/web/next.config.js` の `serverExternalPackages` に、`applicationinsights` v3 の依存ツリー全体を追加する。これにより、すべての OpenTelemetry パッケージが同一の Node.js `require()` チェーンで読み込まれ、グローバルレジストリが共有される。

```javascript
serverExternalPackages: [
    '@azure/cosmos',
    // Application Insights v3 SDK + 全依存パッケージ
    'applicationinsights',
    '@azure/monitor-opentelemetry',
    '@azure/monitor-opentelemetry-exporter',
    '@azure/opentelemetry-instrumentation-azure-sdk',
    '@opentelemetry/api',
    '@opentelemetry/api-logs',
    '@opentelemetry/core',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-proto',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/instrumentation',
    '@opentelemetry/instrumentation-http',
    '@opentelemetry/otlp-exporter-base',
    '@opentelemetry/resources',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/sdk-trace-node',
    '@opentelemetry/semantic-conventions',
    'diagnostic-channel',
    'diagnostic-channel-publishers',
    'import-in-the-middle',
    'require-in-the-middle',
],
```

### 修正後の検証手順

1. ローカルビルド実行 (`npm run build` in `apps/web`)
2. ビルドエラーがないことを確認
3. デプロイ後、コンテナログで以下を確認:
   - `[AppInsights] SDK initialized (useAzureMonitor v3 API)` が引き続き出力される
   - エクスポートエラーが出力されない
4. Application Insights で以下の KQL を実行して検証:
   ```kql
   requests | take 10
   traces | take 10
   ```
5. リクエストを数回実行し、5分程度待ってからテレメトリの到着を確認

### 追加検討事項

- `instrumentation.ts` に一時的な診断ログ（`DiagConsoleLogger` を `DEBUG` レベルで設定）を追加し、エクスポートパイプラインの動作を確認することも有効
- 修正後も解消しない場合、`applicationinsights` のバンドルを完全に回避するため `instrumentation.ts` での動的 import ではなく、Node.js の `--require` オプションで事前ロードする方法も検討

---

## 6. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `apps/web/next.config.js` | **修正対象**: `serverExternalPackages` |
| `apps/web/instrumentation.ts` | Next.js Instrumentation Hook（SDK 初期化） |
| `apps/web/components/providers/TelemetryProvider.tsx` | クライアント側（現在は無効化済み） |
| `apps/web/app/api/config/telemetry/route.ts` | ブラウザ向け接続文字列 API |
| `.github/workflows/azure-app-service.yml` | CI/CD（IPA 設定削除 + デプロイ） |
| `docs/01_planning/azure_config/07_ApplicationInsights.md` | Application Insights 設定設計書 |
| `docs/03_migration/01_Azure_AppService_Design.md` | App Service 設計書 |

---

## 7. 調査に使用したコマンド・データソース

- `az webapp config appsettings list` — App Service 環境変数一覧
- `az webapp show` — App Service 稼働状態
- `az webapp config show` — サイト構成（スタートアップコマンド等）
- `az webapp log download` — コンテナログ取得
- `az monitor app-insights query` — Application Insights KQL クエリ
- `az monitor diagnostic-settings list` — 診断設定確認
- `az resource show` (Microsoft.Insights/components) — Application Insights 接続文字列確認
- `git log --grep` — Application Insights 関連コミット履歴
- `git diff` — 各修正コミットの差分確認
- standalone ビルドの `node_modules` 内パッケージ存在確認
