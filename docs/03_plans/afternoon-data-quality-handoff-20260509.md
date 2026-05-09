# 午後データ品質改善 引継ぎ資料 2026-05-09

## 目的

PR #261 `fix: 全区分午後データ品質を改善` の作業を、別端末または後続エージェントへ安全に引き継ぐための作業状態メモです。

- ブランチ: `fix/exam-data-quality-all-types`
- 直前の主要コミット: `54abf7c8f649cd2e2ee7563273689a375d70597e` (`test: 受講者想定の午後回答E2Eを追加`)
- 本引継ぎコミットの性格: 未コミットだった午後データ補正の途中成果と、この引継ぎ資料をPRブランチへ共有する
- 重要: `apps/web/next-env.d.ts`, `audit_ausm.json`, `audit_full.json`, `temp-logs/` は今回のコミット対象外

## 現在の監査結果

実行コマンド:

```powershell
node scripts/audit-afternoon-data-quality.mjs --json --categories=AP,PM,SA,ST,SC > temp-logs/audit-handoff-20260509.json
node temp-logs/list-sc-data-quality-issues.mjs > temp-logs/sc-data-quality-issues-handoff-20260509.json
```

主要指標:

| 区分 | files | symbolNoStructuralChoices | underlineRefMissing | parentDirectWithChildren | multipleLimits | broadPromptNoLimit | shortAnswerNoLimit |
|---|---:|---:|---:|---:|---:|---:|---:|
| AP | 19 | 0 | 0 | 0 | 0 | 0 | 30 |
| PM | 20 | 0 | 0 | 0 | 0 | 0 | 13 |
| SA | 18 | 0 | 0 | 0 | 0 | 0 | 35 |
| SC | 33 | 36 | 23 | 0 | 0 | 0 | 82 |
| ST | 18 | 0 | 0 | 0 | 0 | 0 | 1 |

今回の主対象だった `symbolNoStructuralChoices`, `underlineRefMissing`, `parentDirectWithChildren`, `multipleLimits`, `broadPromptNoLimit` は AP/PM/SA/ST で 0 になっています。SC は残件ありです。

## この引継ぎコミットに含めるデータ補正

以下の `questions_transformed.json` は未コミットだった補正済み差分です。別端末で継続できるよう、本引継ぎと同じコミットで共有します。

- `packages/data/data/questions/AP-2016-Fall-PM/questions_transformed.json`
- `packages/data/data/questions/AP-2018-Spring-PM/questions_transformed.json`
- `packages/data/data/questions/AP-2019-Spring-PM/questions_transformed.json`
- `packages/data/data/questions/AP-2021-Fall-PM/questions_transformed.json`
- `packages/data/data/questions/AP-2022-Spring-PM/questions_transformed.json`
- `packages/data/data/questions/AP-2023-Fall-PM/questions_transformed.json`
- `packages/data/data/questions/AP-2023-Spring-PM/questions_transformed.json`
- `packages/data/data/questions/PM-2018-Spring-PM1/questions_transformed.json`
- `packages/data/data/questions/SA-2016-Fall-PM1/questions_transformed.json`
- `packages/data/data/questions/SA-2018-Fall-PM1/questions_transformed.json`
- `packages/data/data/questions/SC-2016-Fall-PM1/questions_transformed.json`
- `packages/data/data/questions/SC-2016-Fall-PM2/questions_transformed.json`
- `packages/data/data/questions/SC-2017-Fall-PM1/questions_transformed.json`
- `packages/data/data/questions/SC-2017-Fall-PM2/questions_transformed.json`
- `packages/data/data/questions/SC-2017-Spring-PM2/questions_transformed.json`
- `packages/data/data/questions/SC-2022-Fall-PM1/questions_transformed.json`
- `packages/data/data/questions/SC-2022-Fall-PM2/questions_transformed.json`
- `packages/data/data/questions/ST-2023-Spring-PM1/questions_transformed.json`

## 完了済みの要点

- AP の主要監査指標を 0 化しました。
- PM/SA/ST の主要監査指標を 0 化しました。
- PM/PM1 の字数制限なし短答は、公式解答例の長さを基準に表示文字数を決める実装が既にPRに入っています。
- Staging は PR `synchronize` でも再デプロイされるよう、既にワークフロー修正済みです。
- 受講者想定のPM回答E2Eは、リポジトリ管理のfixtureを使う形で追加済みです。
- SC-2016-Fall-PM1 / SC-2016-Fall-PM2 は、公式PDF画像を確認して多くの選択肢・解答を補正済みです。
- SC-2017-Fall-PM1 は、RLO/Received の公式解答群を追加し、記号解答へ補正済みです。
- SC-2017-Spring-PM2 は、本文内のネストされた解答群を `answerChoices` に構造化済みです。
- SC-2022-Fall-PM1 / SC-2022-Fall-PM2 は、本文内に安全に確認できる選択肢を構造化済みです。
- FE-2024-Public-PM は、英語で登録されていた問題文・解説を公式PDFベースの日本語本文、選択肢、解説へ補正済みです。
- SC-2017-Spring-PM1 は、公式PDF/解答PDFで確認できた qNo=1 の図1・図4関連設問について、記号解答、フィルタリングルール項番、SYN/SYN-ACK経路を補正済みです。
- AI抽出を使う場合は、Gemini API ではなく同一ローカルネットワーク上の Ollama `gemma4:31b` を利用してください。

