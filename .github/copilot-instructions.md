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

4. **mainブランチにマージ**
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

## 注意事項

- Gemini API は US リージョンからのみ呼び出し可能（East Asia からは利用不可）
- フロントエンド (East Asia) から AI 機能を使う場合は `/api/ai/plan` を経由して US の Function App にプロキシ
