# 試験データ品質修正計画書

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-05-06 | P0午後問題の解答欄未生成リスク5件について、transformed追加とE2E証跡作成の進捗を追記 |
| 2026-05-06 | 初版作成。全試験種別の問題・解答・解説・図表描画・午後解答欄に関する読み取り専用監査結果を反映 |

## 1. 目的

本計画書は、`packages/data/data/questions/` 配下の全試験データについて、午前問題・午後問題の問題本文、解答、解説、図表、午後解答欄を公開可能な品質へ修正するための実行計画を定義する。

今回の計画は、既存の `docs/03_plans/question-data-remediation-plan.md` を補完する。既存計画が主にデータ欠落、解説欠落、PM構造化を扱うのに対し、本計画では次を新たな品質ゲートとして扱う。

- 図表がMarkdownまたはMermaidとして正しく作成され、実際に描画できること
- 午後問題で受験者が入力する解答欄が、設問・小問・空欄・字数制限と対応していること
- `answers_raw.json` が午後問題の設問構造と対応し、空欄・記号・記述欄に紐付けられること
- 公式公開範囲に対するローカル未整備を明示し、段階的に補完すること

## 2. 調査実施結果

### 2.1 調査条件

| 項目 | 内容 |
|------|------|
| 実施日 | 2026-05-06 |
| 対象 | `packages/data/data/questions/` 配下の全試験ディレクトリ |
| 総ディレクトリ数 | 194 |
| 午前系 | 82 |
| 午後系 | 112 |
| 調査方法 | 読み取り専用の一時Node監査、既存 `local-exam-data-audit.mjs`、Mermaid parser監査 |
| 変更有無 | なし。調査後の `git status --short` は空 |

### 2.2 既存ローカル監査結果

`.github/skills/exam-data-management/scripts/local-exam-data-audit.mjs --json` の結果は次のとおり。

| ルール | 件数 | 内容 |
|------|------:|------|
| `PUBLISHED_EXAM_MISSING_LOCAL` | 98 | `exam-list.ts` に存在する公開試験がローカルに存在しない |
| `QUESTION_FILE_MISSING` | 2 | ローカルディレクトリはあるが `questions_transformed.json` / `questions_raw.json` がない |
| `LOCAL_EXAM_NOT_IN_EXAM_LIST` | 2 | ローカルにはあるが `exam-list.ts` に存在しない |

`QUESTION_FILE_MISSING` 対象:

- `IP-2020-Oct-AM`
- `NW-2021-Spring-AM2`

`LOCAL_EXAM_NOT_IN_EXAM_LIST` 対象:

- `FE-2024-Public-AM`
- `FE-2024-Public-PM`

`PUBLISHED_EXAM_MISSING_LOCAL` は、主に `DB-*`、`ES-*`、古い `FE-*`、`NW-2016〜2018`、`NW-2019-Fall-PM1/PM2`、`NW-2021〜2025 PM1/PM2` が対象である。

## 3. 問題分類と対応方針

### 3.1 優先度

| 優先度 | 基準 | 例 |
|------|------|------|
| P0 Critical | 表示不能、入力不能、正答不一致、公式公開データの完全欠落 | 質問ファイル欠落、午後解答欄未生成、午前正答不一致 |
| P1 High | 表示はできるが学習・採点の根幹に影響 | Mermaid描画不能、午後解答例空、設問・空欄対応不一致 |
| P2 Medium | 学習体験やレビュー効率を大きく下げる | 解説不足、表形式崩れ、図表簡略表現 |
| P3 Low | メタデータ、形式差分、将来の同期リスク | `exam-list.ts` 未登録、キー形式の非標準 |

### 3.2 修正前報告ゲート

ユーザー指示により、修正前に検出内容を報告する。以後の修正作業も、対象をバッチ分割し、各バッチの修正前に次を報告する。

- 対象examId
- 問題種別
- 影響範囲
- 修正方針
- 検証方法
- self-inspect 追加要否
- E2E evidence 要否

P0/P1の修正では、報告後に明示的なGo判定を得てから実装へ進む。

## 4. 発見事項

