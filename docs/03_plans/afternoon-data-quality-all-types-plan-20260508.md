# 全試験区分 午後データ品質修正計画書

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-05-08 | 初版作成。AP / SA 起点不具合を全試験区分へ拡張し、既存データ修正・未抽出区分の抽出・UI再発防止・検証計画を定義 |
| 2026-05-08 | 公式ソース監査の対象に AU / SM を追加し、DB / AU / SM / ES の午後データ抽出対象が公式To-Be上も検出されることを確認 |
| 2026-05-08 | SA-2024-Spring-PM1 qNo=1 の transformed 解答を公式解答PDF / answers_raw.json と同期 |
| 2026-05-08 | AP-2025-Spring-PM qNo=1 の表2・解答群・下線根拠・複数字数設問（設問3/4）を公式PDFに基づき補正 |
| 2026-05-08 | AP-2022-Fall-PM qNo=1 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | SA-2024-Spring-PM1 qNo=2 の本文下線根拠と公式解答を同期 |
| 2026-05-08 | SA-2024-Spring-PM1 qNo=3 の表2・本文下線根拠・公式解答を同期 |
| 2026-05-08 | AP-2023-Spring-PM qNo=1 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | FE-2023-Public-PM の既存解答群を選択肢データとして構造化 |
| 2026-05-08 | FE-2022-Sample-PM の既存解答群を選択肢データとして構造化 |
| 2026-05-08 | AP-2024-Spring-PM qNo=1 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | AP-2024-Fall-PM qNo=1 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | AP区分 PM の親見出し explanation / 直下集約回答を整理し、parentDirectWithChildren を区分内0件化 |
| 2026-05-08 | AP-2020-Fall-PM / AP-2021-Fall-PM の空 subQuestions 単独設問を既存解答付きの子設問へ正規化 |
| 2026-05-08 | AP区分 PM の本文内解答群を answerChoices に構造化し、symbolNoStructuralChoices を 52件から12件へ削減 |
| 2026-05-08 | NW-2025-Spring-PM2 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | ST区分 PM1/PM2 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | ST-2017-Fall-PM1 / ST-2019-Fall-PM1 の空 subQuestions 単独設問を公式解答付きの子設問へ正規化 |
| 2026-05-08 | ST-2021-Spring-PM1 / ST-2024-Spring-PM1 の Mermaid 日本語円形ノードを描画ルールに合わせて引用化 |
| 2026-05-08 | SA区分 PM1 の複数字数制限設問を項目別の子設問へ分割し、multipleLimits を0件化 |
| 2026-05-08 | PM区分 PM1 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | PM-2019-Spring-PM1 / PM-2024-Fall-PM1 の空 subQuestions 単独設問を公式解答付きの子設問へ正規化 |
| 2026-05-08 | PM-2017-Spring-PM1 / PM-2019-Spring-PM1 の Mermaid 日本語円形ノードを描画ルールに合わせて引用化 |
| 2026-05-08 | PM-2019-Spring-PM1 の複数字数制限設問を1回目/2回目の子設問へ分割し、PM区分の multipleLimits を0件化 |
| 2026-05-08 | SA区分 PM1/PM2 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | SA-2017-Fall-PM1 / SA-2019-Fall-PM1 / SA-2021-Spring-PM1 の空 subQuestions 単独設問を公式解答付きの子設問へ正規化 |
| 2026-05-08 | SA-2018-Fall-PM1 / SA-2022-Spring-PM1 の Mermaid 日本語円形ノードを描画ルールに合わせて引用化 |
| 2026-05-08 | ST-2017-Fall-PM1 の複数字数制限設問を特徴/事業戦略の子設問へ分割し、ST区分の multipleLimits を0件化 |
| 2026-05-08 | SC区分 PM/PM1/PM2 の親見出し explanation を子設問側へ集約済みの構造へ整理 |
| 2026-05-08 | SC-2022-Fall-PM2 qNo=2 の入れ子 subQuestions を表示可能な一段構造へフラット化 |
| 2026-05-08 | SC-2018-Fall-PM1 / SC-2019-Spring-PM1 / SC-2022-Fall-PM1 の空 subQuestions 単独設問を公式解答付きの子設問へ正規化 |
| 2026-05-08 | SC区分の Mermaid 日本語円形ノードを描画ルールに合わせて引用化 |
| 2026-05-08 | SC区分 PM/PM1/PM2 の本文内解答群を answerChoices に構造化し、symbolNoStructuralChoices を 87件から56件へ削減 |
| 2026-05-08 | SC区分 PM1/PM2 の複数字数制限設問を項目別の子設問へ分割し、multipleLimits を0件化 |
| 2026-05-08 | 新形式午後画面で answerChoices を持つ小問を選択式UIへ分岐し、択一はラジオ、複数選択はチェックボックスで採点・記録するよう修正 |
| 2026-05-08 | DB / AU / SM / ES の抽出前状態を再監査し、DB/ESはraw PDFあり、AU/SMは公式URL同期とPDF取得から必要であることを記録 |
| 2026-05-08 | DB-2025-Fall-PM1 の抽出パイロットを再実行し、全3大問・公式解答55件・監査0件の transformed データを追加 |
| 2026-05-08 | ES-2025-Fall-PM1 の抽出パイロットを実行し、午後解答OCRプロンプト修正後に全2大問・公式解答33件・監査0件の transformed データを追加 |
| 2026-05-09 | SA-2024-Spring-PM1 qNo=1 設問1(2) の字数制限なし短答が800字原稿用紙欄に見える事象を調査し、PM/PM1では明示字数なし設問を公式解答例の約1.2倍の表示用原稿用紙欄へ分岐、監査に `shortAnswerNoLimit` を追加 |
| 2026-05-09 | 受講者想定の午後回答 E2E fixture を追加し、テスト答案入力、下書き保存、採点結果表示、ゲスト履歴保存、再読み込み復元を検証するフローを追加 |
| 2026-05-09 | 受講者想定E2Eで検出した `question.id` 欠落時の `undefined` 下書きキー・保存IDを、`examId-qNo` 基底ID生成へ修正 |
| 2026-05-09 | E2E エビデンス報告書が過去画像全件を再掲しないよう、今回実行開始後に生成されたスクリーンショットだけへ絞り込み |
| 2026-05-09 | FE-2024-Public-PM の英語混入データを公式PDFベースの日本語本文・選択肢・解説へ補正し、監査に `englishTextFragments` を追加 |
| 2026-05-09 | AI抽出は Gemini API ではなく同一ローカルネットワーク上の Ollama `gemma4:31b` を標準とする方針へ更新 |
| 2026-05-09 | SC-2017-Spring-PM1 qNo=1 の図1・図4関連設問について、公式解答PDFに基づき記号解答・項番・SYN/SYN-ACK経路を補正 |
| 2026-05-11 | 全午後 `PM/PM1/PM2` の answer / explanation 欠落を補完。公式解答が未同期の箇所は捏造せず「公式解答未同期」、PM2論述式は「固定解答なし」と明示し、監査に欠落検出を追加 |
| 2026-05-11 | SC区分の高優先残件を公式PDF照合で個別補正し、`underlineRefMissing` を0件化。`SC-2018-Fall-PM1` / `SC-2017-Spring-PM1` / `SC-2018-Fall-PM2` / `SC-2024-Spring-PM` / `SC-2024-Fall-PM` / `SC-2020-Fall-PM1` / `SC-2017-Fall-PM2` の公式解答・解答群・下線根拠を同期 |
| 2026-05-11 | `SC-2021-Spring-PM1` qNo=1 の OAuth 図2・図3参照設問3件について、既存図表の公式由来ラベルを `answerChoices` に構造化し、SC記号選択肢残件を13件へ削減 |
| 2026-05-11 | `SC-2022-Spring-PM2` / `SC-2022-Fall-PM2` の設問文内に明記された解答群3件を `answerChoices` に構造化し、SC記号選択肢残件を10件へ削減 |
| 2026-05-11 | `SC-2018-Spring-PM1` / `SC-2019-Fall-PM2` の既存図表に明記された解答群3件を `answerChoices` に構造化し、SC記号選択肢残件を7件へ削減 |

