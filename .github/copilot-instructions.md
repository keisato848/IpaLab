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

## E2E テスト エビデンスルール

**重要**: E2E テスト実行後は、必ずマークダウン形式のエビデンス報告書を作成すること。

### テスト実行環境

| 項目 | 値 |
|------|-----|
| フレームワーク | Playwright |
| 対象ブラウザ | Chromium (Desktop Chrome) |
| テストディレクトリ | `apps/web/e2e/` |
| スクリーンショット保存先 | `apps/web/e2e/evidence/` |
| テスト結果出力先 | `apps/web/e2e/test-results/` |
| Playwright 設定 | `apps/web/playwright.config.ts` |

### エビデンスキャプチャ

- テスト内で `captureEvidence()` ヘルパー（`e2e/helpers/evidence.ts`）を使用してスクリーンショットを取得する
- スクリーンショットは `apps/web/e2e/evidence/` にタイムスタンプ付きで自動保存される
- ファイル名形式: `{ISO_TIMESTAMP}_{テストID}_{説明}.png`
  - 例: `2026-02-10T13-40-15-625Z_E-01_404_page.png`

### エビデンス報告書の必須要件

E2E テスト実行後、以下の報告書を **必ず** 作成すること：

1. **保存先**: `docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md`
2. **ファイル名**: 実行日をサフィックスに含める
3. **報告書構成**（以下のセクションをすべて含めること）:

   | セクション | 内容 |
   |-----------|------|
   | エグゼクティブサマリー | テスト件数、成功/失敗数、成功率、実行時間 |
   | 変更概要 | 今回のテスト対象となった変更内容の要約 |
   | テストシナリオ一覧 | 全テストケースの ID・シナリオ名・結果・エビデンスリンク |
   | スクリーンショットエビデンス | 各シナリオに対応するスクリーンショットファイル名の一覧 |
   | 結論 | テスト結果の総括 |

4. **報告書の記述ルール**:
   - スクリーンショットファイル名は `apps/web/e2e/evidence/` からの相対参照で記載する
   - 対象ブランチ名と PR 番号を明記する
   - 全テストシナリオを漏れなく記載する（パスしたテストも含む）
   - テスト失敗がある場合は、失敗内容と原因を詳細に記述する

### テスト実行タイミング

以下のタイミングで E2E テストを実行し、エビデンスを残すこと：

- **PR 作成前の `git push` 時**（Husky pre-push フックで自動実行）
- **UI に影響する変更**（CSS、コンポーネント、レイアウト変更）を含む PR
- **テーマ・アクセシビリティに関する変更**を含む PR

### テスト仕様ファイル一覧

| ファイル | テスト ID範囲 | 内容 |
|----------|-------------|------|
| `e2e/dark-theme.spec.ts` | D-01 〜 D-10 | ダークテーマ表示・切替・永続化・CSS変数検証 |
| `e2e/error-cases.spec.ts` | E-01 〜 E-09 | 404、OAuthエラー、XSS耐性、アクセシビリティ |
| `e2e/top-to-login.spec.ts` | ― | トップページ表示→ログイン→ゲスト利用フロー |

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

## 本番環境

| リソース | URL / 名前 | リージョン |
|----------|------------|------------|
| フロントエンド | https://shikaku-no.com | East Asia |
| AI Function App | func-pm-exam-dx-ai-us | US East 2 |
| CosmosDB | pm-exam-dx-db | East Asia |

## 注意事項

- **Gemini API の地域制限**: US リージョンからのみ呼び出し可能（East Asia からは `User location is not supported` エラー）
- フロントエンドから AI 機能を使う場合は必ず `/api/ai/plan` を経由（直接 Gemini API を呼ばない）
- api-ai のデプロイ後は Function App の再起動が必要な場合あり
