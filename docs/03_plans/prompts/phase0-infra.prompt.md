## 指示

docs/02_design/18_AiAssistantDesign.md のセクション 4「データベース設計」に基づき、インフラ準備を行ってください。

### タスク

1. `apps/web/lib/cosmos.ts` の `CONTAINER_PARTITION_KEYS` に以下を追加:
   - `AiAssistantUsage: "/userId"`
   - `BugReports: "/userId"`

2. `apps/web/lib/feature-flags.ts` の `DEFAULT_FLAGS` 配列に以下を追加:
   ```ts
   { id: 'ai_assistant_enabled', enabled: false, description: 'AIアシスタントウィジェットの有効化' }
   ```

3. `apps/web/package.json` に以下のパッケージを追加:
   - `html2canvas` (スクリーンショット用)
   - `octokit` (GitHub Issues 起票用)

4. `.env.template` に以下の環境変数を追加:
   - `GITHUB_ISSUES_TOKEN` — GitHub Issues 起票用 PAT
   - `GITHUB_ISSUES_REPO` — 起票先リポジトリ (owner/repo)
   - `AZURE_BLOB_CONNECTION_STRING` — スクリーンショット保存用
   - `AZURE_BLOB_CONTAINER_NAME` — Blob コンテナ名

### 既存コードの参照
- `apps/web/lib/cosmos.ts` — CONTAINER_PARTITION_KEYS の定義箇所を確認して追記
- `apps/web/lib/feature-flags.ts` — DEFAULT_FLAGS 配列の末尾に追加
- `apps/web/app/api/score/route.ts` — 既存の Gemini API 利用パターンを確認（環境変数名の慣例）

### 制約
- 既存のコンテナ定義やフラグを変更しないこと
- 型定義の整合性を維持すること
