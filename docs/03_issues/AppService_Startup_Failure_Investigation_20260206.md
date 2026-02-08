# App Service 起動障害 調査報告書

| 項目 | 内容 |
|------|------|
| 調査日 | 2026-02-06 |
| 対象リソース | `app-pm-exam-dx-prod` (East Asia) |
| リソースグループ | `rg-pm-exam-dx-prod` |
| 障害発生日時 | 2026-02-05 22:15 (JST) 頃～ 継続中 |
| 影響 | アプリケーションが起動不可。全ユーザーがアクセス不能 |
| 重要度 | **Critical** |

---

## 1. 障害概要

Azure App Service `app-pm-exam-dx-prod` 上の Next.js アプリケーションが起動に失敗し、コンテナが 230 秒のタイムアウトで繰り返し再起動されている。アプリケーションは一度も「Ready」状態に到達しておらず、全リクエストがエラーとなっている。

---

## 2. 根本原因

### 主因: Next.js メジャーバージョンアップによるランタイム不整合

Dependabot による PR #80 (`878e167`) で **Next.js が 15.5.10 → 16.1.5 にメジャーバージョンアップ** されたことが根本原因である。

#### 発生メカニズム

```
[CI/CD ビルド環境]                    [App Service ランタイム]
Next.js 16.1.5 (Turbopack) でビルド → node_modules.tar.gz は旧版 15.5.10 を含む
       ↓                                      ↓
server.js は 16.1.5 の構造で生成     → Oryx が旧 node_modules.tar.gz を展開
       ↓                                      ↓
16.1.5 の設定構造を期待              → 15.5.10 のモジュールが読み込まれる
       ↓
TypeError: Cannot read properties of undefined (reading 'canonicalBase')
```

**CI ビルドログの証拠:**
```
▲ Next.js 16.1.5 (Turbopack)   ← ビルドは 16.1.5
```

**App Service ランタイムログの証拠:**
```
▲ Next.js 15.5.10               ← ランタイムは 15.5.10
✓ Starting...
[TypeError: Cannot read properties of undefined (reading 'canonicalBase')]
```

#### 不整合の原因

1. **`node_modules.tar.gz` の残存**: App Service の `/home/site/wwwroot/` に以前のデプロイで生成された `node_modules.tar.gz` (Next.js 15.5.10 を含む) が残存
2. **デプロイスクリプトでの `node_modules` 削除**: CI/CD ワークフローの `rm -rf apps node_modules` で standalone ビルドの `node_modules` が削除される
3. **Oryx の動作**: App Service の起動時、Oryx が `node_modules.tar.gz` を検出・展開し、シンボリックリンクを作成。これにより旧バージョンのモジュールがロードされる

#### 追加の互換性リスク

| 項目 | 現行 | Next.js 16 要件 |
|------|------|----------------|
| React | 18.3.1 | 19.x (推定) |
| React DOM | 18.3.1 | 19.x (推定) |

Next.js 16 はメジャーバージョンアップであり、React 19 を要求する可能性が高い。現在の React 18.3.1 との互換性は未検証。

---

## 3. 障害タイムライン

| 日時 (UTC) | イベント | 状態 |
|------------|---------|------|
| 2/4 12:01 | 起動コマンド `node server.js` で正常起動 | **正常** (`✓ Ready in 931ms`) |
| 2/4 12:50 | アプリケーション正常動作中 (リクエスト処理確認) | **正常** |
| 2/5 12:56 | PR #80 マージ: Next.js 15.5.10 → 16.1.5 | - |
| 2/5 13:15 | PR #83 マージ: AppInsights SDK 統合 | - |
| 2/5 14:09 | `Error: Cannot find module './appinsights-preload.js'` | **障害** |
| 2/5 22:27 | fix: appinsights-preload.js をデプロイパッケージに含める | デプロイ |
| 2/5 22:37 | fix: appinsights-preload.js のコピーパスを修正 | デプロイ |
| 2/5 22:46 | AppInsights SDK 初期化エラー + `canonicalBase` エラー | **障害** |
| 2/5 22:49 | fix: Application Insights SDK の互換性問題を修正 | デプロイ |
| 2/5 22:59 | AppInsights 正常初期化、 `canonicalBase` エラー継続 | **障害** |
| 2/6 02:35 | `ContainerTimeout` (230s) でコンテナ停止・ブロック | **障害** |
| 2/6 03:25 | 再起動後も同一エラーで起動失敗 | **障害** (継続中) |

---

## 4. 検出されたエラー詳細

### 4.1 致命的エラー: `canonicalBase` TypeError (CRITICAL)

```
[TypeError: Cannot read properties of undefined (reading 'canonicalBase')]
```

- **発生箇所**: Next.js サーバー初期化時 (`✓ Starting...` 直後)
- **影響**: アプリケーションが「Ready」状態に到達できない
- **結果**: コンテナが 230 秒のタイムアウトで停止 → 2分間のブロック → 再起動の無限ループ

### 4.2 解決済みエラー: Application Insights SDK 互換性

```
[AppInsights Preload] Failed to initialize SDK: TypeError: appInsights.setup(...)
  .setAutoCollectRequests(...)
  .setAutoCollectPerformance(...)
  .setAutoCollectExceptions(...)
  .setAutoCollectDependencies(...)
  .setAutoCollectConsole(...)
  .setAutoCollectPreAggregatedMetrics is not a function
```

