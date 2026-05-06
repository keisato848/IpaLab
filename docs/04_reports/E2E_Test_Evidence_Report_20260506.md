# E2E テストエビデンス報告書

## 1. エグゼクティブサマリー

| 項目 | 値 |
|------|-----|
| テストフレームワーク | Playwright |
| 対象 | NW/SA/ST 2025春 PM1/PM2 transformed データ表示 |
| 総テスト数 | 12 |
| 成功 | 12 |
| 失敗 | 0 |
| スキップ | 0 |
| 成功率 | 100.0% |
| 実行時間 | NW PM2: 2 passed、P0残件: 34.3秒 |
| ブランチ | feature/pm-gated-agent-workflow |
| PR 番号 | なし |

## 2. 変更概要

- NW-2025-Spring-PM2 の `questions_transformed.json` で、2大問・8設問グループ・63解答欄と Mermaid 図表描画を検証した。
- SA/ST 2025春 PM1/PM2 の残P0対象4試験で、`questions_transformed.json` 追加後の午後問題入力欄表示を検証した。
- PM2論述問題は公式解答例が未抽出のため、解答例は空文字のまま保持し、設問ア〜ウの入力欄生成だけを確認した。

## 3. テストシナリオ一覧

| テスト ID | シナリオ名 | 結果 |
|-----------|-----------|------|
| N-01 | NW-2025-Spring-PM2 問1の32解答欄とMermaid描画を確認 | Pass |
| N-02 | NW-2025-Spring-PM2 問2の31解答欄とMermaid描画を確認 | Pass |
| P0-01 | SA-2025-Spring-PM1 問1の10解答欄を確認 | Pass |
| P0-02 | SA-2025-Spring-PM1 問2の8解答欄を確認 | Pass |
| P0-03 | SA-2025-Spring-PM1 問3の8解答欄を確認 | Pass |
| P0-04 | SA-2025-Spring-PM2 問1の3解答欄を確認 | Pass |
| P0-05 | SA-2025-Spring-PM2 問2の3解答欄を確認 | Pass |
| P0-06 | ST-2025-Spring-PM1 問1の8解答欄とMermaid描画を確認 | Pass |
| P0-07 | ST-2025-Spring-PM1 問2の8解答欄を確認 | Pass |
| P0-08 | ST-2025-Spring-PM1 問3の7解答欄を確認 | Pass |
| P0-09 | ST-2025-Spring-PM2 問1の3解答欄を確認 | Pass |
| P0-10 | ST-2025-Spring-PM2 問2の3解答欄を確認 | Pass |

## 4. スクリーンショットエビデンス

| NW PM2 問1 | NW PM2 問2 |
|:---:|:---:|
| ![N-01](../../apps/web/e2e/evidence/2026-05-06T02-45-44-245Z_N-01_NW2025PM2_Q1_answer_fields.png) | ![N-02](../../apps/web/e2e/evidence/2026-05-06T02-45-48-481Z_N-02_NW2025PM2_Q2_answer_fields.png) |

| SA PM1 問1 | SA PM1 問2 | SA PM1 問3 |
|:---:|:---:|:---:|
| ![P0-01](../../apps/web/e2e/evidence/2026-05-06T04-04-50-092Z_P0-01_SA-2025-Spring-PM1_q1_answer_fields.png) | ![P0-02](../../apps/web/e2e/evidence/2026-05-06T04-04-53-024Z_P0-02_SA-2025-Spring-PM1_q2_answer_fields.png) | ![P0-03](../../apps/web/e2e/evidence/2026-05-06T04-04-55-872Z_P0-03_SA-2025-Spring-PM1_q3_answer_fields.png) |

| SA PM2 問1 | SA PM2 問2 |
|:---:|:---:|
| ![P0-04](../../apps/web/e2e/evidence/2026-05-06T04-04-58-356Z_P0-04_SA-2025-Spring-PM2_q1_answer_fields.png) | ![P0-05](../../apps/web/e2e/evidence/2026-05-06T04-05-00-846Z_P0-05_SA-2025-Spring-PM2_q2_answer_fields.png) |

| ST PM1 問1 | ST PM1 問2 | ST PM1 問3 |
|:---:|:---:|:---:|
| ![P0-06](../../apps/web/e2e/evidence/2026-05-06T04-05-04-725Z_P0-06_ST-2025-Spring-PM1_q1_answer_fields.png) | ![P0-07](../../apps/web/e2e/evidence/2026-05-06T04-05-07-253Z_P0-07_ST-2025-Spring-PM1_q2_answer_fields.png) | ![P0-08](../../apps/web/e2e/evidence/2026-05-06T04-05-10-010Z_P0-08_ST-2025-Spring-PM1_q3_answer_fields.png) |

| ST PM2 問1 | ST PM2 問2 |
|:---:|:---:|
| ![P0-09](../../apps/web/e2e/evidence/2026-05-06T04-05-12-367Z_P0-09_ST-2025-Spring-PM2_q1_answer_fields.png) | ![P0-10](../../apps/web/e2e/evidence/2026-05-06T04-05-15-011Z_P0-10_ST-2025-Spring-PM2_q2_answer_fields.png) |

## 5. 結論

対象12シナリオは全て成功した。午後問題ページで `questions_transformed.json` が優先読込され、解答欄が欠落せず、Mermaid図表の描画失敗も発生しないことを確認した。
