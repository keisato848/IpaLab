# Copilot エージェント指示書

このファイルはGitHub Copilotエージェントがこのリポジトリで作業する際のルールを定義します。

## 言語

- すべての対話、コメント、ドキュメントは**日本語**で作成してください。

## Git ブランチ運用ルール

**重要**: mainブランチへの直接コミット・プッシュは禁止です。

### 必須ワークフロー

1. **フィーチャーブランチを作成**
   ```bash
   git checkout -b feature/<機能名>
   # または
   git checkout -b fix/<修正内容>
   ```

2. **変更をコミット**
   ```bash
   git add <ファイル>
   git commit -m "<type>: <説明>"
   ```

3. **プッシュ前にローカルテストを実行**
   - **重要**: `git push` の前に必ずローカルでテストを実行し、全テストがパスすることを確認すること
   - Husky の pre-push フックにより自動実行されるが、事前に手動で確認することを推奨
   ```bash
   # ユニットテスト
   npm run test:unit
   
   # E2Eテスト（開発サーバーが起動している状態で実行）
   npm run test:e2e
   ```
   - テストが失敗した場合はプッシュが自動的に中止される
   - `--no-verify` オプションでのフックスキップは原則禁止

4. **ブランチをプッシュ**
   ```bash
   git push -u origin <ブランチ名>
   ```

5. **プルリクエストの作成**
   - ブランチをプッシュした後は、**GitHub CLI (`gh pr create`) でプルリクエストを作成**
   - **エージェントが勝手にmainブランチにマージすることは禁止**
   - ユーザーの明示的な承認を得てからマージすること
   
   ```bash
   gh pr create --title "<type>: <説明>" --body "<詳細説明>" --base main
   ```

6. **コンフリクトの解消**
   - PRでコンフリクトが発生した場合は、以下の手順で解消すること：
   ```bash
   git fetch origin main
   git merge origin/main
   # コンフリクトを手動で解消
   git add <解消したファイル>
   git commit -m "fix: マージコンフリクトを解消"
   git push
   ```

7. **CI/CDパイプラインの確認**
   - PRを作成した後は、**CI/CDパイプラインの結果を必ず確認**
   - エラーが発生した場合は、エラー内容を確認して修正
   ```bash
   gh pr checks <PR番号>
   gh run list --limit 5
   gh run view <run-id> --log-failed
   ```

8. **マージ（ユーザー承認後のみ）**
   - マージが承認された場合のみ、以下を実行：
   ```bash
   git checkout main
   git pull origin main
   git merge <ブランチ名>
   git push
   ```

### ブランチ命名規則

| プレフィックス | 用途 |
|---------------|------|
| `feature/` | 新機能の追加 |
| `fix/` | バグ修正 |
| `refactor/` | リファクタリング |
| `docs/` | ドキュメント更新 |
| `chore/` | 設定変更、依存関係更新 |

### コミットメッセージ規則

```
<type>: <説明>
```

- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント
- `chore`: その他の変更
- `style`: コードスタイルの変更

## 開発プロセスルール

### 設計書の同期更新

**重要**: アプリケーションコードを改修した際は、必ず `docs/` 配下の設計書・手順書も同時に更新すること。

#### 更新が必要なケース

| 改修内容 | 更新対象設計書 |
|----------|---------------|
| 新機能追加 | 要件定義書、該当する詳細設計書 |
| API変更 | 該当するAPI設計書、インターフェース仕様書 |
| デプロイ手順変更 | `02_design/06_DeploymentDesign.md` |
| Azure リソース変更 | `01_planning/azure_config/` 配下の該当ファイル |
| 設定ファイル変更 | `02_design/01_ConfigurationDesign.md` |
| AI機能変更 | `ai-planner-design.md` |

#### 更新フロー

1. コード改修と同じブランチで設計書も更新
2. コミットメッセージで両方の変更を明記（例: `feat: 新機能追加 + 設計書更新`）
3. プルリクエストで設計書の整合性を確認

#### チェックリスト

改修作業完了前に以下を確認すること：

- [ ] 改修内容が既存の設計書に矛盾していないか？
- [ ] 新たに追加した機能の設計書を作成/更新したか？
- [ ] 変更履歴セクションを更新したか？
- [ ] アーキテクチャ図が最新の構成を反映しているか？

## E2E テスト エビデンス報告書

### 必須ルール

**E2E テストを実行した場合、マークダウン形式のエビデンス報告書の作成は必須である。省略は認めない。**

### 報告書の保存先・テンプレート

```
報告書: docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md
テンプレート: docs/04_reports/E2E_Test_Evidence_Report_TEMPLATE.md
```

テンプレートをコピーして `{YYYYMMDD}` 部分を実行日に置換し、各プレースホルダを埋めること。

### 報告書の5セクション構成

1. **エグゼクティブサマリー** — フレームワーク、テスト数、成功率、実行時間、ブランチ、PR番号
2. **変更概要** — テスト対象の変更内容の要約
3. **テストシナリオ一覧** — テストID、シナリオ名、結果を表形式で記載
4. **スクリーンショットエビデンス** — 画像埋め込み形式でキャプチャを記載（下記ルール参照）
5. **結論** — テスト結果の総括と UI 影響判断

### スクリーンショット埋め込みルール（重要）

**画像は必ず GitHub 上で表示される形式で埋め込むこと。ファイル名のみの記載は不可。**