### 4.1 P0: 公式公開範囲に対するローカル未整備

`PUBLISHED_EXAM_MISSING_LOCAL` が98件存在する。これは、公式公開範囲に対してローカルJSONが未整備である状態であり、該当試験はページ表示・学習・採点の対象にできない。

代表カテゴリ:

- `DB-2016〜2025` の `AM2` / `PM1` / `PM2`
- `ES-2016〜2025` の `AM2` / `PM1` / `PM2`
- `FE-2016〜2019` の `AM` / `PM`
- `IP-2016〜2019` の `AM`
- `NW-2016〜2018` の `AM2` / `PM1` / `PM2`
- `NW-2019-Fall-PM1/PM2`
- `NW-2021〜2025` の `PM1` / `PM2`

対応方針:

1. `exam-list.ts` と公式ソース監査結果を正とし、対象一覧を確定する。
2. raw PDF の存在を `audit:raw-pdfs` で確認する。
3. 午前系は Ollama/Gemma または既存Gemini経路で問題・解答を生成する。
4. 午後系は Gemini API を優先し、解説込みで `questions_raw.json` / `answers_raw.json` を生成する。
5. 午後系は生成後に `questions_transformed.json` まで作成し、アプリ表示・解答欄生成を検証する。

### 4.2 P0: 質問ファイル欠落

対象:

- `IP-2020-Oct-AM`
- `NW-2021-Spring-AM2`

対応方針:

- `IP-2020-Oct-AM` は公式PDFと既存一覧を確認し、午前問題として再抽出する。
- `NW-2021-Spring-AM2` は既知のCMap不足により解答PDFテキスト抽出が失敗しているため、公式正答の復元方法を別途確定する。25問分の公式正答が復元できるまで `answers_raw.json` をコミットしない。

### 4.3 P0: 午前系の正答不整合

対象:

| examId | 問題 |
|------|------|
| `PM-2020-Fall-AM2` | `answers_raw.json` と `correctOption` が1問不一致 |
| `PM-2016-Spring-AM2` | 1問で解答qNo欠落、1問で `correctOption` 不正 |
| `SA-2025-Spring-AM2` | 全25問で `correctOption` が不正扱い |
| `ST-2025-Spring-AM2` | 全25問で `correctOption` が不正扱い |

対応方針:

1. 各 `answers_raw.json` を正規化し、`qNo -> correctOption` のmapを作る。
2. `questions_raw.json` の選択肢IDと `correctOption` の表記ゆれを確認する。
3. 公式解答PDFと照合し、問題側または解答側を修正する。
4. 修正後に AM/AM2 の qNo、選択肢a-d、正答一致、解説有無を再検証する。
5. 再発防止として `.github/hooks/self-inspect.ps1` のR16相当で検出できるか確認する。

### 4.4 P0: 午後問題の解答欄未生成リスク

対象:

- `NW-2025-Spring-PM2`
- `SA-2025-Spring-PM1`
- `SA-2025-Spring-PM2`
- `ST-2025-Spring-PM1`
- `ST-2025-Spring-PM2`

原因:

これら5件は `questions_transformed.json` がなく、`questions_raw.json` のみである。アプリ側の `normalizeExamQuestions()` は raw 配列をそのまま `Question[]` として扱うため、raw の `questions[]` が `subQuestions` に変換されない。結果として、旧形式PM画面で `AIAnswerBox` の入力欄が生成されない可能性が高い。

対応方針:

1. raw PMデータをアプリが扱える `questions_transformed.json` へ変換する。
2. `qNo`、`theme`、`context.background`、`questions[]`、`subQuestions[]`、`answer`、`explanation` を揃える。
3. PM2論述式は、設問ア/イ/ウをそれぞれ独立した大きな入力欄として扱える構造にする。
4. NW/SC/DB等の短答式午後は、空欄・小問・記述欄単位で解答欄を分割できる構造にする。
5. 変換後、実ページで入力欄数・ラベル・字数制限・解答例対応を確認する。

進捗:

