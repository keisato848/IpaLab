# App Service 起動失敗 調査報告書

- **調査日**: 2026-02-06
- **対象**: `app-pm-exam-dx-prod` (リソースグループ: `rg-pm-exam-dx-prod`)
- **ステータス**: コンテナが起動直後にクラッシュし、無限再起動ループに陥っている

---

## 1. 障害の概要

App Service `app-pm-exam-dx-prod` が起動に失敗し、コンテナが繰り返しクラッシュしている。
Azure App Service はコンテナの再起動を試みるが、毎回 exit code 1 で終了し、2〜4分間のブロック期間を経て再試行を繰り返している。

**現在の動作パターン:**
1. コンテナ起動 → Next.js が起動開始
2. `✓ Starting...` 表示の約0.5秒後にクラッシュ
3. exit code 1 で終了 → 2〜4分間ブロック → 再起動 → 同じエラー

---

## 2. 根本原因

### 直接原因: Next.js 内部エラー `canonicalBase`

```
[TypeError: Cannot read properties of undefined (reading 'canonicalBase')]
```

Next.js 15.5.10 の standalone サーバー起動直後に、内部設定オブジェクトの `canonicalBase` プロパティ読み取り時に TypeError が発生し、プロセスがクラッシュしている。

### 推定原因: Application Insights の二重初期化による競合

以下の2つの Application Insights 初期化が同時に動作しており、Next.js 内部の HTTP モジュールやサーバー設定を破壊している可能性が高い:

| 初期化方式 | 設定場所 | 動作 |
|---|---|---|
| **Azure Codeless Agent (拡張機能)** | `ApplicationInsightsAgent_EXTENSION_VERSION: ~3` | Node.js プロセス起動前に自動でHTTPモジュールをモンキーパッチ |
| **手動 Preload スクリプト** | `node --require ./appinsights-preload.js server.js` | `applicationinsights` SDK を明示的に初期化 |

Azure のコードレスエージェント (`~3`) は `XDT_MicrosoftApplicationInsights_Mode: recommended` と組み合わせることで、Node.js の HTTP/HTTPS モジュールを自動計測のためにパッチする。
同時に preload スクリプトも `applicationinsights` SDK を `setup().start()` で初期化するため、**二重のインストルメンテーション**が発生する。

Next.js 15.x の standalone モードでは、`required-server-files.json` から設定を読み込んで内部サーバーを構築するが、HTTP モジュールが事前にパッチされた状態だと設定オブジェクトの構造が壊れ、`canonicalBase` が `undefined` になる。

---

## 3. 障害タイムライン

### 2026-02-04 (最初のデプロイ試行)

| 時刻 (UTC) | イベント | エラー |
|---|---|---|
| 10:03 | コンテナ起動 (`node server.js`, AppInsightsなし) | `Could not find a production build in the './.next' directory` |
| 10:25〜12:00 | 複数回のデプロイ試行 | `.next` ディレクトリ構造の問題 |

### 2026-02-05 (修正試行)

| 時刻 (UTC) | イベント | エラー |
|---|---|---|
| 14:08 | PR #83 マージ後のデプロイ | `Cannot find module './appinsights-preload.js'` |
| 22:27 | 修正デプロイ: `appinsights-preload.js をデプロイパッケージに含める` | - |
| 22:32 | 起動試行 | AppInsights SDK 初期化成功 → `canonicalBase` エラー |
| 22:37 | 修正デプロイ: `appinsights-preload.js のコピーパスを修正` | - |
| 22:43 | 起動試行 | 同じ `canonicalBase` エラー |
| 22:49 | 修正デプロイ: `Application Insights SDK の互換性問題を修正` | - |
| 22:51 | 起動試行 | 同じ `canonicalBase` エラー |
| 22:58 | 手動 Stop/Start | - |
| 23:32 | コンテナタイムアウト → ブロック開始 | `Container did not start within expected time limit of 230s` |

### 2026-02-06 (クラッシュループ継続中)

| 時刻 (UTC) | イベント |
|---|---|
| 00:04 | 起動 → クラッシュ (exit code 1, 42秒後) → 2分ブロック |
| 00:39 | 起動 → クラッシュ (exit code 1, 38秒後) → 2分ブロック |
| 00:56 | 起動 → クラッシュ (exit code 1, 40秒後) → 2分ブロック |
| 01:07 | 起動 → クラッシュ (exit code 1, 61秒後) → 2分ブロック |
| 01:39 | 起動 → クラッシュ (exit code 1, 39秒後) → 2分ブロック |
| 01:41 | **ブロック中に起動試行 → 拒否** (`Start site prohibited because the site is being blocked`) |
| 02:14 | 起動 → クラッシュ → **4分ブロック** (ブロック期間が延長) |
| 02:23 | 起動 → クラッシュ → 4分ブロック |
| 02:35 | 起動 → クラッシュ → 4分ブロック |
| 02:54 | 起動 → クラッシュ → 4分ブロック |
| 03:03 | 起動 → クラッシュ (最新ログ) |

---

## 4. コンテナログ詳細 (典型的な起動シーケンス)

```
[AppInsights Preload] SDK initialized successfully    ← preload は正常
   ▲ Next.js 15.5.10
   - Local:        http://<container>:8080
   - Network:      http://<container>:8080

 ✓ Starting...
[TypeError: Cannot read properties of undefined (reading 'canonicalBase')]
                                                       ← 起動0.5秒後にクラッシュ
```