## 1. 目的

本計画書は、午後問題ページで発生している次の不備を、AP / SA だけでなく全試験区分へ横断的に修正するための作業計画を定義する。

- 設問に `下線①` などの参照があるが、問題文側に対応する下線・参照番号・表が存在しない
- 親設問や見出しが誤って800字の原稿用紙欄として表示される
- PM / PM1 の短答・式・表中属性回答が、字数制限なしのため800字の原稿用紙欄として表示される
- 記号回答問題で解答群が表示されない、または問題ごとの解答群ではない
- 複数の字数条件が1つの解答欄へ混在し、回答単位が不明になる
- DB / AU / SM / ES など、ローカルに午後 `*-PM*` データ自体が存在しない区分がある

## 2. 現在の確認結果

### 2.1 ローカル午後データの存在状況

`packages/data/data/questions/*-(PM|PM1|PM2)` を基準に確認した結果、ローカルに午後データが存在する区分は次のとおり。

| 区分 | 状態 | 備考 |
|------|------|------|
| AP | 既存データあり | 起点不具合あり。下線・解答群・複数字数条件の補正が必要 |
| SA | 既存データあり | 起点不具合あり。親見出しの800字欄化抑止が必要 |
| PM | 既存データあり | PM1を中心に親見出し・下線参照の補正が必要 |
| SC | 既存データあり | 件数・複合リスクが最大。下線、記号、図表参照の公式PDF照合が必要 |
| ST | 既存データあり | PM1を中心に親見出しの800字欄化リスクが高い |
| NW | 既存データあり | `NW-2025-Spring-PM2` で下線・親見出しリスクあり |
| FE | 既存データあり | 選択式中心。午後記述補正ではなく選択肢本文の復元が必要 |
| DB | 最新年度パイロット済み | `DB-2025-Fall-PM1` を抽出・変換・正規化済み。過年度展開はパイロット結果を基準に段階実施 |
| AU | 最新年度パイロット済み | `AU-2025-Fall-PM1` / `AU-2025-Fall-PM2` を公式PDFから抽出・変換・正規化済み。過年度展開は後続PRで段階実施 |
| SM | 最新年度パイロット済み | `SM-2025-Spring-PM1` / `SM-2025-Spring-PM2` を公式PDFから抽出・変換・正規化済み。過年度展開は後続PRで段階実施 |
| ES | 最新年度パイロット済み | `ES-2025-Fall-PM1` を抽出・変換・正規化済み。過年度展開はパイロット結果を基準に段階実施 |