| examId | 状態 | 検証 |
|------|------|------|
| `NW-2025-Spring-PM2` | `questions_transformed.json` 追加済み。2大問・8設問グループ・63解答欄 | E2E N-01/N-02 成功、Mermaid描画確認済み |
| `SA-2025-Spring-PM1` | `questions_transformed.json` 追加済み。3大問・11設問グループ・26解答欄 | E2E P0-01〜P0-03 成功 |
| `SA-2025-Spring-PM2` | `questions_transformed.json` 追加済み。2大問・6設問グループ・6解答欄。解答例は空のまま | E2E P0-04/P0-05 成功 |
| `ST-2025-Spring-PM1` | `questions_transformed.json` 追加済み。3大問・10設問グループ・23解答欄 | E2E P0-06〜P0-08 成功、問1 Mermaid描画確認済み |
| `ST-2025-Spring-PM2` | `questions_transformed.json` 追加済み。2大問・6設問グループ・6解答欄。解答例は空のまま | E2E P0-09/P0-10 成功 |

PM2の解答例空はP1「午後解答データの欠落・疎さ」に残す。公式根拠なしに模範解答を生成しない。

### 4.5 P1: 午後解答データの欠落・疎さ

`answers_raw.json` が空または正規化不能な午後試験が40件存在する。さらに、設問リーフ数に対して解答数が少なすぎる試験が7件存在する。

解答が空または正規化不能な代表範囲:

- `PM-2016-Spring-PM1/PM2` から `PM-2025-Fall-PM1/PM2` の多数
- `SA-* PM2` の多数
- `ST-* PM2` の多数
- `SC-2019-Fall-PM2`

解答が疎すぎる対象:

- `SC-2016-Spring-PM1`
- `SC-2017-Spring-PM1`
- `SC-2018-Fall-PM2`
- `SC-2019-Spring-PM2`
- `SC-2020-Fall-PM1`
- `SC-2024-Fall-PM`
- `SC-2024-Spring-PM`

対応方針:

1. 午後解答PDF用の正規化ルールを作る。
2. `問1-設問1-(1)`、`1_3a`、`1-1-a` などのキー形式を内部モデルへ正規化する。
3. 問題側から推定した解答欄IDと `answers_raw.json` のキーを照合する。
4. 解答例が空の試験はGemini APIまたは公式PDFテキスト抽出で再生成する。
5. 解答欄と解答例が1対1、または複数解答指定に対して妥当な1対Nで対応することを確認する。

### 4.6 P1: Mermaid構文・描画問題

Mermaid block は162試験、626ブロックを検出した。Node実行環境由来の `DOMPurify.sanitize is not a function` を除外した後、実データ由来の構文エラー候補は71ブロック、41試験である。

対象試験:

- `AP-2016-Fall-AM`
- `AP-2018-Spring-AM`
- `AP-2019-Spring-AM`
- `AP-2020-Fall-AM`
- `AP-2021-Spring-PM`
- `AP-2025-Spring-AM`
- `FE-2023-Public-AM`
- `FE-2024-Public-PM`
- `IP-2022-Spring-AM`
- `IP-2023-Spring-AM`
- `NW-2025-Spring-PM2`
- `PM-2016-Spring-PM1`
- `PM-2025-Fall-PM1`
- `SA-2016-Fall-AM2`
- `SA-2019-Fall-AM2`
- `SA-2022-Spring-AM2`
- `SA-2022-Spring-PM1`
- `SA-2023-Spring-AM2`
- `SA-2024-Spring-PM1`
- `SA-2025-Spring-AM2`
- `SC-2016-Fall-PM1`
- `SC-2016-Spring-PM1`
- `SC-2016-Spring-PM2`
- `SC-2017-Fall-PM1`
- `SC-2017-Spring-PM1`
- `SC-2017-Spring-PM2`
- `SC-2018-Fall-PM1`
- `SC-2018-Spring-PM1`
- `SC-2018-Spring-PM2`
- `SC-2019-Fall-PM1`
- `SC-2019-Spring-PM2`
- `SC-2020-Fall-AM2`
- `SC-2020-Fall-PM1`
- `SC-2020-Fall-PM2`
- `SC-2022-Fall-PM2`
- `SC-2022-Spring-PM1`
- `SC-2023-Fall-AM2`
- `SC-2023-Spring-PM1`
- `SC-2025-Spring-PM`
- `ST-2023-Spring-PM2`
- `ST-2024-Spring-PM1`

