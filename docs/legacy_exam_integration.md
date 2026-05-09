# 過去問データ統合手順書

本書は、IPA Lab アプリケーションに新しい試験データ（特に2021年以前の「レガシー試験」や最新の試験）を追加・統合するための手順をまとめたものです。

## 1. データの定義

まず、対象となる試験情報をコードベースに登録します。

### 対象ファイル: `packages/data/src/scraper/exam-list.ts`

以下の手順で `EXAM_LIST` 配列に新しい試験オブジェクトを追加してください。

1.  **試験詳細の特定**:
    *   年度 (Year)
    *   期 (Term): 春期 (Spring) または 秋期 (Fall)
        *   ※2021年以前の SC, SA, ST 等は主に**秋期**に実施されていました。
    *   試験区分 (Category): SA, ST, NW, DB 等
2.  **PDF URLの特定**:
    *   IPA公式サイトから、該当試験の「問題冊子」と「解答例」のPDF URLを取得します。
    *   URLパターン (ハッシュ値部分など) を確認してください (例: `gmcbt8000000...-att`)。
3.  **エントリの追加**:

```typescript
{
    category: 'ST', // 試験区分
    year: 2019,     // 年度
    term: 'Fall',   // 実施時期
    type: 'PM1',    // 試験種別 (AM2, PM1, PM2, AM1)
    url: 'https://www.ipa.go.jp/...' // 問題PDFのURL
}
```

## 2. データパイプラインの実行

定義を追加した後、以下の4つのステージを**順番に**実行します。各ステージが完了するのを待ってから次に進んでください。

### ステージ A: PDFのダウンロード

定義されたURLからPDFファイルをダウンロードし、`packages/data/data/raw_pdfs` に保存します。

```bash
npm run download -w packages/data
```
対象カテゴリを明示して大規模整備する場合は、以下のように `DOWNLOAD_CATEGORIES` を設定します。

```powershell
$env:DOWNLOAD_CATEGORIES = "AP,PM,SC,FE,NW,DB,SA,ES,ST"
npm run download -w packages/data
Remove-Item Env:DOWNLOAD_CATEGORIES
```

ダウンロード後は Stage A の完了ゲートとして、同じカテゴリで PDF 実体監査を実行します。

```powershell
npm run audit:raw-pdfs -w packages/data -- --categories=AP,PM,SC,FE,NW,DB,SA,ES,ST
```

*   **確認方法**: `data/raw_pdfs` ディレクトリに新しいファイル（例: `ST-2019-Fall-PM1.pdf`）が作成されていることに加え、保存物が実際のPDFであることを確認してください。HTML/XML エラーページが `.pdf` として保存されると、後続の OCR で `The document has no pages` が発生します。
*   **運用ルール**: `npm run download -w packages/data` の再実行時は、既存の正常PDFのみをスキップし、PDFヘッダー (`%PDF-`) が無い既存ファイルは再取得対象として扱います。
*   **完了条件**: `audit:raw-pdfs` が `status=RAW_PDF_AUDIT_OK` を返し、`missingQuestionCount=0`、`missingAnswerCount=0`、`invalidPdfCount=0` であること。

### ステージ B: データの抽出 (抽出処理)

AIを使用してPDFからテキストと構造データを抽出する場合は、Gemini API ではなく Ollama の `gemma4:31b` を使用します。Ollama の接続先は `OLLAMA_BASE_URL` または `--base-url` で指定し、GitHub Copilot 側に設定済みの同一ローカルネットワーク上の接続先を使用します。

```bash
npm run extract:questions:ollama -w packages/data -- --model=gemma4:31b
npm run extract:answers:ollama -w packages/data -- --model=gemma4:31b
```
*   **注意**: この処理は、追加した試験の量とモデル応答時間に応じて**数分〜数十分以上**かかります。
*   **Windows 注意**: `npx ts-node ...` を子プロセスから直接呼び出すと `spawnSync npx ENOENT` になる場合があります。抽出は必ず `npm run extract -w packages/data` または `packages/data` 直下で `npm run extract` から実行してください。
*   **確認方法**: ログに `Saved raw Questions` / `Saved raw Answers` と表示されるのを待ちます。
*   **重要**: この処理が完全に終了するまで、次のステージに進まないでください。

