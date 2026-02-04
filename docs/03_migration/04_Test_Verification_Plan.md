# テスト・検証計画

## 1. 概要

Azure App Service への移行に伴う検証項目と手順を定義する。

## 2. テストフェーズ

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: ローカル検証                                    │
│  - standalone ビルド                                      │
│  - ローカル起動                                           │
│  - Application Insights SDK 初期化                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 2: CI/CD 検証                                      │
│  - GitHub Actions ビルド成功                              │
│  - アーティファクト生成                                    │
│  - App Service へのデプロイ                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 3: 機能検証 (ステージング)                          │
│  - ページ表示                                             │
│  - 認証フロー (GitHub, Google)                            │
│  - API Route 動作                                         │
│  - Cosmos DB 接続                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 4: 監視検証                                        │
│  - Application Insights ログ出力 ★ 最重要                 │
│  - エラー追跡                                             │
│  - パフォーマンスメトリクス                                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 5: 本番移行検証                                    │
│  - カスタムドメイン                                        │
│  - SSL 証明書                                             │
│  - DNS 切り替え                                           │
└─────────────────────────────────────────────────────────┘
```

## 3. Phase 1: ローカル検証

### 3.1 standalone ビルド検証

```bash
# apps/web ディレクトリで実行
cd apps/web

# ビルド実行
npm run build

# standalone 出力を確認
ls -la .next/standalone/

# 期待される出力:
# - apps/web/server.js
# - packages/
# - node_modules/
```

**検証項目:**
- [ ] ビルドがエラーなく完了する
- [ ] `.next/standalone/apps/web/server.js` が生成される
- [ ] `packages/shared` などの依存パッケージが含まれる

### 3.2 ローカル起動検証

```bash
# 静的ファイルをコピー
cp -r public .next/standalone/apps/web/
cp -r .next/static .next/standalone/apps/web/.next/

# standalone モードで起動
cd .next/standalone
PORT=3000 node apps/web/server.js
```

**検証項目:**
- [ ] サーバーが起動する
- [ ] `http://localhost:3000` でページが表示される
- [ ] 静的ファイル (CSS, JS, 画像) が正しく読み込まれる

### 3.3 Application Insights SDK 検証

```bash
# 環境変数を設定して起動
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=xxx" \
PORT=3000 node apps/web/server.js
```

**検証項目:**
- [ ] コンソールに `[System] Application Insights SDK initialized` が表示される
- [ ] エラーが発生しない

## 4. Phase 2: CI/CD 検証

### 4.1 PR ビルド検証

1. フィーチャーブランチを作成
2. ソースコード変更をプッシュ
3. PR を作成

**検証項目:**
- [ ] `pr-check` ジョブが実行される
- [ ] ビルドが成功する
- [ ] テストが成功する

### 4.2 デプロイ検証

1. PR を main にマージ
2. デプロイワークフローを監視

**検証項目:**
- [ ] `build` ジョブが成功する
- [ ] アーティファクトがアップロードされる
- [ ] `deploy` ジョブが成功する
- [ ] Azure Portal でデプロイが確認できる

### 4.3 ワークフローログ確認

```bash
# GitHub CLI でワークフロー確認
gh run list --limit 5
gh run view <run-id> --log
```

## 5. Phase 3: 機能検証 (ステージング)

### 5.1 基本ページ表示

| URL | 期待結果 |
|-----|---------|
| `/` | ホームページが表示される |
| `/exams` | 試験一覧ページが表示される |
| `/dashboard` | ダッシュボード（要認証） |

**検証手順:**
```bash
# cURL でレスポンスコード確認
curl -I https://app-pm-exam-dx-prod.azurewebsites.net/
# 期待: HTTP/2 200
```

### 5.2 認証フロー検証

#### GitHub OAuth

1. `/api/auth/signin` にアクセス
2. 「GitHub でログイン」を選択
3. GitHub 認証ページにリダイレクト
4. 認証後、アプリにリダイレクト
5. セッションが確立される

**検証項目:**
- [ ] リダイレクト URI が正しい
- [ ] 認証後にエラーが発生しない
- [ ] ユーザー情報が取得できる

#### Google OAuth

同様の手順で Google 認証を検証。

**事前準備:**
- Google Cloud Console でリダイレクト URI を追加:
  - `https://app-pm-exam-dx-prod.azurewebsites.net/api/auth/callback/google`

### 5.3 API Route 検証

| エンドポイント | メソッド | 期待結果 |
|---------------|---------|---------|
| `/api/auth/session` | GET | セッション情報 |
| `/api/exams` | GET | 試験一覧 |
| `/api/progress` | GET | 学習進捗 |

**検証手順:**
```bash
# API レスポンス確認
curl https://app-pm-exam-dx-prod.azurewebsites.net/api/exams
```