対応方針:

1. `apps/web/lib/mermaid/sanitize.ts` のサニタイズ後に parser が通るかを監査する恒久スクリプトを作る。
2. 個別データのMermaid構文を修正する。
3. 原図の意味が変わらないよう、修正前後でノード・エッジ・表記を比較する。
4. UI変更が必要な場合はE2E evidenceを作成する。

### 4.7 P2: Markdown表・図表参照の問題

静的ヒューリスティックでは、Markdown表の列数不一致候補が71試験で検出された。ただし、これはMarkdown表以外の縦棒文字や説明文を拾っている可能性があるため、修正前に個別精査が必要である。

追加検出:

| 種別 | 対象 |
|------|------|
| 図表参照はあるが描画可能図表なし | `AP-2021-Spring-AM`, `AP-2023-Spring-AM`, `FE-2019-Fall-AM` |
| 表参照はあるがMarkdown表なし | `SC-2018-Fall-PM2` |

対応方針:

1. Markdown表検出ロジックをGFM準拠へ寄せ、誤検知を減らす。
2. `図1` / `表1` などの参照番号と、実際の図表・キャプションを対応付ける。
3. 図表が簡略表現 `[図: ...]` のみの場合は、原典PDFとの差分レビュー対象にする。

### 4.8 P2: 解説不足

午前系の解説不足対象:

- `AP-2025-Fall-AM`
- `DB-2016-Spring-AM2`
- `FE-2024-Public-AM`
- `NW-2019-Fall-AM2`
- `NW-2022-Spring-AM2`
- `NW-2023-Spring-AM2`
- `NW-2024-Spring-AM2`
- `NW-2025-Spring-AM2`
- `SA-2025-Spring-AM2`
- `ST-2025-Spring-AM2`

午後系の解説不足対象:

- `AP-2017-Spring-PM`
- `AP-2022-Spring-PM`
- `PM-2016-Spring-PM1`
- `PM-2025-Fall-PM1`
- `SA-2023-Spring-PM1`
- `SC-2019-Spring-PM2`
- `SC-2021-Spring-PM1`
- `SC-2021-Spring-PM2`
- `SC-2022-Fall-PM2`
- `SC-2024-Fall-PM`
- `SC-2025-Fall-PM`
- `ST-2023-Spring-PM1`

対応方針:

1. 午前系は正答・選択肢・問題文を入力にして解説を生成する。
2. 午後系は設問・小問単位で解説を生成する。
3. 図表を参照する設問では、図表内容を含めて解説生成する。
4. 解説が20文字超であることだけでなく、正答根拠を含むことを監査する。

## 5. フェーズ別実行計画

### Phase 0: 監査スクリプトの恒久化

目的: 今回の一時監査を再実行可能なnpm scriptへ昇格する。

成果物:

- `packages/data/src/scripts/audit-exam-data-quality.ts`
- `packages/data/package.json` の `audit:exam-quality`
- 監査結果のMarkdown/JSON出力仕様

検出対象:

- 共通JSON構造
- 午前問題の qNo、選択肢、正答、解説
- 午後問題の大問、設問、小問、解答例、解答欄
- Mermaid構文
- Markdown表
- 図表参照
- 公式公開範囲との差分

完了条件:

- `npm run -w packages/data audit:exam-quality` がローカルで実行できる
- blocking / warning / info が分類される
- 監査結果が全examIdに対して再現可能

### Phase 1: P0表示不能・入力不能の修正

対象:

- `IP-2020-Oct-AM`
- `NW-2021-Spring-AM2`
- `NW-2025-Spring-PM2`
- `SA-2025-Spring-PM1`
- `SA-2025-Spring-PM2`
- `ST-2025-Spring-PM1`
- `ST-2025-Spring-PM2`

作業:

1. 欠落ファイルを再生成する。
2. raw-only午後データに `questions_transformed.json` を追加する。
3. 午後設問から解答欄IDを導出し、`answers_raw.json` と対応付ける。
4. Mermaid構文エラーを同時に修正する。

