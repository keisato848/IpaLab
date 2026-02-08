# App Service 起動失敗 根本原因再調査報告書

**作成日:** 2026-02-07
**対象:** `app-pm-exam-dx-prod` (Azure App Service / Linux / Node.js 20)
**ステータス:** 未解決（PR #84, #85 マージ後も起動不可）

---

## 1. 経緯

| 日時 | 対応 | 結果 |
|------|------|------|
| PR #79 | `appinsights-preload.js` 導入。起動コマンドを `node --require ./appinsights-preload.js server.js` に変更 | 起動失敗開始 |
| PR #84 | コードレスエージェント無効化 (`ApplicationInsightsAgent_EXTENSION_VERSION=disabled` 等) + `WEBSITES_PORT=8080` | 起動失敗継続 |
| PR #85 | `appinsights-preload.js` 削除、`instrumentation.ts` に一本化、起動コマンドを `node server.js` に変更（コード上） | 起動失敗継続 |
| 手動 CLI | `az webapp config set --startup-file` 等を実行 | 起動失敗継続 |

---

## 2. ログ分析結果

### 2.1 Docker ログのパターン（2026-02-06 全再起動共通）

```
Environment Variables for Application Insight's IPA Codeless Configuration exists..
PATH="$PATH:/home/site/wwwroot" node --require ./appinsights-preload.js server.js
[AppInsights Preload] SDK initialized successfully
   ▲ Next.js 15.5.10
 ✓ Starting...
[TypeError: Cannot read properties of undefined (reading 'canonicalBase')]
```

**コンテナは毎回 exit code: 1 で約40秒後にクラッシュし、2〜4分のブロック後に再起動を繰り返す。**

### 2.2 ログから判明した重大事実