```markdown
<!-- 単独画像 -->
![D-01](../../apps/web/e2e/evidence/{TIMESTAMP}_D-01.png)

<!-- 比較画像（テーブルで横並び） -->
| ライト | ダーク |
|:---:|:---:|
| ![light](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_LIGHT.png) | ![dark](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_DARK.png) |
```

- 報告書 (`docs/04_reports/`) からの相対パス: `../../apps/web/e2e/evidence/`
- 同一テストIDで複数画像がある場合はテーブルで横並びに表示
- テーブルヘッダーは中央揃え `|:---:|` を使用

### スクリーンショットファイルの git 管理

- `apps/web/e2e/evidence/` 配下のスクリーンショットは **git 追跡対象**
- E2E テスト実行後、スクリーンショットファイルもコミットに含めること

### 報告書作成が必須となる PR

- UI に影響する変更（CSS、コンポーネント、レイアウト）
- テーマ・アクセシビリティに関する変更
- E2E テスト仕様自体の変更
- 新規ページ・機能の追加
- インフラ・CI/CD 変更のリグレッションテスト

### PR 本文へのレポートリンク記載（必須）

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

## デプロイ

- **Azure Static Web Apps**: mainブランチへのプッシュで自動デプロイ
- **Azure Functions (api-ai)**: 手動デプロイ (`func azure functionapp publish`)

## プロジェクト構造

```
apps/
├── web/          # Next.js フロントエンド (Azure SWA)
└── api-ai/       # Azure Functions (US East 2 - Gemini API用)
packages/
├── data/         # データ管理パッケージ
├── shared/       # 共有ユーティリティ
└── ui/           # 共有UIコンポーネント
```

## AI API アーキテクチャ

### プロキシ構成

```
[ユーザー] → [shikaku-no.com (East Asia)]
                    ↓
           [Next.js API Route: /api/ai/plan]
                    ↓ (プロキシ)
           [func-pm-exam-dx-ai-us.azurewebsites.net (US East 2)]
                    ↓
           [Gemini API]
```

### 使用モデル

| 優先度 | モデル名 | 用途 |
|--------|----------|------|
| Primary | `gemini-3-flash-preview` | メイン |
| Fallback | `gemini-2.5-flash` | フォールバック |

### 環境変数 (api-ai)

| 変数名 | 説明 |
|--------|------|
| `GEMINI_API_KEY` | Google AI Studio APIキー |
| `COSMOS_DB_CONNECTION` | CosmosDB接続文字列（メトリクス保存用） |

## 本番環境 / Staging環境

| 環境 | リソース | URL / 名前 | リージョン |
|------|----------|------------|------------|
| **本番** | フロントエンド (App Service) | https://shikaku-no.com | East Asia |
| **本番** | AI Function App | func-pm-exam-dx-ai-us | US East 2 |
| **本番** | CosmosDB | pm-exam-dx-db | East Asia |
| **Staging** | フロントエンド (App Service) | https://app-pm-exam-dx-staging.azurewebsites.net | East Asia |
| **Staging** | CosmosDB | pm-exam-dx-staging-db | East Asia |

**Staging環境**: PRマージ前の動作確認に使用。PRプッシュ時に自動デプロイされ、PR上にURLがコメントされる。
本番・Stagingとも同一 App Service Plan (`asp-pm-exam-dx-prod`, B1 Linux) に同居（追加費用なし）。

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

### 対象となる作業例

- App Service / Azure Functions の設定変更・デプロイ
- Application Insights のテレメトリ調査・設定
- CosmosDB の接続・クエリ関連
- Azure Static Web Apps の構成
- Bicep / ARM テンプレートの作成・変更
- Azure CLI コマンドの生成・実行
- Azure リソースの障害調査・トラブルシューティング

## Issue 自動修復（Copilot Coding Agent）

AI アシスタントの障害報告機能から自動起票された Issue は、Copilot Coding Agent が自動的に修正 PR を作成する。

### 自動修復フロー

```
[ユーザー] → 障害報告 → [Issue 自動起票 (ai-assistant-report)]
                              ↓
                    [copilot-autofix.yml]
                              ↓
                    [Copilot Coding Agent にアサイン]
                              ↓
                    [修正ブランチ + PR 自動作成]
                              ↓
                    [CI テスト → 人間レビュー → マージ]
```

### Copilot Coding Agent がバグ修正する際のガイドライン

1. **Issue 本文を精読**: 報告内容、ページ URL、スクリーンショットから問題を特定
2. **関連コードを検索**: ページ URL からコンポーネント・ルートを逆引き
3. **テストを確認**: 既存テストの有無を確認し、修正後もテストが通ることを保証
4. **最小限の変更**: バグ修正に必要な最小限の変更のみ実施
5. **ブランチ命名**: `fix/<Issue内容の要約>` 形式

### 対象ラベル

| ラベル | 説明 |
|--------|------|
| `ai-assistant-report` | AI アシスタントから自動起票された障害報告（自動修復対象） |
| `copilot-autofix` | Copilot Coding Agent による自動修復が割り当てられた Issue |
| `bug` | バグ報告全般 |

### 手動トリガー

自動起票以外の Issue でも、`ai-assistant-report` ラベルを追加すれば Copilot が自動アサインされる。

## 注意事項

- **Gemini API の地域制限**: US リージョンからのみ呼び出し可能（East Asia からは `User location is not supported` エラー）
- フロントエンドから AI 機能を使う場合は必ず `/api/ai/plan` を経由（直接 Gemini API を呼ばない）
- api-ai のデプロイ後は Function App の再起動が必要な場合あり