### 2.2 監査基準

本対応では `scripts/audit-afternoon-data-quality.mjs` を追加し、次の観点を機械的に検出する。

| 監査観点 | 検出目的 |
|----------|----------|
| 下線参照 | `下線①` などの設問参照と本文側の対応漏れを検出する |
| 親見出し欄 | 子設問を持つ説明だけの親設問が800字欄になるリスクを検出する |
| 複数字数条件 | 1設問内に複数の字数条件があり、解答欄分割が必要な箇所を検出する |
| 記号回答 | `choices` / `options` / `answerChoices` 欠落と、設問文内解答群欠落を検出する |
| 広い設問 | `〜について答えよ` 形式で字数条件がなく、親見出し扱いが疑われる箇所を検出する |
| 未抽出区分 | DB / AU / SM / ES など、ローカル午後データが存在しない区分を検出する |
| 英語混入 | AI抽出結果由来の英語設問文・説明文が午後データへ混入していないかを検出する |
| 回答・解説欠落 | `answer` / `modelAnswer` 等の回答欄と `explanation` が空のまま残っていないかを検出する |

### 2.4 answer / explanation 欠落補完の確認結果

2026-05-11 に `scripts/complete-afternoon-missing-fields.mjs` を追加し、`packages/data/data/questions/*-(PM|PM1|PM2)` の優先問題ファイル（`questions_transformed.json`、なければ `questions_raw.json`）を対象に欠落補完を実施した。

補完前の読み取り専用監査では、午後問題ディレクトリ118件、優先問題ファイル118件、大問253件、UI解答欄基準1,576件を確認し、JSON構文エラー0件、問題文欠落0件、回答欠落328件、解説欠落673件を検出した。

補完は公式根拠なしに模範解答を生成しない方針で実施した。PM2論述式のように固定模範解答が存在しない設問には「論述式・固定解答なし」を明示し、公式解答PDFがローカルデータへ未同期の設問には「自動補完・公式解答未同期」を明示した。解説欠落には、回答欄の状態に応じて「自動補完」表記付きの学習ガイド文を追加した。

適用結果は次のとおり。

| 項目 | 件数 |
|------|------:|
| 変更対象ファイル | 89 |
| PM2論述式として回答補完 | 207 |
| 公式解答未同期として回答補完 | 121 |
| 解説自動補完 | 673 |

