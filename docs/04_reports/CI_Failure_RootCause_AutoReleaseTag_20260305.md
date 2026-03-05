# CI 失敗 根本原因調査報告書 — Auto Release Tag ワークフロー

**作成日:** 2026-03-05  
**対象ワークフロー:** Auto Release Tag (`auto-release-tag.yml`)  
**失敗コミット:** [`c8bf7c44`](https://github.com/keisato848/IpaLab/commit/c8bf7c44888916b418c4fd2ab91ee1089ce93ded)  
**失敗ランID:** [22740194168](https://github.com/keisato848/IpaLab/actions/runs/22740194168)  
**ステータス:** 根本原因特定済み・修正適用済み

---

## 1. 概要

PR #128「fix: IPA午後問題データの品質改善（解答・解説・テーマ100%達成）」がマージされた際、  
`Auto Release Tag` ワークフローが **failure（ジョブ: cancelled）** で終了した。  
これにより `v0.13.1` のタグ・リリースが自動作成されなかった。

---

## 2. 調査結果

### 2.1 タイムライン

| 時刻 (UTC) | イベント |
|-----------|---------|
| 2026-03-05 22:39:48 | PR #128 が main へマージ |
| 2026-03-05 22:44:50 | `Auto Release Tag` ワークフロー実行 開始 |
| 2026-03-05 22:45:42 | ジョブ `create-release-tag` の if 条件評価 → `true` |
| 2026-03-05 22:45:42 | GitHub Actions ランナー `1000001382` へ割り当て開始 |
| 2026-03-05 22:45:42 | "Waiting for a runner to pick up this job..." |
| 2026-03-05 22:50:43 | （5分経過）依然ランナー待機中 |
| 2026-03-05 22:55:43 | （10分経過）依然ランナー待機中 |
| 2026-03-05 23:00:43 | ジョブがタイムアウト → `cancelled` |
| 2026-03-05 23:00:43 | ワークフロー実行の conclusion = `failure` |

### 2.2 ジョブログ（system.txt 抜粋）

```
2026-03-05T22:45:42.5650000Z Evaluating: (success() && ((github.event.pull_request.merged == true)))
2026-03-05T22:45:42.5650000Z Expanded: (true && (true == true))
2026-03-05T22:45:42.5650000Z Result: true
2026-03-05T22:45:42.5690000Z Job is about to start running on the hosted runner: GitHub Actions 1000001382
2026-03-05T22:45:42.5660000Z Waiting for a runner to pick up this job...
2026-03-05T22:50:43.0120000Z Waiting for a runner to pick up this job...
2026-03-05T22:55:43.3260000Z Waiting for a runner to pick up this job...
```

---

## 3. 根本原因

### 原因 1: GitHub ホステッドランナーの一時的な輻輳（直接原因）

`ubuntu-latest` ランナーが約 15 分間、ジョブをピックアップできなかった。  
GitHub 側のインフラ問題（ランナープール輻輳）であり、コード上のバグではない。  
15 分が経過した時点で GitHub が自動的にジョブを `cancelled` に移行し、  
ワークフロー実行の conclusion が `failure` となった。

### 原因 2: `actions/create-release@v1` の非推奨使用（二次的リスク）

ワークフロー内で使用していた `actions/create-release@v1` は  
GitHub により **deprecated（アーカイブ済み）** のアクションである。  
今回の直接的な失敗原因ではないが、将来的に互換性問題が発生するリスクがある。

---

## 4. 影響

| 項目 | 内容 |
|------|------|
| 未作成リリース | `v0.13.1`（PR #128 は `fix:` プレフィックス → パッチバージョン） |
| リリースノート | 自動生成されず |
| デプロイ | Azure App Service CI/CD は `push` トリガーのため影響なし（正常デプロイ済み） |

---

## 5. 対応策

### 5.1 即時対応（手動リランまたは直接タグ作成）

以下のいずれかで `v0.13.1` を手動作成する:

```bash
# Option A: GitHub Actions の手動再実行
# (workflow_dispatch は auto-release-tag.yml に未設定のため、直接タグ操作を推奨)

# Option B: git コマンドで直接タグ作成
git tag -a v0.13.1 -m "Release v0.13.1

PR #128: fix: IPA午後問題データの品質改善（解答・解説・テーマ100%達成）
https://github.com/keisato848/IpaLab/pull/128"
git push origin v0.13.1
```

### 5.2 恒久対応（ワークフロー修正）

1. **`actions/create-release@v1` を `softprops/action-gh-release@v2` に置き換え**  
   → 本 PR にて修正済み

2. **`workflow_dispatch` トリガーの追加（任意）**  
   → 手動再実行を容易にするためのオプション

---

## 6. 修正内容

`auto-release-tag.yml` の最終ステップ `Create GitHub Release` を  
非推奨の `actions/create-release@v1` から `softprops/action-gh-release@v2` へ変更。

| 変更前 | 変更後 |
|--------|--------|
| `actions/create-release@v1` | `softprops/action-gh-release@v2` |
| GitHub Token: `secrets.GITHUB_TOKEN` (env) | GitHub Token: `secrets.GITHUB_TOKEN` (with) |
| `tag_name`, `release_name`, `body` 対応 | 同等パラメータで対応 |

---

## 7. 再発防止

| リスク | 対策 |
|--------|------|
| ランナー輻輳による再失敗 | `workflow_dispatch` トリガー追加で手動再実行を容易化 |
| 非推奨アクション更新漏れ | Dependabot の GitHub Actions アップデートを有効化（`.github/dependabot.yml`） |
