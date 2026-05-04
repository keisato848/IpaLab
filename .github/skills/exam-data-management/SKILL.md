---
name: exam-data-management
description: >
  IPA 過去問題データの抽出、ローカル検証、Cosmos DB dry-run、登録、同期、qNo 整合性監査を行う。
  Use when 試験データ追加、IPA 公開データ照合、Questions コンテナ再同期、qNo=99 プレースホルダー削除、
  データ抽出・登録・同期手順を実行またはレビューしたい時。
---

# Exam Data Management

IPA 過去問題データを GitOps 管理し、Cosmos DB `Questions` コンテナへ安全に同期するためのワークフローを定義する。
本スキルは本番書き込みの前に必ず dry-run とローカル検証を行い、機微情報を出力しない。

## 使用する場面

- `packages/data/data/questions/` の JSON 形式や `qNo` 整合性を確認する
- IPA 公式年度別 HTML から抽出した PDF/HTML 存在を To-Be とし、`exam-list.ts` とローカルデータの不足を確認する
- Cosmos DB `Questions` の `qNo=99` 旧プレースホルダーを dry-run で洗い出す
- 承認後に、旧プレースホルダー削除と正規 qNo の upsert を実行する

## ワークフロー

1. `scripts/official-source-coverage-audit.mjs` で IPA 公式年度別 HTML から対象カテゴリの To-Be を抽出し、`exam-list.ts`、ローカル問題、ローカル解答との差分を確認する。
2. `scripts/local-exam-data-audit.mjs` でローカル JSON 形式、qNo 欠損、重複、空データを検証する。
3. Cosmos DB の firewall は必要な間だけ現在 IP を追加し、終了時に必ず戻す。
4. `scripts/cosmos-questions-sync-plan.mjs --dry-run` で削除予定、upsert 予定、未整合を確認する。
5. ユーザー承認後のみ `--apply --confirm-production-write` を付けて同期する。
6. 同じ dry-run を再実行し、`placeholderDeleteCount=0` と `missingExpectedCount=0` を確認する。

## スクリプト

- `scripts/official-source-coverage-audit.mjs`: IPA 公式年度別 HTML から対象カテゴリの問題/解答 PDF を抽出し、To-Be / As-Is 差分を検出する。
- `scripts/local-exam-data-audit.mjs`: ローカル問題 JSON の形式、qNo 欠損、重複、空データ、IPA 公開一覧との差分を検出する。
- `scripts/cosmos-questions-sync-plan.mjs`: Cosmos `Questions` とローカル静的データを qNo 単位で比較し、dry-run または承認付き apply を行う。

## Examples

詳細な実行例と出力例は `examples/dry-run-report.example.md` を必要な時だけ参照する。

## Quality Gates

- [ ] 公式ソース監査で対象カテゴリ、年度範囲、問題/解答の To-Be / As-Is 差分が説明済みである
- [ ] ローカル監査で `blockingIssueCount=0` である
- [ ] IPA 公開一覧との差分が説明済み、または `missingPublishedExamCount=0` である
- [ ] dry-run が本番接続文字列やキーを出力していない
- [ ] 本番 apply は `--confirm-production-write` なしで実行できない
- [ ] 同期後の再監査で `placeholderDeleteCount=0` と `missingExpectedCount=0` を確認する

## Gotchas

- `qNo=99` は IP/AM で正規問題になり得るため、無条件削除しない。ローカル静的データに Q99 がない examId の旧プレースホルダーのみ削除対象にする。
- `az cosmosdb network-rule add/remove` は VNet subnet ルール用で、IP firewall 一時許可には `az cosmosdb update --ip-range-filter` を使う。
- dry-run で `missingExpectedCount` が残る状態は、本番ページの部分不整合再発リスクがある。
- `exam-list.ts` は IPA 公開 PDF のローカル参照表であり、公式サイトの全量ではない。同期前は公式年度別 HTML から To-Be を抽出して差分を確認する。
- Gemini OCR 抽出対象のカテゴリフィルタに新規対象区分を追加し忘れると、PDF をダウンロードしても `questions_raw.json` / `answers_raw.json` が生成されない。

## 検証ループ

1. 公式ソース監査を実行し、対象カテゴリの To-Be / As-Is 差分を把握する。
2. ローカル監査を実行し、blocking issue を修正する。
3. Cosmos dry-run を実行し、削除・upsert 計画をレビューする。
4. セキュリティレビューで secret 出力、過剰削除、未承認 apply がないことを確認する。
5. 承認後に apply し、同じ dry-run と App Insights ログを再確認する。
6. 設計書、PR 本文、実行結果サマリーを更新する。