# 公式ソースカバレッジ監査レポート 2026-05-02

## 1. 監査条件

| 項目 | 内容 |
|---|---|
| 対象カテゴリ | AP / PM / SC / FE / NW / DB / SA / ES / ST |
| 年度範囲 | 2016 年以降、2026 年まで |
| 対象データ | 問題 PDF と解答 PDF の両方 |
| To-Be 判定 | IPA 公式年度別 HTML から抽出できる公式 PDF の存在 |
| 実行コマンド | `node .github/skills/exam-data-management/scripts/official-source-coverage-audit.mjs --from-year=2016 --categories=AP,PM,SC,FE,NW,DB,SA,ES,ST --json` |

本監査は本番 Cosmos DB へ接続せず、ローカルファイルと IPA 公式公開ページのみを読み取った。

## 2. 監査サマリー

| 指標 | 件数 |
|---|---:|
| 公式 HTML ソースページ | 11 |
| 公式 To-Be 問題単位 | 277 |
| 公式 To-Be 解答単位 | 277 |
| 現行 `exam-list.ts` 対象単位 | 167 |
| 現行ローカル対象単位 | 175 |
| ブロッキング差分 | 423 |
| `exam-list.ts` 未登録 | 116 |
| ローカル問題 JSON 欠落/空 | 108 |
| `exam-list.ts` の `answerUrl` 欠落 | 49 |
| ローカル `answers_raw.json` 欠落/空 | 150 |

現時点では公式 To-Be に対してブロッキング差分が残っているため、本番 `Questions` コンテナ同期 dry-run へ進めない。

## 3. ルール別差分

| ルール | 件数 | As-Is | To-Be |
|---|---:|---|---|
| `OFFICIAL_EXAM_NOT_IN_EXAM_LIST` | 116 | 公式問題 PDF は存在するが `exam-list.ts` に未登録 | 公式 `questionUrl` と、存在する場合は `answerUrl` を `exam-list.ts` に登録する |
| `OFFICIAL_EXAM_MISSING_LOCAL_QUESTIONS` | 108 | 公式問題 PDF は存在するがローカル問題 JSON が未作成または空 | 正規 `qNo` を持つ `questions_raw.json` / `questions_transformed.json` を作成する |
| `OFFICIAL_ANSWER_URL_NOT_IN_EXAM_LIST` | 49 | 公式解答 PDF は存在するが `exam-list.ts` の `answerUrl` が未設定 | `answerUrl` を公式解答 PDF に同期する |
| `OFFICIAL_ANSWER_MISSING_LOCAL` | 150 | 公式解答 PDF は存在するがローカル `answers_raw.json` が未作成または空 | 公式解答 PDF から `answers_raw.json` を作成する |

## 4. カテゴリ別エラー件数

| カテゴリ | エラー件数 |
|---|---:|
| AP | 19 |
| PM | 32 |
| SC | 27 |
| FE | 45 |
| NW | 81 |
| DB | 90 |
| SA | 19 |
| ES | 90 |
| ST | 20 |

## 5. 代表的な To-Be / As-Is ギャップ

| 種別 | 代表 examId | As-Is | To-Be |
|---|---|---|---|
| `exam-list.ts` 未登録 | `AP-2021-Fall-PM`, `AP-2022-Spring-PM`, `AP-2024-Spring-PM` | 公式 AP 午後 PDF が存在するが `exam-list.ts` にない | AP 午後の公式問題/解答 URL を登録する |
| 新規カテゴリ未登録 | `NW-2016-Fall-AM2`, `DB-2016-Spring-AM2`, `ES-2016-Spring-AM2` | NW / DB / ES の公式 PDF が存在するが `exam-list.ts` とローカル問題がない | 公式 URL 登録、PDF ダウンロード、問題/解答 JSON 生成を行う |
| FE 旧形式不足 | `FE-2016-Fall-AM`, `FE-2016-Fall-PM`, `FE-2017-Fall-AM` | FE 2016-2019 の公式問題/解答 PDF が To-Be にあるがローカル整備が不足 | 旧形式 FE の AM/PM 問題と解答を生成する |
| 2025 高度区分不足 | `SA-2025-Spring-AM2`, `ST-2025-Spring-PM2` | 2025 Spring の SA/ST 公式 PDF が存在するが `exam-list.ts` とローカル問題がない | 2025 Spring の SA/ST を追加し、問題/解答 JSON を生成する |
| 解答 URL 欠落 | `AP-2019-Fall-AM`, `AP-2021-Spring-AM`, `AP-2023-Fall-AM` | 公式解答 PDF は存在するが `exam-list.ts` の `answerUrl` が未設定 | `answerUrl` を公式 PDF に同期する |
| ローカル解答欠落 | `DB-2016-Spring-PM1`, `ES-2017-Spring-PM2`, `NW-2018-Fall-PM1` | 公式解答 PDF は存在するが `answers_raw.json` がない | 公式解答 PDF から `answers_raw.json` を生成する |

## 6. 修正後 To-Be

修正後は以下を満たす状態を To-Be とする。

- 対象カテゴリ AP / PM / SC / FE / NW / DB / SA / ES / ST の 2016 年以降について、公式問題 PDF が存在する全 examId が `exam-list.ts` に登録されている。
- 公式解答 PDF が存在する examId は `answerUrl` と `answers_raw.json` を持つ。
- 各 examId は `questions_raw.json` または `questions_transformed.json` を持ち、`qNo` 欠損、重複、旧 `qNo=99` プレースホルダーがない。
- 公式ソース監査の `blockingIssueCount` が 0 である。
- ローカル監査の `blockingIssueCount` が 0 である。
- 上記を満たした後にのみ、本番 Cosmos DB の dry-run を実行する。本番 apply は別途明示承認を受けてから実行する。

## 7. 現時点の判断

現時点ではブロッキング差分が残っているため、本番同期は未実行とする。
次工程は `exam-list.ts` の公式 To-Be 同期、PDF ダウンロード、Gemini OCR または同等の抽出手段によるローカル問題/解答 JSON 生成、ローカル監査再実行である。