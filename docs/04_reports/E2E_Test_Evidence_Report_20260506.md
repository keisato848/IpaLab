# E2E テストエビデンス報告書

## 1. エグゼクティブサマリー

| 項目 | 値 |
|------|-----|
| テストフレームワーク | Playwright |
| 対象 | NW/SA/ST 2025春 PM1/PM2 transformed データ表示、ローカルホスト全試験種別スモーク |
| 総テスト数 | 74 |
| 成功 | 56 |
| 失敗 | 18 |
| スキップ | 0 |
| 成功率 | 75.7% |
| 実行時間 | NW PM2: 2 passed、P0残件: 34.3秒、ローカルホストスモーク: 5分19秒 |
| ブランチ | feature/pm-gated-agent-workflow |
| PR 番号 | なし |

## 2. 変更概要

- NW-2025-Spring-PM2 の `questions_transformed.json` で、2大問・8設問グループ・63解答欄と Mermaid 図表描画を検証した。
- SA/ST 2025春 PM1/PM2 の残P0対象4試験で、`questions_transformed.json` 追加後の午後問題入力欄表示を検証した。
- PM2論述問題は公式解答例が未抽出のため、解答例は空文字のまま保持し、設問ア〜ウの入力欄生成だけを確認した。
- `http://localhost:3000` で開発サーバーを起動し、Chromium から全試験種別の午前・午後1・午後2相当のデータをピックアップして、問題ページ表示、午前選択肢クリック、午後解答欄入力、Mermaid描画エラー有無を確認した。

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

### 3.2 ローカルホスト全試験種別スモーク

実行URL: `http://localhost:3000`

午前は四択ボタンをクリックして正誤表示まで確認した。午後系は `textarea` への入力、`設問データがありません` の非表示、`図の描画に失敗しました` の非表示を確認した。
IP、DB、NWなど、リポジトリ上に午後1/午後2データが3問分存在しない区分は、存在する範囲だけを対象にした。

| 試験種別 | 区分 | 件数 | Pass | Fail |
|---|---|---:|---:|---:|
| IP | 午前 | 3 | 3 | 0 |
| FE | 午前 | 3 | 3 | 0 |
| FE | 午後 | 3 | 0 | 3 |
| AP | 午前 | 3 | 3 | 0 |
| AP | 午後 | 3 | 0 | 3 |
| DB | 午前 | 3 | 3 | 0 |
| NW | 午前 | 3 | 3 | 0 |
| NW | 午後2 | 2 | 2 | 0 |
| PM | 午前 | 3 | 3 | 0 |
| PM | 午後1 | 3 | 2 | 1 |
| PM | 午後2 | 3 | 0 | 3 |
| SA | 午前 | 3 | 3 | 0 |
| SA | 午後1 | 3 | 3 | 0 |
| SA | 午後2 | 3 | 2 | 1 |
| SC | 午前 | 3 | 3 | 0 |
| SC | 午後1 | 3 | 1 | 2 |
| SC | 午後2 | 3 | 1 | 2 |
| SC | 午後 | 3 | 1 | 2 |
| ST | 午前 | 3 | 3 | 0 |
| ST | 午後1 | 3 | 3 | 0 |
| ST | 午後2 | 3 | 2 | 1 |

### 3.3 ローカルホストスモーク失敗一覧

| テストID | 試験種別 | 区分 | examId | 問 | 失敗内容 |
|---|---|---|---|---:|---|
| LS-07 | FE | 午後 | FE-2024-Public-PM | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-08 | FE | 午後 | FE-2024-Public-PM | 2 | 午後問題の解答欄 textarea が表示されていない |
| LS-09 | FE | 午後 | FE-2024-Public-PM | 3 | 午後問題の解答欄 textarea が表示されていない |
| LS-13 | AP | 午後 | AP-2025-Spring-PM | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-14 | AP | 午後 | AP-2025-Spring-PM | 2 | `この試験のデータが見つかりません` が表示される |
| LS-15 | AP | 午後 | AP-2025-Fall-PM | 1 | `この試験のデータが見つかりません` が表示される |
| LS-27 | PM | 午後1 | PM-2025-Fall-PM1 | 1 | Mermaid 図の描画失敗が表示される |
| LS-30 | PM | 午後2 | PM-2025-Fall-PM2 | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-31 | PM | 午後2 | PM-2024-Fall-PM2 | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-32 | PM | 午後2 | PM-2023-Fall-PM2 | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-41 | SA | 午後2 | SA-2024-Spring-PM2 | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-45 | SC | 午後1 | SC-2023-Spring-PM1 | 1 | Mermaid 図の描画失敗が表示される |
| LS-46 | SC | 午後1 | SC-2022-Spring-PM1 | 1 | Mermaid 図の描画失敗が表示される |
| LS-49 | SC | 午後2 | SC-2022-Spring-PM2 | 1 | Mermaid 図の描画失敗が表示される |
| LS-50 | SC | 午後2 | SC-2022-Fall-PM2 | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-51 | SC | 午後 | SC-2025-Spring-PM | 1 | Mermaid 図の描画失敗が表示される |
| LS-53 | SC | 午後 | SC-2024-Spring-PM | 1 | 午後問題の解答欄 textarea が表示されていない |
| LS-62 | ST | 午後2 | ST-2024-Spring-PM2 | 1 | 午後問題の解答欄 textarea が表示されていない |

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