解答PDFをローカル抽出する場合は、Ollama Vision 対応モデルを使う `extract:answers:ollama` を利用します。

```powershell
npm run extract:answers:ollama -w packages/data -- --check --model=gemma4:31b
npm run extract:answers:ollama -w packages/data -- --dry-run --limit=3 --model=gemma4:31b
npm run extract:answers:ollama -w packages/data -- --exam-id=AP-2024-Spring-AM --model=gemma4:31b
```

*   **前提**: 同一ローカルネットワーク上の Ollama で `gemma4:31b` が利用できること。
*   **PDF画像化ツール**: Poppler (`pdftoppm` / `pdftocairo`)、MuPDF (`mutool`)、ImageMagick + Ghostscript (`magick`)、または Ghostscript (`gswin64c` / `gs`) のいずれかが PATH から実行できること。
*   **設定**: `OLLAMA_MODEL`、`OLLAMA_BASE_URL`、`OLLAMA_CATEGORIES`、`OLLAMA_EXAM_IDS`、`OLLAMA_PDF_RENDERER` で対象と実行環境を指定できます。
*   **Windows 注意**: `--dry-run` や `--limit` は npm 側の設定として扱われる場合があります。`extract:answers:ollama` は `npm_config_*` も読むため、必ず npm script 経由で実行してください。

AM/AM2 の択一問題PDFをローカルで試験抽出する場合は、`extract:questions:ollama` を使用できます。スキャンPDFや2段組みPDFでは、ページを左右カラムに分割する `--split-columns` と、失敗チャンクをスキップして成功分を保存する `--allow-partial` を併用します。

```powershell
npm run extract:questions:ollama -w packages/data -- --check --model=gemma4:31b
npm run extract:questions:ollama -w packages/data -- --model=gemma4:31b --exam-id=DB-2016-Spring-AM2 --split-columns --allow-partial --debug-dir=../../temp-logs/ollama-debug --render-dpi=85 --num-predict=1024 --timeout-ms=420000
```

*   **位置づけ**: `questions_raw.json` / `answers_raw.json` の AI 抽出は Ollama `gemma4:31b` を標準とし、抽出後は公式PDFとの手動レビューで本文・図表・解答の品質を確認してください。
*   **Gemma 推奨**: `gemma4:31b` は高品質が期待できる一方、1ページ処理でも長時間化・タイムアウトする場合があります。必要に応じて `--chunk-pages`、`--render-dpi`、`--num-predict`、`--timeout-ms` を調整してください。
*   **Qwen 注意**: `qwen3.5:9b` は Vision / thinking capability を持つものの、Ollama の `/api/generate` と `/api/chat` の両方で `response` / `message.content` が空になる事象を確認しました。`format: json` の有無、`options.think=false` の指定でも解消しません。`qwen3.6:27b` も同系統のリスクが高く、サイズ増加により速度面の不利もあるため、この問題が解消されるまで抽出用途では推奨しません。

### ステージ C: データのクレンジング

抽出されたJSONデータの構文エラーを修正し、配点計算やマークダウンの整形を行います。

```bash
npm run cleanse -w packages/data
```
*   **対象**: 現在のスクリプトは `{PM,SC,SA,ST}` などの高度試験区分に対応しています。
*   **確認方法**: ログに `Updated: .../questions_raw.json` や `Successfully repaired` と表示されれば成功です。

### ステージ D: データベースへの同期

クレンジング済みのデータを Azure Cosmos DB に反映します。

```bash
npm run sync-db -w packages/data
```
*   **詳細**: 環境変数の設定など、詳細な同期手順については `docs/azure-sync-guide.md` も参照してください。
*   **確認方法**: ログに `Upserted Exam` および `Upserted X questions` と表示されれば完了です。

## 3. トラブルシューティング

-   **抽出が途中で止まる**: APIのレート制限等により一時停止することがあります。スクリプトには再試行ロジックが含まれていますが、完全に停止した場合は再度 `npm run extract` を実行してください（完了済みのファイルはスキップされます）。
-   **DBに試験名などが反映されない**: 新しい試験区分（例: `NW`）を追加した場合、`sync-db.ts` 内のタイトル変換ロジックに追加が必要な場合があります。
