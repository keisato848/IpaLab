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

3. **ブランチをプッシュ**
   ```bash
   git push -u origin <ブランチ名>
   ```

4. **プルリクエストとマージ**
   - ブランチをプッシュした後は、**GitHub上でプルリクエストを作成**
   - **エージェントが勝手にmainブランチにマージすることは禁止**
   - ユーザーの明示的な承認を得てからマージすること
   
   マージが承認された場合のみ、以下を実行：
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