検証:

- `npm run -w packages/data audit:exam-quality -- --exam-id=<examId>`
- `node scripts/guard-exam-data-fallback.mjs`
- `pwsh .github/hooks/self-inspect.ps1 -Mode start -FailOnFinding`
- UI影響がある場合はPlaywright E2E evidenceを作成する。

### Phase 2: 午前正答不一致の修正

対象:

- `PM-2020-Fall-AM2`
- `PM-2016-Spring-AM2`
- `SA-2025-Spring-AM2`
- `ST-2025-Spring-AM2`

作業:

1. `answers_raw.json` を公式解答PDFと照合する。
2. `questions_raw.json` の `correctOption` を正規化する。
3. 選択肢IDが `a`〜`d` で揃っているか確認する。
4. 正答修正後、必要に応じて解説を再生成する。

完了条件:

- qNo 連番
- 選択肢 a-d 非空
- `answers_raw.json` と `correctOption` 全問一致
- self-inspect R16で再検出されない

### Phase 3: 午後解答例・解答欄対応の修正

対象:

- `AFTERNOON_ANSWERS_EMPTY` 40件
- `AFTERNOON_ANSWERS_TOO_SPARSE_FOR_FIELDS` 7件
- `AFTERNOON_BLANK_REF_WITHOUT_ANSWER_KEY` 検出対象のうち、誤検知を除いたもの

作業:

1. 午後解答キー正規化ルールを設計する。
2. 設問本文から解答欄候補を抽出する。
3. 解答PDFから解答例を抽出し、正規化キーへ対応付ける。
4. 論述式PM2は設問ア/イ/ウの入力欄と字数制限を明示する。
5. 短答式PM1/PMは空欄、記号選択、理由記述、複数解答を区別する。

完了条件:

- 設問・小問・空欄に対して入力欄が生成できる
- 入力欄ラベルと解答例キーが対応する
- 字数制限が抽出または明示される
- 解答例が空でない

### Phase 4: 図表・Mermaid・Markdown表の修正

対象:

- Mermaid構文エラー 71ブロック / 41試験
- 図表参照不足 3試験
- 表参照不足 1試験
- Markdown表列数不一致候補 71試験

作業:

1. Mermaid parser監査を恒久化する。
2. 構文エラーを個別修正する。
3. 図表番号・表番号・キャプション・空欄記号を照合する。
4. Markdown表はGFM形式として列数を整える。
5. 原典PDFとの主要ラベル比較を行う。

完了条件:

- Mermaid parserが通る
- 実ページでSVGが非空かつ表示される
- 表の列数がGFMとして妥当
- 図表参照と実体が対応する

### Phase 5: 解説補完

対象:

- 午前解説不足 10試験
- 午後解説不足 12試験

作業:

1. 正答・図表・設問を踏まえた解説を生成する。
2. 解説が正答根拠と誤答観点を含むか確認する。
3. MarkdownやMermaidを含む場合は描画監査を通す。

完了条件:

- 午前問題は各問 `explanation` が20文字超
- 午後問題は各設問または小問に `explanation` がある
- 生成残骸がない

### Phase 6: 公式未整備試験の段階補完

対象:

- `PUBLISHED_EXAM_MISSING_LOCAL` 98件

優先順:

1. 現行年度・直近年度の `NW` / `SC` / `PM` / `ST` / `SA`
2. `AM2` など短時間で品質検証しやすい午前系
3. `PM1` / `PM2` の午後系
4. `DB` / `ES` の未整備全量
5. 古い `FE` / `IP`

完了条件:

- `local-exam-data-audit.mjs --json` の `PUBLISHED_EXAM_MISSING_LOCAL=0`
- raw PDF監査OK
- 問題・解答・解説・図表・解答欄の品質監査OK

## 6. 検証計画

### 6.1 ローカルデータ監査

```powershell
node .github/skills/exam-data-management/scripts/local-exam-data-audit.mjs --json
npm run -w packages/data audit:exam-quality
```

### 6.2 既存防壁

