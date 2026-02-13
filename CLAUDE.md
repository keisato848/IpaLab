# CLAUDE.md - Claude Code エージェント指示書

このファイルは Claude Code エージェントがこのリポジトリで作業する際のルールを定義します。
`.github/copilot-instructions.md` と併せて遵守すること。

## 言語

- すべての対話、コメント、ドキュメント、コミットメッセージは**日本語**で作成すること。

## テストルール

### ユニットテスト

- フレームワーク: Vitest
- 実行コマンド: `npm run test:unit`
- テストディレクトリ: `apps/web/__tests__/`

### E2E テスト

- フレームワーク: Playwright
- 実行コマンド: `npm run test:e2e`
- テストディレクトリ: `apps/web/e2e/`
- 設定ファイル: `apps/web/playwright.config.ts`

### E2E テスト エビデンス報告書（必須）

**E2E テストを実行した場合、マークダウン形式のエビデンス報告書の作成は必須である。省略は認めない。**

#### 報告書の保存先・テンプレート

```
報告書: docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md
テンプレート: docs/04_reports/E2E_Test_Evidence_Report_TEMPLATE.md
```

テンプレートをコピーして `{YYYYMMDD}` 部分を実行日に置換し、各プレースホルダ `{...}` を埋めること。

#### 報告書に含める必須セクション

1. **エグゼクティブサマリー**
   - テストフレームワーク名・バージョン
   - テストファイル数、総テスト数、成功数、失敗数、成功率
   - 実行時間
   - 対象ブランチ名、PR番号

2. **変更概要**
   - 今回の変更内容の要約（何をテスト対象としたか）

3. **テストシナリオ一覧**
   - 全テストケースを表形式で記載
   - 各行に: テストID、シナリオ名、結果（Pass/Fail）
   - テスト仕様ファイルごとにグループ化する

4. **スクリーンショットエビデンス（画像埋め込み必須）**
   - `apps/web/e2e/evidence/` に保存されたスクリーンショットを**マークダウン画像構文で埋め込む**
   - GitHub 上で画像が直接表示されるよう、相対パス形式を使用すること
   - ファイル名形式: `{ISO_TIMESTAMP}_{テストID}_{説明}.png`
   - 実行日時のタイムスタンプでフィルタし、最新実行分のみを記載

5. **結論**
   - テスト結果の総括
   - 変更がUIに悪影響を与えていないかの判断

#### スクリーンショット埋め込みルール

**画像は必ず GitHub 上で表示される形式で埋め込むこと。ファイル名のみの記載は不可。**

```markdown
<!-- 単独画像 -->
![D-01](../../apps/web/e2e/evidence/{TIMESTAMP}_D-01.png)

<!-- 比較画像（テーブルで横並び） -->
| ライト | ダーク |
|:---:|:---:|
| ![light](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_LIGHT.png) | ![dark](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_DARK.png) |
```

- 報告書からの相対パス: `../../apps/web/e2e/evidence/`
- 同一テストIDで複数画像がある場合（D-02 のライト/ダーク等）はテーブルで横並びに表示
- 比較画像のテーブルヘッダーは中央揃え `|:---:|` を使用

#### スクリーンショットファイルの git 管理

- `apps/web/e2e/evidence/` 配下のスクリーンショットは **git 追跡対象**（`.gitignore` で除外しない）
- E2E テスト実行後、スクリーンショットファイルもコミットに含めること

#### テスト仕様ファイル一覧

| ファイル | テスト ID | 内容 |
|----------|----------|------|
| `e2e/dark-theme.spec.ts` | D-01 〜 D-10 | ダークテーマ表示・切替・永続化・CSS変数検証 |
| `e2e/error-cases.spec.ts` | E-01 〜 E-09 | 404、OAuthエラー、XSS耐性、アクセシビリティ |
| `e2e/top-to-login.spec.ts` | ― | トップページ→ログイン→ゲスト利用フロー |

#### エビデンスキャプチャヘルパー

テスト内でスクリーンショットを取得する際は `captureEvidence()` を使用する:

```typescript
import { captureEvidence } from './helpers/evidence';

// テスト内で呼び出し
await captureEvidence(page, testInfo, 'E-01_404_page');
```

#### 報告書作成のタイミング

以下に該当する PR では E2E エビデンス報告書の作成が**必須**:

- UI に影響する変更（CSS、コンポーネント、レイアウト）
- テーマ・アクセシビリティに関する変更
- E2E テスト仕様自体の変更
- 新規ページ・機能の追加
- インフラ・CI/CD 変更のリグレッションテスト

#### PR 本文へのレポートリンク記載（必須）

E2E テストを実行した PR では、PR 本文に**エビデンス報告書へのリンクを必ず記載**すること。

```markdown
## E2E テストエビデンス報告書

| 実行日 | 報告書 |
|--------|--------|
| {YYYY-MM-DD} | [{ファイル名}](docs/04_reports/{ファイル名}) |
```

- リンク形式: リポジトリルートからの相対パス `docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md`
- テスト結果セクションの直後、Test plan セクションの直前に配置する
- 過去のテスト実行分の報告書がある場合も含めて記載する

## Git ブランチ運用

- main ブランチへの直接コミット・プッシュは禁止
- フィーチャーブランチを作成し、PR 経由でマージする
- エージェントが勝手に main にマージすることは禁止
- 詳細は `.github/copilot-instructions.md` を参照

## Azure リソースの実装・調査ルール

Azure リソースに関する実装、設定変更、障害調査、デプロイ作業を行う際は、
**以下の 2 つの MCP サーバーを必ず最初に参照すること**。

| MCP サーバー | 用途 | 使用タイミング |
|-------------|------|---------------|
| **Azure MCP** (`mcp_azure_mcp_*`) | Azure リソースの状態確認・操作・ベストプラクティス取得 | リソース設定確認、診断、CLI コマンド生成、デプロイ時 |
| **Microsoft Learn MCP** (`mcp_microsoft-lea_microsoft_docs_search`) | 公式ドキュメント検索・コードサンプル取得 | 設定方法の確認、トラブルシューティング、ベストプラクティス調査時 |

### 必須ワークフロー

1. Azure MCP の `bestpractices` ツールでベストプラクティスを取得
2. Microsoft Learn MCP で公式ドキュメントを検索し、最新の推奨手順を確認
3. Azure MCP の各サービス専用ツール（`appservice`、`monitor`、`cosmos` 等）でリソース状態を確認
4. 上記の情報に基づいて実装・修正を行う

**推測や記憶に頼らず、必ず MCP サーバー経由で最新情報を取得すること。**

## Git 管理対象外ファイルのルール

調査・デバッグ作業で生成する一時ファイルは **git 追跡対象外**とする。

### 管理対象外のファイルパターン

| パターン | 用途 |
|---------|------|
| `debug_*.js`, `debug-*.js` | デバッグ用スクリプト |
| `test-models.js` | モデルテスト用スクリプト |
| `run_log*.txt`, `test_result.txt` | 実行ログ |
| `logs*.json`, `logs*.txt`, `amps.json` | 調査用ログデータ |
| `temp-logs/`, `temp-logs.zip` | Azure ログダウンロード |
| `appservice-logs/`, `*appservice-logs.zip` | App Service ログ |
| `appsettings-backup*.json` | App Service 設定バックアップ |
| `tmpclaude*` | Claude Code 一時ファイル |

### 運用ルール

1. **新規作成時**: 上記パターンに従う命名で作成すること。`.gitignore` に登録済み
2. **誤ってコミットしない**: `git add .` を使わず、対象ファイルを明示的に指定する
3. **既存の追跡ファイルの削除**: 既に git 追跡されている一時ファイルは `git rm --cached <ファイル>` で追跡を解除すること
4. **調査結果の保存**: 調査結果を恒久的に保存する場合は `docs/` 配下に報告書として整理する

## 設計書の同期更新

アプリケーションコードを改修した際は `docs/` 配下の設計書も同時に更新すること。
詳細は `.github/copilot-instructions.md` を参照。
