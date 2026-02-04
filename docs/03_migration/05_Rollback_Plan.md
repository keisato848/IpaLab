# ロールバック計画

## 1. 概要

移行中または移行後に問題が発生した場合のロールバック手順を定義する。

## 2. ロールバックシナリオ

| シナリオ | 重大度 | 対応 |
|---------|--------|------|
| デプロイ失敗 | 低 | GitHub Actions 再実行 |
| アプリ起動失敗 | 中 | 前回デプロイに戻す |
| 機能障害 | 中 | コード修正 or 前回デプロイに戻す |
| 完全障害 | 高 | SWA への完全ロールバック |

## 3. レベル 1: デプロイ再実行

### 3.1 適用シナリオ

- GitHub Actions の一時的なエラー
- ネットワーク接続の問題
- Azure サービスの一時的な障害

### 3.2 手順

```bash
# 失敗したワークフローを再実行
gh run rerun <run-id> --failed

# または GitHub UI から
# Actions > 失敗したワークフロー > Re-run jobs
```

### 3.3 所要時間

約 5-10 分

## 4. レベル 2: 前回デプロイに戻す

### 4.1 適用シナリオ

- 新しいコードにバグがある
- アプリケーションが起動しない
- 重大な機能障害

### 4.2 方法 A: Azure Portal から

1. Azure Portal > App Service > `app-pm-exam-dx-prod`
2. 左メニュー「デプロイセンター」
3. デプロイ履歴から前回のデプロイを選択
4. 「再デプロイ」をクリック

### 4.3 方法 B: Azure CLI から

```bash
# デプロイ履歴を確認
az webapp deployment list --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod

# 特定のデプロイに戻す
az webapp deployment source sync --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod
```

### 4.4 方法 C: Git revert

```bash
# 問題のコミットを特定
git log --oneline -10

# コミットを revert
git revert <commit-hash>
git push origin main

# 自動デプロイを待つ
```

### 4.5 所要時間

約 10-15 分

## 5. レベル 3: SWA への完全ロールバック

### 5.1 適用シナリオ

- App Service で解決不能な問題が発生
- 移行自体が失敗と判断
- 緊急で旧環境に戻す必要がある

### 5.2 前提条件

- SWA リソースが削除されていないこと
- `azure-static-web-apps.yml` が保持されていること
- SWA の環境変数が設定されていること

### 5.3 手順

#### Step 1: App Service を停止

```bash
az webapp stop --name app-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod
```

#### Step 2: SWA ワークフローを再有効化

```bash
# azure-static-web-apps.yml を復元（バックアップから）
git checkout main -- .github/workflows/azure-static-web-apps.yml

# または新規作成
# 内容は既存のワークフローと同じ
```

#### Step 3: main ブランチにプッシュ

```bash
git add .github/workflows/azure-static-web-apps.yml
git commit -m "fix: SWA ワークフローを復元（ロールバック）"
git push origin main
```

#### Step 4: SWA デプロイを確認

```bash
# GitHub Actions でデプロイ状況を確認
gh run list --workflow=azure-static-web-apps.yml
```

#### Step 5: DNS を SWA に戻す（カスタムドメイン使用時）

1. DNS プロバイダーで CNAME レコードを変更
2. `shikaku-no.com` → `swa-pm-exam-dx-prod.azurestaticapps.net`
3. DNS 伝播を待つ（最大 24 時間）

#### Step 6: 動作確認

```bash
curl -I https://shikaku-no.com/
# または
curl -I https://swa-pm-exam-dx-prod.azurestaticapps.net/
```

### 5.4 所要時間

約 30-60 分（DNS 伝播を除く）

## 6. ロールバック判断基準

### 6.1 即時ロールバック（レベル 3）

以下の場合は即座に SWA へロールバック:

- [ ] 本番環境が完全にダウン
- [ ] 認証機能が完全に動作しない
- [ ] データ破損の可能性がある
- [ ] 復旧の見込みが立たない（1時間以上）

### 6.2 段階的対応（レベル 1-2）

以下の場合は段階的に対応:

- [ ] 特定の機能のみ障害
- [ ] パフォーマンス低下
- [ ] 軽微な表示崩れ

## 7. 連絡体制

### 7.1 障害発生時の連絡

| 重大度 | 連絡先 | 方法 |
|--------|--------|------|
| 高 | プロジェクト責任者 | 電話 + メール |
| 中 | 開発チーム | Slack + メール |
| 低 | 開発チーム | Slack |

### 7.2 ロールバック実行の承認

- レベル 1-2: 開発者判断で実行可
- レベル 3: プロジェクト責任者の承認必要

## 8. バックアップ確認

### 8.1 ロールバック前の確認事項

- [ ] SWA リソースが存在する
- [ ] SWA の環境変数が設定されている
- [ ] `azure-static-web-apps.yml` のバックアップがある
- [ ] Cosmos DB のデータは影響を受けない

### 8.2 バックアップファイル

```
docs/03_migration/backup/
├── azure-static-web-apps.yml.bak    # SWA ワークフロー
├── next.config.js.bak               # SWA 用 next.config
└── swa-env-vars.json                # SWA 環境変数一覧
```

## 9. ロールバック後の対応

### 9.1 原因分析

1. ログ収集
   - GitHub Actions ログ
   - App Service ログ
   - Application Insights ログ

2. 原因特定
   - コードの問題
   - 設定の問題
   - インフラの問題

3. 再発防止策の策定

### 9.2 再移行計画

1. 原因修正
2. テスト環境での検証
3. 段階的な再移行

## 10. 移行後のクリーンアップ

### 10.1 移行成功時（2週間後）

```bash
# SWA リソースを削除
az staticwebapp delete --name swa-pm-exam-dx-prod --resource-group rg-pm-exam-dx-prod

# GitHub Secrets を削除
# AZURE_STATIC_WEB_APPS_API_TOKEN

# 旧ワークフローを削除
rm .github/workflows/azure-static-web-apps.yml
```

### 10.2 削除前の最終確認

- [ ] App Service が安定稼働している（2週間以上）
- [ ] Application Insights にログが出力されている
- [ ] ユーザーからの問題報告がない
- [ ] プロジェクト責任者の承認を得た

---

**作成日**: 2026-02-04
**更新日**: 2026-02-04
**ステータス**: 設計完了