### Localhost Smoke 成功代表

| IP 午前 | FE 午前 | AP 午前 |
|:---:|:---:|:---:|
| ![LS-01](../../apps/web/e2e/evidence/2026-05-06T04-47-00-971Z_LOCAL_LS-01_IP_morning_IP-2024-Spring-AM_q1.png) | ![LS-04](../../apps/web/e2e/evidence/2026-05-06T04-47-09-496Z_LOCAL_LS-04_FE_morning_FE-2024-Public-AM_q1.png) | ![LS-10](../../apps/web/e2e/evidence/2026-05-06T04-47-46-111Z_LOCAL_LS-10_AP_morning_AP-2025-Spring-AM_q1.png) |

| DB 午前 | NW 午前 | NW 午後2 |
|:---:|:---:|:---:|
| ![LS-16](../../apps/web/e2e/evidence/2026-05-06T04-48-30-600Z_LOCAL_LS-16_DB_morning_DB-2016-Spring-AM2_q1.png) | ![LS-19](../../apps/web/e2e/evidence/2026-05-06T04-48-52-722Z_LOCAL_LS-19_NW_morning_NW-2025-Spring-AM2_q1.png) | ![LS-22](../../apps/web/e2e/evidence/2026-05-06T04-49-03-313Z_LOCAL_LS-22_NW_pm2_NW-2025-Spring-PM2_q1.png) |

| PM 午前 | PM 午後1 | SA 午後1 |
|:---:|:---:|:---:|
| ![LS-24](../../apps/web/e2e/evidence/2026-05-06T04-49-17-230Z_LOCAL_LS-24_PM_morning_PM-2025-Fall-AM2_q1.png) | ![LS-28](../../apps/web/e2e/evidence/2026-05-06T04-49-37-037Z_LOCAL_LS-28_PM_pm1_PM-2024-Fall-PM1_q1.png) | ![LS-36](../../apps/web/e2e/evidence/2026-05-06T04-50-06-958Z_LOCAL_LS-36_SA_pm1_SA-2025-Spring-PM1_q1.png) |

| SA 午後2 | SC 午前 | ST 午後1 |
|:---:|:---:|:---:|
| ![LS-39](../../apps/web/e2e/evidence/2026-05-06T04-50-30-943Z_LOCAL_LS-39_SA_pm2_SA-2025-Spring-PM2_q1.png) | ![LS-42](../../apps/web/e2e/evidence/2026-05-06T04-50-43-846Z_LOCAL_LS-42_SC_morning_SC-2025-Spring-AM2_q1.png) | ![LS-57](../../apps/web/e2e/evidence/2026-05-06T04-51-42-383Z_LOCAL_LS-57_ST_pm1_ST-2025-Spring-PM1_q1.png) |

### Localhost Smoke 失敗証跡

| FE 午後 Q1 | FE 午後 Q2 | FE 午後 Q3 |
|:---:|:---:|:---:|
| ![LS-07](../../apps/web/e2e/evidence/2026-05-06T04-47-23-909Z_LOCAL_LS-07_FE_pm_FE-2024-Public-PM_q1_FAIL.png) | ![LS-08](../../apps/web/e2e/evidence/2026-05-06T04-47-32-027Z_LOCAL_LS-08_FE_pm_FE-2024-Public-PM_q2_FAIL.png) | ![LS-09](../../apps/web/e2e/evidence/2026-05-06T04-47-34-745Z_LOCAL_LS-09_FE_pm_FE-2024-Public-PM_q3_FAIL.png) |