- **状態**: commit `63fe36b` で**修正済み**
- **原因**: Azure App Service のプリインストール版 `applicationinsights` SDK に `setAutoCollectPreAggregatedMetrics()` メソッドが存在しない

### 4.3 以前のエラー: appinsights-preload.js 不在

```
Error: Cannot find module './appinsights-preload.js'
```

- **状態**: commit `ae318aa` で**修正済み**
- **原因**: デプロイパッケージに `appinsights-preload.js` が含まれていなかった

---

## 5. 現在の App Service 状態

```
状態:         Running (ただし起動ループ中)
SKU:          B1 (Basic)
OS:           Linux
Node.js:      v20.20.0
Always On:    有効
起動コマンド:  node --require ./appinsights-preload.js server.js
```

### 起動ループの挙動

```
コンテナ起動 → Next.js 15.5.10 表示 → canonicalBase エラー
→ 230秒タイムアウト → コンテナ停止 → 2分ブロック → 再起動
(無限ループ)
```

---

## 6. 関連設定の問題点

### 6.1 `next.config.js`

```js
serverExternalPackages: [
    '@azure/cosmos',
    'applicationinsights',
],
```

- `serverExternalPackages` はスタンドアロンビルドで外部パッケージとして扱われる
- デプロイスクリプトが `node_modules` を削除するため、これらのパッケージがランタイムで見つからない可能性がある

### 6.2 デプロイワークフロー (`.github/workflows/azure-app-service.yml`)

```bash
# 問題のある行
rm -rf apps node_modules 2>/dev/null || true
```

- standalone ビルドの `node_modules` (必要最低限の依存関係を含む) を削除している
- App Service の Oryx が `node_modules.tar.gz` から旧バージョンのモジュールを展開してしまう

### 6.3 バージョン不整合

| ファイル | Next.js バージョン |
|---------|-------------------|
| `apps/web/package.json` | 16.1.5 |
| `package-lock.json` (resolved) | 16.1.5 |
| CI ビルド出力 | 16.1.5 (Turbopack) |
| App Service ランタイム | **15.5.10** (不整合!) |

---

## 7. 推奨対応策

### 対応策 A: Next.js バージョンを 15.5.10 にロールバック (推奨・即効性あり)

Next.js 15 → 16 はメジャーバージョンアップであり、React のバージョン要件や API 変更を伴う。安定稼働のためロールバックを推奨。

1. `apps/web/package.json` と `package.json` の `next` バージョンを `"15.5.10"` に戻す
2. `npm install` で `package-lock.json` を更新
3. App Service 上の古い `node_modules.tar.gz` を削除
   ```bash
   az webapp ssh --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod
   # SSH内で:
   rm -f /home/site/wwwroot/node_modules.tar.gz
   ```
4. 再デプロイ

### 対応策 B: Next.js 16.1.5 を正式に採用する場合

1. React を 19.x にアップグレード
2. Next.js 16 のマイグレーションガイドに従い全変更を適用
3. デプロイスクリプトの `rm -rf node_modules` を削除し、standalone の `node_modules` を保持
4. App Service 上の古い `node_modules.tar.gz` を削除
5. 十分なテストを実施してから再デプロイ

### 対応策 C: デプロイスクリプトの修正 (どちらの場合でも必要)

```yaml
# 修正: node_modules を削除しない
rm -rf apps 2>/dev/null || true
# rm -rf node_modules は削除
```

または、App Service の `SCM_DO_BUILD_DURING_DEPLOYMENT=false` を設定し、Oryx ビルドを無効化して `node_modules.tar.gz` の展開を防止する。

```bash
az webapp config appsettings set \
  --name app-pm-exam-dx-prod \
  --resource-group rg-pm-exam-dx-prod \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

---

## 8. 再発防止策

1. **Dependabot のメジャーバージョンアップを制限**: `.github/dependabot.yml` で `ignore` ルールを追加し、Next.js のメジャーバップを自動マージしない
2. **ヘルスチェックパスの設定**: App Service に `healthCheckPath` を設定し、起動失敗を早期検知
   ```bash
   az webapp config set --name app-pm-exam-dx-prod \
     --resource-group rg-pm-exam-dx-prod \
     --generic-configurations '{"healthCheckPath":"/api/health"}'
   ```
3. **アプリケーションログの有効化**: 現在 `fileSystem.level: Off` のため、アプリケーションログが記録されていない
   ```bash
   az webapp log config --name app-pm-exam-dx-prod \
     --resource-group rg-pm-exam-dx-prod \
     --application-logging filesystem --level warning
   ```
4. **staged deployment (ステージングスロット)**: 本番デプロイ前にスロットでの動作確認を実施

---

## 9. 調査方法・使用コマンド

```bash
# App Service 状態確認
az webapp show --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod

# サイト設定確認
az webapp config show --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod

# アプリケーション設定確認
az webapp config appsettings list --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod

# ログダウンロード
az webapp log download --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod

# アクティビティログ確認
az monitor activity-log list --resource-group rg-pm-exam-dx-prod --offset 7d

# GitHub Actions 確認
gh run list --repo keisato848/IpaLab --limit 10
gh run view <run-id> --log
```