補完後の再監査では、午後問題ディレクトリ118件、JSON構文確認ファイル354件、優先問題ファイル118件、大問253件、解答欄1,576件に対して、JSON構文エラー0件、回答欠落0件、解説欠落0件であることを確認した。

### 2.5 SC区分 公式PDF個別補正の確認結果

2026-05-11 に、回答・解説補完後も残っていた SC 区分の高優先リスクを、公式問題PDF・公式解答PDF・ローカル公式由来テキストで照合しながら個別補正した。

対象とした主な補正は次のとおり。

| examId | 補正内容 |
|--------|----------|
| `SC-2018-Fall-PM1` | qNo=1/2/3 の公式解答不一致、解答群未構造化、下線①/③/④の本文・図表根拠不足を補正 |
| `SC-2017-Spring-PM1` | qNo=2/3 の公式解答不一致、SAML 図1のラベル、解答群未構造化、下線②の本文根拠不足を補正 |
| `SC-2018-Fall-PM2` | qNo=1/2 の NIST CSF・インシデント対応設問の公式解答、解答群、下線④/⑦の本文・図3根拠を補正 |
| `SC-2024-Spring-PM` | qNo=1 の JWT / WAF / Log4Shell 検証関連の公式解答、図5・図8注記を補正 |
| `SC-2024-Fall-PM` | qNo=1 のインシデントレスポンス設問(5)〜(8)を公式解答へ補正 |
| `SC-2020-Fall-PM1` | qNo=1/3 の公式解答不一致、解答群未構造化、下線③/④の診断計画レビュー根拠を補正 |
| `SC-2017-Fall-PM2` | qNo=1 設問3(10) の動画暗号化設問について、下線⑪根拠と公式解答を補正 |

また、`scripts/audit-afternoon-data-quality.mjs` は、`SC-2024-Spring-PM` / `SC-2024-Fall-PM` のような「トップレベルが単一大問オブジェクトで、その中に `questions` 配列を持つ」JSON形状を、設問配列ではなく大問1件として正規化するよう修正した。この監査ロジック修正により、トップレベル `context` を参照できず下線不足として検出される偽陽性を防止する。

再監査では、午後問題ディレクトリ118件、大問253件、解答欄1,577件に対して、回答欠落0件、解説欠落0件、`underlineRefMissing=0` を確認した。`SC-2021-Spring-PM1` qNo=1 の図2・図3参照設問3件、`SC-2022-Spring-PM2` / `SC-2022-Fall-PM2` の設問文内解答群3件、及び `SC-2018-Spring-PM1` / `SC-2019-Fall-PM2` の既存図表解答群3件を追加構造化した後、`symbolNoStructuralChoices` は 7 件残っており、次バッチで公式PDF照合を継続する。

### 2.3 公式ソース監査の確認結果

`.github/skills/exam-data-management/scripts/official-source-coverage-audit.mjs --json --categories=DB,AU,SM,ES` を実行し、公式年度別 HTML から DB / AU / SM / ES の午後 PDF が検出されることを確認した。

確認時点では `OFFICIAL_EXAM_NOT_IN_EXAM_LIST` と `OFFICIAL_EXAM_MISSING_LOCAL_QUESTIONS` が合計約116件検出され、代表例として `SM-2018-Fall-PM2`、`SM-2018-Fall-PM1`、`SM-2019-Fall-PM2`、`SM-2019-Fall-PM1`、`SM-2022-Spring-PM2` が挙がった。
このため、DB / AU / SM / ES はローカル監査だけでなく公式To-Be上も未整備として扱い、既存JSON補正ではなく公式PDF取得からの抽出工程で進める。

2026-05-08 の再監査では、DB / AU / SM / ES のローカル午後 `questions` ディレクトリはいずれも0件であった。`packages/data/data/raw_pdfs/` には DB が50件、ESが50件存在する一方、AU / SM は0件であった。公式ソース監査は `officialQuestionExamCount=117`、`missingLocalQuestionCount=116`、`missingLocalAnswerCount=116`、`missingExamListCount=57` を検出しているため、DB / ES は既存PDFから抽出を開始し、AU / SM は公式URL同期とPDF取得を先に行う。

DB-2025-Fall-PM1 の初回 Gemini 抽出パイロットでは、問題側が大問1のみ、解答側が52項目という不一致になった。これを受けて午後OCRプロンプトと抽出スクリプトを複数大問前提の JSON array 出力へ修正し、再抽出で qNo=1/2/3 の全3大問を取得した。解答PDFは `--answers-only` で再抽出し、公式解答55件を取得した。