- AppInsights の preload スクリプトは正常に動作
- Next.js は起動を試みるが、内部設定の読み込み段階でクラッシュ
- ポート 8080 でリッスンを開始する前にプロセスが終了

---

## 5. 環境構成

### App Service 設定

| 項目 | 値 |
|---|---|
| ランタイム | Node.js 20 LTS (v20.20.0) |
| OS | Linux |
| SKU | B1 Basic |
| リージョン | East Asia |
| スタートアップコマンド | `node --require ./appinsights-preload.js server.js` |
| WEBSITES_PORT | 3000 |

### Application Insights 関連の設定値

| 設定名 | 値 | 備考 |
|---|---|---|
| `ApplicationInsightsAgent_EXTENSION_VERSION` | `~3` | **コードレスエージェント有効** |
| `XDT_MicrosoftApplicationInsights_Mode` | `recommended` | 全自動計測モード |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | (設定済) | SDK 用接続文字列 |
| `APPINSIGHTS_CONNECTIONSTRING` | (設定済) | 拡張機能用（重複あり） |
| `InstrumentationEngine_EXTENSION_VERSION` | `disabled` | - |

### GitHub Actions デプロイ状況

| 実行日時 | ワークフロー | 結果 |
|---|---|---|
| 2026-02-05 22:49 | Azure App Service CI/CD | **Success** |
| 2026-02-05 22:37 | Azure App Service CI/CD | **Success** |
| 2026-02-05 22:27 | Azure App Service CI/CD | **Success** |

デプロイ自体は全て成功している（OneDeploy, status: Success）。

---

## 6. 推奨対応策

### 対策1: Application Insights コードレスエージェントの無効化 (最優先)

手動 preload スクリプトとコードレスエージェントの競合を解消する。

```bash
az webapp config appsettings set \
  --name app-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --settings \
    ApplicationInsightsAgent_EXTENSION_VERSION=disabled \
    XDT_MicrosoftApplicationInsights_Mode=disabled \
    XDT_MicrosoftApplicationInsights_PreemptSdk=disabled
```

preload スクリプトが SDK を正しく初期化しているため、コードレスエージェントは不要。

### 対策2: WEBSITES_PORT の不整合修正

App Service 設定では `WEBSITES_PORT=3000` だが、コンテナログではポート `8080` でリッスンしている。
Next.js standalone の `server.js` は PORT 環境変数を使用し、Oryx のスタートアップスクリプトが `PORT=8080` を設定する。

`WEBSITES_PORT` を `8080` に修正するか、削除してデフォルト動作に任せる:

```bash
az webapp config appsettings set \
  --name app-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --settings WEBSITES_PORT=8080
```

### 対策3: Application Insights 拡張の接続文字列の重複解消

現在 `APPINSIGHTS_CONNECTIONSTRING` と `APPLICATIONINSIGHTS_CONNECTION_STRING` の2つが設定されている。
コードレスエージェントを無効化する場合、以下を削除可能:

- `APPINSIGHTS_INSTRUMENTATIONKEY` (slot setting)
- `APPINSIGHTS_CONNECTIONSTRING`
- `APPINSIGHTS_PROFILERFEATURE_VERSION`
- `APPINSIGHTS_SNAPSHOTFEATURE_VERSION`
- `DiagnosticServices_EXTENSION_VERSION`
- `SnapshotDebugger_EXTENSION_VERSION`

### 対策4: (もし対策1で解消しない場合) preload スクリプトの除去

コードレスエージェント無効化でも解決しない場合、preload スクリプト自体が Next.js と競合している可能性がある。
スタートアップコマンドを以下に変更して検証:

```
node server.js
```

Application Insights は `instrumentation.ts` (Next.js のネイティブ計装)経由での初期化を検討する。

---

## 7. 補足情報

### バージョン不整合

| 場所 | Next.js バージョン |
|---|---|
| `apps/web/package.json` (ローカル) | `16.1.5` |
| デプロイ済みコンテナ | `15.5.10` |

ローカルのpackage.jsonでは Next.js 16.1.5 だが、デプロイされているのは 15.5.10。
直近のデプロイ後にローカルでバージョンアップが行われた可能性がある。
バージョン不整合自体は現在の `canonicalBase` エラーの直接原因ではないが、
次回デプロイ時にバージョン変更による追加の問題が発生する可能性がある。

### アクティビティログの Sync 失敗

```
"Repository does not exist for site app-pm-exam-dx-prod."
```

2026-02-05T22:47 に `Sync Web Apps` 操作が失敗している。
これは SCM サイト（Kudu）のリポジトリ同期エラーで、直接的にはアプリの起動失敗とは無関係だが、
デプロイ方式が OneDeploy (ZIP Deploy) のため、Git ベースの同期は不要。

---

## 8. 調査に使用したコマンド・データソース

- `az webapp show` - App Service 基本情報
- `az webapp config appsettings list` - アプリケーション設定
- `az webapp log download` - コンテナログ・デプロイログのダウンロード
- `az monitor activity-log list` - Azure アクティビティログ
- `gh run list` - GitHub Actions 実行履歴
- Docker ログファイル (`2026_02_06_*_default_docker.log`, `*_docker.log`)
- デプロイログ (`deployments/8fee4ba8-*/log.log`, `status.xml`)
