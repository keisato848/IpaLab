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
*   **確認方法**: `data/raw_pdfs` ディレクトリに新しいファイル（例: `ST-2019-Fall-PM1.pdf`）が作成されていることを確認してください。

### ステージ B: データの抽出 (抽出処理)

Gemini API を使用して、PDFからテキストと構造データを抽出します。

```bash
npm run extract -w packages/data
```
*   **注意**: この処理は、追加した試験の量に応じて**数分〜数十分**かかります。
*   **確認方法**: ログに `Saved raw Questions` / `Saved raw Answers` と表示されるのを待ちます。
*   **重要**: この処理が完全に終了するまで、次のステージに進まないでください。

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