変換工程では、Gemini APIキーをローテーションし `packages/data/.env` も読むようにして `API_KEY_INVALID` による停止を回避した。生成後は親見出し explanation を削除し、`answers_raw.json` の公式解答を子設問へ同期した。DB区分監査は `files=1`、`answerFields=18`、`broadPromptNoLimit=0`、`parentDirectWithChildren=0`、`multipleLimits=0`、`symbolNoStructuralChoices=0`、`underlineNoEvidence=0`、`underlineRefMissing=0` である。

追加データは `packages/data/data/questions/DB-2025-Fall-PM1/` に保存し、`questions_raw.json`、`answers_raw.json`、`questions_transformed.json` の3ファイルを追跡対象とする。初期変換失敗時のログは追跡対象に含めない。

ES-2025-Fall-PM1 の抽出パイロットでは、問題PDFから qNo=1/2 の全2大問を取得した。初回の `answers_raw.json` は1件のみで、原因は `gemini_answer_ocr_prompt.md` が午前択一表を前提としていたことだった。プロンプトを午後記述式解答に対応させて再抽出した結果、公式解答33件を取得した。生成後は親見出し explanation を削除し、公式解答を子設問へ同期した。ES区分監査は `files=1`、`answerFields=19`、`broadPromptNoLimit=0`、`parentDirectWithChildren=0`、`multipleLimits=0`、`symbolNoStructuralChoices=0`、`underlineNoEvidence=0`、`underlineRefMissing=0` である。

AU / SM の最新年度パイロットでは、`exam-list.ts` へ IPA 公式の問題PDF・解答PDF URLを登録し、`AU-2025-Fall-PM1`、`AU-2025-Fall-PM2`、`SM-2025-Spring-PM1`、`SM-2025-Spring-PM2` の `questions_raw.json`、`answers_raw.json`、`questions_transformed.json` を追加した。生成後は PM1 の公式解答をリーフ設問へ同期し、PM2 の出題趣旨は模範解答として同期しない。親見出しの `explanation` は削除した。午後監査では AU が2ファイル・5大問・21解答欄、SM が2ファイル・5大問・27解答欄となり、`parentDirectWithChildren`、`broadPromptNoLimit`、`multipleLimits` などの構造リスクは0件である。

公式ソース監査で午後だけを確認する場合は、`--types=PM,PM1,PM2` を指定する。AM2 は今回の午後データ品質PRのスコープ外であり、AU/SM AM2 の未整備は後続スコープとして扱う。

## 3. 修正方針

### 3.1 既存データあり区分

AP / SA / PM / SC / ST / NW / FE は、ローカルデータを基点に次の順で修正する。

1. 監査結果から P0 / P1 対象を抽出する
2. 公式PDFで本文、表、下線、図表、解答群、字数条件を照合する
3. `questions_transformed.json` を受験者の回答単位へ正規化する
4. 記号回答は問題ごとの解答群として構造化し、広すぎる共通選択肢を使わない
5. 複数字数条件は解答欄を分割し、1入力欄に複数回答を詰め込まない
6. 公式根拠がない解答例や選択肢は生成しない

### 3.2 未抽出区分

DB / AU / SM / ES は、午後 `*-PM*` のローカルデータが存在しないため、次の抽出工程から開始する。

1. `exam-list.ts` と公式年度別HTMLで対象年度・季節・試験区分を確定する
2. raw PDF を取得し、`audit:raw-pdfs` で PDF 実体を検証する
3. Ollama `gemma4:31b` で `questions_raw.json` / `answers_raw.json` を生成する
4. 公式PDF画像で下線、図表、表、解答群、字数条件を spot check する
5. `questions_transformed.json` を作成し、アプリ表示用の解答欄へ正規化する
6. Cosmos 同期は dry-run とユーザー承認後に限定する

抽出順序は、ローカルPDFが揃っている DB / ES を先行し、AU / SM は公式ソース監査結果を `exam-list.ts` に同期してから Stage A（PDF取得・検証）へ進める。全区分を一括でOCRしない。まず各区分の最新年度1試験で `questions_raw.json` / `answers_raw.json` / `questions_transformed.json` の形を確定し、監査を通してから年度を広げる。