| AP 午後 Q1 | AP 午後 Q2 | AP 午後別回 Q1 |
|:---:|:---:|:---:|
| ![LS-13](../../apps/web/e2e/evidence/2026-05-06T04-48-09-503Z_LOCAL_LS-13_AP_pm_AP-2025-Spring-PM_q1_FAIL.png) | ![LS-14](../../apps/web/e2e/evidence/2026-05-06T04-48-17-600Z_LOCAL_LS-14_AP_pm_AP-2025-Spring-PM_q2_FAIL.png) | ![LS-15](../../apps/web/e2e/evidence/2026-05-06T04-48-28-500Z_LOCAL_LS-15_AP_pm_AP-2025-Fall-PM_q1_FAIL.png) |

| PM 午後1 | PM 午後2 2025 | PM 午後2 2024 |
|:---:|:---:|:---:|
| ![LS-27](../../apps/web/e2e/evidence/2026-05-06T04-49-25-831Z_LOCAL_LS-27_PM_pm1_PM-2025-Fall-PM1_q1_FAIL.png) | ![LS-30](../../apps/web/e2e/evidence/2026-05-06T04-49-47-337Z_LOCAL_LS-30_PM_pm2_PM-2025-Fall-PM2_q1_FAIL.png) | ![LS-31](../../apps/web/e2e/evidence/2026-05-06T04-49-49-327Z_LOCAL_LS-31_PM_pm2_PM-2024-Fall-PM2_q1_FAIL.png) |

| PM 午後2 2023 | SA 午後2 2024 | SC 午後1 2023 |
|:---:|:---:|:---:|
| ![LS-32](../../apps/web/e2e/evidence/2026-05-06T04-49-51-404Z_LOCAL_LS-32_PM_pm2_PM-2023-Fall-PM2_q1_FAIL.png) | ![LS-41](../../apps/web/e2e/evidence/2026-05-06T04-50-35-633Z_LOCAL_LS-41_SA_pm2_SA-2024-Spring-PM2_q1_FAIL.png) | ![LS-45](../../apps/web/e2e/evidence/2026-05-06T04-50-52-897Z_LOCAL_LS-45_SC_pm1_SC-2023-Spring-PM1_q1_FAIL.png) |

| SC 午後1 2022春 | SC 午後2 2022春 | SC 午後2 2022秋 |
|:---:|:---:|:---:|
| ![LS-46](../../apps/web/e2e/evidence/2026-05-06T04-50-55-704Z_LOCAL_LS-46_SC_pm1_SC-2022-Spring-PM1_q1_FAIL.png) | ![LS-49](../../apps/web/e2e/evidence/2026-05-06T04-51-09-162Z_LOCAL_LS-49_SC_pm2_SC-2022-Spring-PM2_q1_FAIL.png) | ![LS-50](../../apps/web/e2e/evidence/2026-05-06T04-51-13-463Z_LOCAL_LS-50_SC_pm2_SC-2022-Fall-PM2_q1_FAIL.png) |

| SC 午後 2025春 | SC 午後 2024春 | ST 午後2 2024 |
|:---:|:---:|:---:|
| ![LS-51](../../apps/web/e2e/evidence/2026-05-06T04-51-16-766Z_LOCAL_LS-51_SC_pm_SC-2025-Spring-PM_q1_FAIL.png) | ![LS-53](../../apps/web/e2e/evidence/2026-05-06T04-51-25-455Z_LOCAL_LS-53_SC_pm_SC-2024-Spring-PM_q1_FAIL.png) | ![LS-62](../../apps/web/e2e/evidence/2026-05-06T04-52-08-711Z_LOCAL_LS-62_ST_pm2_ST-2024-Spring-PM2_q1_FAIL.png) |

## 5. 結論

NW/SA/ST 2025春 PM1/PM2 transformed 対象12シナリオは全て成功した。午後問題ページで `questions_transformed.json` が優先読込され、解答欄が欠落せず、Mermaid図表の描画失敗も発生しないことを確認した。

一方、ローカルホスト全試験種別スモークでは62シナリオ中44件が成功し、18件で問題を検出した。失敗は主に、旧形式または未変換の午後問題で解答欄が生成されないケース、AP午後の一部でデータ未検出になるケース、既存午後データのMermaid描画失敗に分類される。修正前報告対象として扱い、個別修正は別フェーズで実施する。