```powershell
node scripts/guard-exam-data-fallback.mjs
pwsh .github/hooks/self-inspect.ps1 -Mode start -FailOnFinding
```

### 6.3 Mermaid・図表描画

```powershell
npm run -w packages/data audit:exam-quality -- --check-render
```

`--check-render` は次を確認する。

- Mermaid parser が通る
- ブラウザ上で `.mermaid svg` が表示される
- SVG の width / height が0でない
- 図表が本文や解答欄に重ならない
- モバイル幅で読める

### 6.4 午後解答欄

```powershell
npm run -w packages/data audit:exam-quality -- --check-answer-fields
```

`--check-answer-fields` は次を確認する。

- 設問・小問・空欄から入力欄IDを導出できる
- `answers_raw.json` のキーと対応する
- 字数制限を抽出できる
- 複数解答指定が1欄に潰れていない
- 論述式の設問ア/イ/ウが独立欄になる

### 6.5 E2E evidence

UIに影響する修正、図表描画、午後解答欄、テーマ・アクセシビリティ変更を行った場合は、E2E実行とエビデンス報告書を必須とする。

```powershell
npm run test:e2e
```

報告書は `docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md` に作成し、スクリーンショットは `apps/web/e2e/evidence/` 配下でgit管理する。

## 7. 再発防止

### 7.1 self-inspect追加候補

今回の修正で再発しやすいと判断したものは `.github/hooks/self-inspect.ps1` に追加する。

候補:

- 午後raw-onlyで `questions_transformed.json` がなく、`questions[]` が `subQuestions` に変換されないケース
- 午後 `answers_raw.json` が空のままコミットされるケース
- Mermaid code block が parser に通らないケース
- 図表参照があるのに図表実体がないケース
- 午前 `answers_raw.json` と `correctOption` の不一致

### 7.2 CI追加候補

- `npm run -w packages/data audit:exam-quality`
- `node .github/skills/exam-data-management/scripts/local-exam-data-audit.mjs --json`
- Mermaid構文監査

## 8. リスクと留意事項

| リスク | 対応 |
|------|------|
| Markdown表監査の誤検知 | GFM準拠の検出ロジックへ改善し、個別修正前に実データを確認する |
| Mermaid parserのNode環境差分 | `DOMPurify` 由来エラーはブラウザ描画問題と分けて扱う。最終確認はPlaywrightで行う |
| 午後解答キー形式の混在 | 内部正規化モデルを作り、既存形式を即時破壊しない |
| Gemini APIコスト・レート | `--exam-id`、`--questions-only`、`--answers-only` で対象限定する |
| Ollamaモデル差分 | Qwen3.xは使用しない。AM/AM2は `gemma4:e4b` を基本とする |
| 公式PDFのCMap不足 | テキスト抽出に固執せず、画像OCRまたは人手確認を併用する |
| UI修正のE2E負荷 | P0/P1対象に絞って段階的にE2E evidenceを作成する |

## 9. 次回作業の開始条件

次回修正に入る前に、次の順序でユーザーへ対象バッチを報告する。

1. Phase 1対象のうち、`NW-2025-Spring-PM2` を最優先にするか確認する。
2. 修正前に、該当ファイル、問題内容、修正方針、検証方法を提示する。
3. Go判定後、`questions_transformed.json` 生成とMermaid修正を行う。
4. 検証通過後、設計書とself-inspectの必要更新を行う。
5. 対象ファイルのみ明示してコミットする。

## 10. 完了判定

全体完了条件は次のとおり。

- `PUBLISHED_EXAM_MISSING_LOCAL=0`
- `QUESTION_FILE_MISSING=0`
- 午前系の `correctOption` と `answers_raw.json` が全問一致
- 午前系の選択肢 a-d が全問非空
- 午前系・午後系の解説欠落が0
- 午後系の `answers_raw.json` が空でない
- 午後系の設問・小問・空欄に対して解答欄が生成できる
- Mermaid構文エラーが0
- 図表参照と図表実体の不一致が0
- UI影響範囲のE2E evidenceが作成済み
- `guard-exam-data-fallback` と `self-inspect` が通過