### 3.3 UI共通修正

データ修正と並行して、次の UI 再発防止を入れる。

- 子設問を持つ親設問は、親に `answer` または `modelAnswer` が明示されている場合だけ直接解答欄化する
- `explanation` だけの親設問は設問グループ見出しとして扱い、800字欄を作らない
- 記述式のリーフ設問は原稿用紙形式を維持する
- 記号回答や短答式は、データ側の解答群・字数条件が整った後に選択式/短答式 UI へ分岐させる

## 4. 実施フェーズ

| Phase | 内容 | 完了条件 | コミット単位 |
|-------|------|----------|--------------|
| 0 | ブランチ分離・計画書作成 | `fix/exam-data-quality-all-types` で作業し、計画書をコミット | `docs: 全区分午後データ品質修正計画を追加` |
| 1 | 共通UI修正 | 親見出しの800字欄化が単体テストで防止される | `fix: 午後親見出しの余分な解答欄を抑止` |
| 2 | 監査基盤追加 | `npm run audit:afternoon-data` で全区分監査結果が出る | `chore: 午後データ品質監査を追加` |
| 2.5 | 公式ソース監査対象拡張 | DB / AU / SM / ES の公式午後PDFが To-Be として検出される | `chore: 公式ソース監査の午後対象区分を拡張` |
| 3 | AP / SA 起点データ修正 | 起点URLの下線・解答群・親見出し欄が解消される | 小さな examId 単位でコミット |
| 4 | PM / SC / ST / NW / FE 代表修正 | 監査結果の P0 代表例を区分ごとに解消 | 区分または examId 単位でコミット |
| 5 | DB / AU / SM / ES 抽出計画具体化 | 公式PDF対象一覧、raw PDF状態、抽出順序が確定 | `docs: 未抽出午後区分の抽出計画を更新` |
| 6 | 検証・証跡 | unit/build/self-inspect、必要に応じ E2E evidence が完了 | `test:` または `docs:` コミット |

## 5. 検証計画

### 5.1 自動検証

| コマンド | 目的 |
|----------|------|
| `npm run audit:afternoon-data` | 全区分の午後データ品質リスクを集計する |
| `npm run test:unit` | UI判定、既存API、フックを含む単体回帰確認 |
| `npm run build` | Next.js / TypeScript / package build の統合確認 |
| `pwsh .github/hooks/self-inspect.ps1 -Mode end -FailOnFinding` | 既知デグレの再発防止確認 |
| `node scripts/guard-exam-data-fallback.mjs` | 午後データ fallback 防壁確認 |

### 5.2 ブラウザ検証

E2E は UI 変更または代表データ修正の完了時に実行する。実行した場合は、リポジトリルールに従い `docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md` と `apps/web/e2e/evidence/` のスクリーンショットを必ずコミットする。

受験者想定の検証観点は次のとおり。

- 設問文の `下線①` から本文中の下線箇所へ戻れる
- 記号回答問題で、問題ごとの解答群が表示される
- 記述式は原稿用紙形式で、字数制限が設問と一致する
- 親見出しが余分な解答欄として表示されない
- 複数字数条件は回答単位ごとに分割されている

## 6. 承認ゲートと禁止事項

### 6.1 ユーザー承認が必要な操作

- DB / AU / SM / ES など未抽出区分の大量抽出開始
- Ollama `gemma4:31b` 以外のAI抽出手段を使う大量OCR
- Cosmos DB への dry-run 以外の apply
- staging / production 反映
- E2E フルスイート実行と証跡コミット範囲の確定

### 6.2 禁止事項

- 公式PDF根拠なしに解答群や模範解答を捏造しない
- 全設問に同一の広すぎる `ア〜ソ` を一律付与しない
- `main` へ直接コミット・push・merge しない
- ダッシュボード配色修正ブランチの差分を本対応へ混ぜない
- Cosmos DB 本番 apply をユーザー承認なしに実行しない

## 7. 現時点の残課題