### 5.4 Cosmos DB 接続検証

1. 学習履歴の保存操作
2. データベースへの書き込み確認
3. データの読み取り確認

**検証項目:**
- [ ] Cosmos DB への接続が成功する
- [ ] データの読み書きが正常に動作する
- [ ] エラーが Application Insights に記録される

## 6. Phase 4: 監視検証 ★ 最重要

### 6.1 コードレス監視の確認

1. Azure Portal > App Service > Application Insights
2. 「オン」になっていることを確認
3. 接続されている Application Insights リソースを確認

### 6.2 ログ出力検証

#### テスト手順

1. アプリケーションにアクセス（数回）
2. 意図的にエラーを発生させる（存在しない URL にアクセス）
3. Azure Portal > Application Insights > ログ を開く

#### 検証クエリ

```kusto
// リクエストログの確認
requests
| where timestamp > ago(1h)
| project timestamp, name, resultCode, duration, url
| order by timestamp desc
| take 20

// 例外ログの確認
exceptions
| where timestamp > ago(1h)
| project timestamp, type, message, outerMessage
| order by timestamp desc
| take 20

// カスタムログの確認
traces
| where timestamp > ago(1h)
| where message contains "[System]"
| project timestamp, message
| order by timestamp desc
| take 20
```

**検証項目:**
- [ ] `requests` テーブルに HTTP リクエストが記録される
- [ ] `exceptions` テーブルにエラーが記録される
- [ ] `traces` テーブルにカスタムログが記録される
- [ ] パフォーマンスメトリクスが収集される

### 6.3 Live Metrics の確認

1. Azure Portal > Application Insights > Live Metrics
2. リアルタイムでリクエストが表示されることを確認

### 6.4 アラート動作確認

1. 意図的にサーバーエラー (500) を発生させる
2. アラートがトリガーされることを確認
3. 通知メールが届くことを確認

## 7. Phase 5: 本番移行検証

### 7.1 カスタムドメイン設定

1. Azure Portal > App Service > カスタムドメイン
2. `shikaku-no.com` を追加
3. DNS 検証

### 7.2 SSL 証明書設定

1. App Service マネージド証明書を作成
2. カスタムドメインにバインド
3. HTTPS でアクセス確認

### 7.3 DNS 切り替え

**切り替え前:**
```
shikaku-no.com → swa-pm-exam-dx-prod (SWA)
```

**切り替え後:**
```
shikaku-no.com → app-pm-exam-dx-prod.azurewebsites.net (App Service)
```

**検証手順:**
```bash
# DNS 伝播確認
nslookup shikaku-no.com
dig shikaku-no.com

# HTTPS アクセス確認
curl -I https://shikaku-no.com/
```

## 8. 回帰テスト

### 8.1 自動テスト

```bash
# 既存の単体テスト実行
npm run test:run --workspace=web
```

### 8.2 手動テスト

| 機能 | テスト内容 | 結果 |
|------|-----------|------|
| ログイン | GitHub OAuth | ☐ |
| ログイン | Google OAuth | ☐ |
| 試験一覧 | ページ表示 | ☐ |
| 試験詳細 | 問題表示 | ☐ |
| 解答 | 解答保存 | ☐ |
| 履歴 | 学習履歴表示 | ☐ |
| AI 解説 | 解説生成 | ☐ |

## 9. パフォーマンステスト

### 9.1 コールドスタート時間

```bash
# App Service を再起動
az webapp restart --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod

# 起動時間を計測
time curl https://app-pm-exam-dx-prod.azurewebsites.net/
```

**許容基準:** 10秒以内

### 9.2 レスポンス時間

```bash
# 複数回アクセスして平均を計測
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://app-pm-exam-dx-prod.azurewebsites.net/
done
```

**許容基準:** 平均 2秒以内

## 10. ロールバックテスト

### 10.1 手順確認

1. デプロイ失敗をシミュレート
2. 前回デプロイへのロールバック
3. アプリケーション動作確認

### 10.2 SWA への完全ロールバック

緊急時のみ:
1. `azure-static-web-apps.yml` を再有効化
2. main にプッシュ
3. App Service を停止
4. DNS を SWA に戻す

## 11. 完了基準

### 必須項目

- [x] ローカルビルドが成功する
- [ ] CI/CD デプロイが成功する
- [ ] 全ページが正常に表示される
- [ ] 認証フローが動作する
- [ ] **Application Insights にログが出力される** ★
- [ ] カスタムドメインでアクセスできる

### 推奨項目

- [ ] コールドスタート 10秒以内
- [ ] レスポンス時間 2秒以内
- [ ] エラーアラートが動作する

---

**作成日**: 2026-02-04
**更新日**: 2026-02-04
**ステータス**: 設計完了