| 項目 | ログの値 | コード上の値 | 問題 |
|------|----------|-------------|------|
| **起動コマンド** | `node --require ./appinsights-preload.js server.js` | `node server.js` (PR #85) | **旧コマンドが使われ続けている** |
| **Next.js バージョン** | `15.5.10` | `16.1.5` (PR #80 で更新済み) | **最新コードがデプロイされていない** |
| **AppInsights Preload** | `[AppInsights Preload] SDK initialized successfully` | 削除済み (PR #85) | **削除されたファイルがまだ存在する** |
| **IPA 検出** | `Environment Variables for Application Insight's IPA Codeless Configuration exists..` | `disabled` に設定済み | **Oryx の IPA 検出は disabled 設定に関係なく動作する** |

---

## 3. 根本原因

### 原因 1: Azure App Service の起動コマンドがコードと乖離している（最重要）

Azure App Service の起動コマンド（`az webapp config set --startup-file` または Azure Portal の「スタートアップ コマンド」）は、コードのデプロイとは**独立して管理**される。

PR #79 で設定された `node --require ./appinsights-preload.js server.js` がそのまま残っており、PR #84・#85 のコード変更や `package.json` の `start:standalone` 変更は**一切反映されない**。

**現在の CI/CD ワークフロー (`.github/workflows/azure-app-service.yml`) は `az webapp config appsettings set` のみ実行しており、`az webapp config set --startup-file` を実行していない。**

### 原因 2: Oryx の `node_modules.tar.gz` による依存関係の上書き

ログに以下の出力が毎回確認される:

```
Found tar.gz based node_modules.
Removing existing modules directory from root...
Extracting modules...
```

これは、App Service の `/home/site/wwwroot` に残存する `node_modules.tar.gz`（以前の Oryx リモートビルドで生成されたもの）を Oryx が検出し、**毎回起動時に `/node_modules` に展開している**ことを示す。

この tar.gz には **Next.js 15.5.10** 時点の依存関係が含まれている。Next.js standalone ビルドの内部バンドルが、この古い `node_modules` で上書きされる結果:

- `package.json` 上は Next.js 16.1.5 だが、実行時は 15.5.10 が使用される
- Application Insights SDK のバージョンも古い可能性がある
- standalone ビルドとの依存関係の不整合が発生する

### 原因 3: Application Insights SDK の HTTP モンキーパッチと Next.js の非互換

`canonicalBase` エラーの技術的メカニズム:

1. `--require ./appinsights-preload.js` により、Application Insights SDK が **Node.js の HTTP/HTTPS モジュールをモンキーパッチ**する
2. Next.js standalone サーバー (`server.js`) が起動し、内部設定 (`nextConfig`) を読み込む
3. `nextConfig` には `"amp": {"canonicalBase": ""}` が含まれる（Next.js のデフォルト設定）
4. Application Insights のパッチが **Next.js の内部設定オブジェクトの解決プロセスを破壊**し、`amp` プロパティが `undefined` になる
5. `undefined.canonicalBase` へのアクセスで `TypeError` が発生

**重要:** この問題は `--require` による**事前ロード**で発生する。`instrumentation.ts` による遅延初期化（Next.js の `register()` フック）では、Next.js の内部モジュールが先に初期化されるため、この問題は回避される**可能性がある**。ただし、現在のデプロイには `instrumentation.ts` の変更が反映されていないため未検証。

### 原因 4: CI/CD ワークフローのデプロイパッケージ構造の問題

現在のワークフローのデプロイパッケージ作成手順:

```yaml
cd apps/web/.next/standalone
cp -r apps/web/* .
mkdir -p .next
cp -r apps/web/.next/* .next/ 2>/dev/null || true
# ...
rm -rf apps node_modules 2>/dev/null || true
```

問題点:
- `rm -rf node_modules` はパッケージ内の `node_modules` を削除するが、App Service 上の `/home/site/wwwroot/node_modules.tar.gz` は削除されない
- ZIP デプロイは既存ファイルを**完全には上書きしない**場合がある（古いファイルが残存する）
- 起動コマンド (`--startup-file`) が設定されないため、Oryx のデフォルト動作に依存する

---

## 4. 問題の連鎖（全体像）

```
┌─────────────────────────────────────────────────┐
│  GitHub Actions (azure-app-service.yml)          │
│  ・startup-file を設定していない                  │
│  ・appsettings は deploy 後に設定                 │
│  ・node_modules.tar.gz のクリーンアップなし       │
└────────────────────┬────────────────────────────┘
                     │ ZIP Deploy
                     ▼
┌─────────────────────────────────────────────────┐
│  App Service /home/site/wwwroot                  │
│  ・旧 node_modules.tar.gz が残存                 │
│  ・旧 appinsights-preload.js が残存の可能性       │
│  ・新コードと旧ファイルが混在                     │
└────────────────────┬────────────────────────────┘
                     │ コンテナ起動
                     ▼
┌─────────────────────────────────────────────────┐
│  Oryx ランタイム                                  │
│  1. node_modules.tar.gz 検出 → 古い依存を展開    │
│  2. IPA 環境変数検出（disabled 設定と無関係）     │
│  3. Azure Portal の startup-file で起動           │
│     → node --require ./appinsights-preload.js     │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  Next.js 起動                                    │
│  1. AppInsights SDK が HTTP をモンキーパッチ      │
│  2. Next.js 内部設定の amp が undefined に        │
│  3. canonicalBase アクセスで TypeError            │
│  4. プロセス exit code: 1 でクラッシュ            │
└─────────────────────────────────────────────────┘
```

---

## 5. 対策案

### 対策 A: 即時対応（Azure Portal / CLI での手動操作）

以下を**順番に**実行する必要がある:

**手順 1: App Service を停止**
```
az webapp stop --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod
```

**手順 2: Kudu コンソールまたは SSH で残存ファイルを削除**

Azure Portal → App Service → 開発ツール → 高度なツール (Kudu) → SSH コンソール で:
```bash
# 古い node_modules.tar.gz を削除
rm -f /home/site/wwwroot/node_modules.tar.gz

# 古い appinsights-preload.js を削除（存在する場合）
rm -f /home/site/wwwroot/appinsights-preload.js

# 古い node_modules シンボリックリンクを削除
rm -rf /home/site/wwwroot/node_modules
rm -rf /home/site/wwwroot/_del_node_modules
```

**手順 3: 起動コマンドを正しく設定**
```
az webapp config set --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod --startup-file "node server.js"
```

**手順 4: コードレスエージェント無効化を確認**
```
az webapp config appsettings set --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod --settings ApplicationInsightsAgent_EXTENSION_VERSION=disabled XDT_MicrosoftApplicationInsights_Mode=disabled XDT_MicrosoftApplicationInsights_PreemptSdk=disabled WEBSITES_PORT=8080
```

**手順 5: App Service を起動**
```
az webapp start --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod
```

**手順 6: GitHub Actions で再デプロイ**

main ブランチの最新コード（PR #85 含む）で `workflow_dispatch` を手動トリガーする。

**手順 7: ログを確認**

再起動後、以下を確認:
- `node --require` が含まれて**いない**こと
- `Next.js 16.1.5` が表示されること
- `node_modules.tar.gz` の展開が発生して**いない**こと

### 対策 B: CI/CD ワークフローの恒久対策

ワークフローに以下を追加する:

1. **起動コマンドの設定**を deploy ステップに追加:
```yaml
- name: Configure App Service
  run: |
    az webapp config set \
      --name ${{ env.AZURE_WEBAPP_NAME }} \
      --resource-group rg-pm-exam-dx-prod \
      --startup-file "node server.js"
```

2. **デプロイ前のクリーンアップ**を追加:
```yaml
- name: Clean up stale files on App Service
  run: |
    az webapp ssh --name ${{ env.AZURE_WEBAPP_NAME }} \
      --resource-group rg-pm-exam-dx-prod \
      --command "rm -f /home/site/wwwroot/node_modules.tar.gz && rm -f /home/site/wwwroot/appinsights-preload.js"
```

3. **`WEBSITE_RUN_FROM_PACKAGE=1`** の設定を検討:
   - Oryx のランタイム処理（`node_modules.tar.gz` 展開等）を完全にバイパスする
   - ZIP パッケージを直接読み取り専用でマウントして実行する
   - `/home/site/wwwroot` に残存ファイルが影響しなくなる

### 対策 C: Application Insights の安全な初期化（検証が必要）

`instrumentation.ts` でのSDK初期化が `canonicalBase` エラーを引き起こさないか検証が必要。
もし引き起こす場合は、以下の選択肢がある:

1. **Application Insights SDK を完全に除去**し、サーバーサイドのカスタムテレメトリを諦める
2. **Application Insights の `APPLICATIONINSIGHTS_CONNECTION_STRING` を削除**し、コードレスエージェント・SDK 両方を完全無効化する
3. **`applicationinsights` パッケージのバージョンを変更**し、Next.js との互換性がある版を探す

---

## 6. 優先順位

| 優先度 | 対策 | 理由 |
|--------|------|------|
| **最優先** | 対策 A（手動クリーンアップ + 再デプロイ） | 現在の起動失敗を即時解消するため |
| **高** | 対策 B-1（startup-file の設定をワークフローに追加） | 再発防止のため |
| **高** | 対策 B-3（`WEBSITE_RUN_FROM_PACKAGE=1` の検討） | Oryx の予期しない動作を根本的に排除するため |
| **中** | 対策 C（instrumentation.ts の検証） | SDK 初期化自体の安全性確認 |
| **低** | 対策 B-2（デプロイ前クリーンアップの自動化） | B-3 で代替可能 |

---

## 7. 結論

**起動失敗が解消されない根本原因は、コード変更が App Service の実行環境に正しく反映されていないことにある。**

具体的には:
1. Azure App Service の起動コマンドが旧設定のまま（`node --require ./appinsights-preload.js server.js`）
2. 旧 `node_modules.tar.gz` が残存し、古い依存関係（Next.js 15.5.10 含む）で上書きされている
3. CI/CD ワークフローがこれらの Azure 固有設定・残存ファイルを管理していない

PR #84・#85 のコード変更自体は正しい方向性だが、**Azure App Service のランタイム環境（起動コマンド、Oryx のファイル処理）をコードと同期させる手順が不足していた**。

対策 A の手順でクリーンな状態を作り、対策 B でワークフローを改善することで恒久的に解決できる見込み。