- AP-2025-Spring-PM qNo=1 の表示 spot check（表2・解答群・下線根拠・設問3/4分割は公式PDFに基づき補正済み）
- AP-2022-Fall-PM qNo=1 の表示 spot check（親見出し explanation 削除により余分な親解答欄リスクを補正済み）
- SA-2024-Spring-PM1 qNo=2 の表示 spot check（下線①〜⑤の本文根拠と公式解答同期は補正済み）
- SA-2024-Spring-PM1 qNo=3 の表示 spot check（表2・下線①〜④の本文根拠と公式解答同期は補正済み）
- AP-2023-Spring-PM qNo=1 の表示 spot check（親見出し explanation 削除により余分な親解答欄リスクを補正済み）
- FE-2023-Public-PM の表示 spot check（解答群から `answerChoices` への構造化は補正済み）
- FE-2022-Sample-PM の表示 spot check（解答群から `answerChoices` への構造化は補正済み）
- AP-2024-Spring-PM qNo=1 の表示 spot check（親見出し explanation 削除により余分な親解答欄リスクを補正済み）
- AP-2024-Fall-PM qNo=1 の表示 spot check（親見出し explanation 削除により余分な親解答欄リスクを補正済み）
- AP区分 PM の表示 spot check（親見出し explanation / 直下集約回答削除により parentDirectWithChildren を区分内 0 件化）
- AP-2020-Fall-PM / AP-2021-Fall-PM の単独設問表示 spot check（空 subQuestions を既存解答付きの子設問に正規化し、self-inspect R17 を解消）
- AP区分 PM の選択式表示 spot check（本文または親設問本文に明示された解答群を `answerChoices` に構造化し、残る12件は公式PDF確認が必要な手動対象として維持）
- NW-2025-Spring-PM2 の表示 spot check（親見出し explanation 削除により余分な親解答欄リスクを補正済み）
- ST区分 PM1/PM2 の表示 spot check（親見出し explanation 削除により broadPromptNoLimit / parentDirectWithChildren を区分内 0 件化）
- ST-2017-Fall-PM1 / ST-2019-Fall-PM1 の単独設問表示 spot check（空 subQuestions を 1 件の子設問に正規化し、self-inspect R17 を解消）
- ST-2017-Fall-PM1 qNo=4 の複数字数制限表示 spot check（特徴40字/事業戦略15字を別解答欄に分割し、ST区分の multipleLimits を0件化）
- PM区分 PM1 の表示 spot check（親見出し explanation 削除により broadPromptNoLimit / parentDirectWithChildren を区分内 0 件化）
- PM-2019-Spring-PM1 / PM-2024-Fall-PM1 の単独設問表示 spot check（空 subQuestions を 1 件の子設問に正規化し、self-inspect R17 を解消）
- PM-2019-Spring-PM1 qNo=1 の複数字数制限表示 spot check（1回目30字/2回目35字を別解答欄に分割し、PM区分の multipleLimits を0件化）
- SA区分 PM1/PM2 の表示 spot check（親見出し explanation 削除により broadPromptNoLimit / parentDirectWithChildren を区分内 0 件化）
- SA-2017-Fall-PM1 / SA-2019-Fall-PM1 / SA-2021-Spring-PM1 の単独設問表示 spot check（空 subQuestions を公式解答付きの子設問に正規化し、self-inspect R17 を解消）
- SA区分 PM1 の複数字数制限表示 spot check（受講者条件/講座開催タイミング、問題点/解決策などの項目別解答欄へ分割し、SA区分の multipleLimits を0件化）
- SC区分 PM/PM1/PM2 の表示 spot check（親見出し explanation 削除と入れ子設問フラット化により broadPromptNoLimit / parentDirectWithChildren を区分内 0 件化）
- SC-2018-Fall-PM1 / SC-2019-Spring-PM1 / SC-2022-Fall-PM1 の単独設問表示 spot check（空 subQuestions を公式解答付きの子設問に正規化し、self-inspect R17 を解消）
- SC区分 PM/PM1/PM2 の選択式表示 spot check（本文または親設問本文に明示された解答群を `answerChoices` に構造化し、残る56件は公式PDF確認が必要な手動対象として維持）
- SC区分 PM1/PM2 の複数字数制限表示 spot check（CORS項目、調査内容/手法、手段/問題などの項目別解答欄へ分割し、SC区分の multipleLimits を0件化）
- SA-2024-Spring-PM1 qNo=1 の表示 spot check（親見出しはUI抑止済み、公式解答同期済み）
- SC-PM1/PM2 の下線・記号回答・図表参照の高リスク箇所の公式PDF照合
- FE-2024-Public-PM の選択肢本文復元
- DB/ES過年度・AU/SM公式PDF取得の段階抽出計画具体化
- 受験者想定 E2E のシナリオ追加