## SC 残件

`temp-logs/sc-data-quality-issues-handoff-20260509.json` の `groups` 時点です。

| examId | symbol | ref | total | 次の対応 |
|---|---:|---:|---:|---|
| SC-2017-Fall-PM2 | 0 | 1 | 1 | 下線⑪の本文参照を確認 |
| SC-2017-Spring-PM1 | 6 | 1 | 6 | qNo=1 の図1・図4関連設問は補正済み。残る監査件数は再監査で確認 |
| SC-2018-Fall-PM1 | 7 | 8 | 15 | 公式PDFをレンダリングして大きめに処理 |
| SC-2018-Fall-PM2 | 4 | 2 | 5 | 公式PDFをレンダリングして処理 |
| SC-2018-Spring-PM1 | 2 | 0 | 2 | 表中の記号選択肢を構造化 |
| SC-2018-Spring-PM2 | 1 | 0 | 1 | 解答群を構造化 |
| SC-2019-Fall-PM2 | 1 | 0 | 1 | 図2機能の選択肢を構造化 |
| SC-2019-Spring-PM2 | 1 | 0 | 1 | 解答群を構造化 |
| SC-2020-Fall-PM1 | 3 | 2 | 5 | 表5・図4・本文下線参照を確認 |
| SC-2020-Fall-PM2 | 3 | 0 | 3 | 解答群を構造化 |
| SC-2021-Spring-PM1 | 3 | 0 | 3 | 図2/図3の記号選択肢を構造化 |
| SC-2021-Spring-PM2 | 2 | 0 | 2 | 解答群を構造化 |
| SC-2022-Fall-PM2 | 1 | 0 | 1 | ARPスプーフィング設問の解答群を構造化 |
| SC-2022-Spring-PM2 | 2 | 0 | 2 | 本文内解答群を構造化 |
| SC-2024-Fall-PM | 0 | 4 | 4 | 下線①〜④の本文参照を確認 |
| SC-2024-Spring-PM | 0 | 5 | 5 | 下線①〜⑤の本文参照を確認 |

## 次にやる作業

1. `SC-2017-Spring-PM1` は qNo=1 の確認済み補正から再開してください。
   - 問題PDF: `packages/data/data/raw_pdfs/SC-2017-Spring-PM1.pdf`
   - 解答PDF: `packages/data/data/raw_pdfs/SC-2017-Spring-PM1-Ans.pdf`
   - レンダリング済み一時画像: `temp-logs/sc2017springpm1-pages/`, `temp-logs/sc2017springpm1-ans-pages/` はローカル一時ファイルです。別端末では必要に応じて再生成してください。
   - qNo=1 の表3/表4、下線①、図4 SYN/SYN-ACK 経路は公式PDF/解答PDFに基づき補正済みです。残件は再監査結果を見て小さく継続してください。
2. SC の残件は、公式PDFをPyMuPDFで画像化してから小さく修正してください。
3. 各バッチ後に次を実行してください。

```powershell
node scripts/audit-afternoon-data-quality.mjs --json --categories=SC > temp-logs/sc-audit-current.json
node temp-logs/list-sc-data-quality-issues.mjs > temp-logs/sc-data-quality-issues-current.json
```

4. 最終段階で全体監査と静的チェックを実行してください。

```powershell
node scripts/audit-afternoon-data-quality.mjs --json
git diff --check
pwsh .github/hooks/self-inspect.ps1 -Mode start
```

## 要注意事項

- `apps/web/next-env.d.ts` はローカルで変更されていますが、今回の作業とは無関係のためステージしないでください。
- `audit_ausm.json`, `audit_full.json`, `temp-logs/` は調査生成物です。コミットしないでください。
- SCの古い年度はスキャンPDFが多く、テキスト抽出だけでは不十分です。PyMuPDFで画像化して紙面確認してください。
- AI抽出が必要な場合は Ollama `gemma4:31b` を使い、Gemini API は使用しないでください。
- `SA-2016-Fall-PM1`, `PM-2018-Spring-PM1`, `ST-2023-Spring-PM1` は今回の監査上は主要指標0化済みですが、公式PDF確認の余地があるため、最終レビュー時に再確認してください。
- E2Eを再実行した場合は、必ず `docs/04_reports/E2E_Test_Evidence_Report_YYYYMMDD.md` と `apps/web/e2e/evidence/` のスクリーンショットを更新・コミットしてください。