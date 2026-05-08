# Copilot Agent カスタマイズ設計書

## 変更履歴

| 日付 | 版 | 変更内容 |
|------|----|----------|
| 2026-04-29 | 1.0 | 初版作成（2026-04-29 公式ドキュメントに準拠した監査結果を反映） |
| 2026-04-29 | 1.1 | Git 履歴に基づく Scrum Team Custom Agents とルーティングを追加 |
| 2026-04-29 | 1.2 | PM 一元受付と SIer 型フェーズゲート、PM 用 Prompt Files を追加 |
| 2026-05-02 | 1.3 | VS Code hooks 公式イベント `SessionStart` / `SubagentStart` / `SubagentStop` に基づく agent activity logging、データ管理 Skill、データ管理/セキュリティ specialist agent を追加 |

---

## 1. 概要

本ドキュメントは、GitHub Copilot エージェントのカスタマイズ設定（Custom Agents、Prompt Files、Agent Skills、Hooks、MCP）の設計方針と配置ルールを定義する。2026-04-29 時点の VS Code 公式ドキュメントおよび GitHub.com 公式ドキュメントに準拠する。

---

## 2. 公式配置ルール一覧

| 種別 | 配置パス | 拡張子 | スコープ |
|------|---------|--------|----------|
| Custom Agent | `.github/agents/*.agent.md` | `.agent.md` | VS Code ワークスペース / GitHub.com cloud |
| Prompt File | `.github/prompts/*.prompt.md` | `.prompt.md` | VS Code ワークスペース |
| Agent Skill | `.github/skills/<name>/SKILL.md` | `.md` (固定) | VS Code ワークスペース |
| Hook 設定 | `.github/hooks/*.json` | `.json` | VS Code ワークスペース |
| MCP（VS Code） | `.vscode/mcp.json` | `.json` | VS Code ワークスペース |
| MCP（cloud） | `.github/agents/*.agent.md` の `mcp-servers` | frontmatter | GitHub.com cloud agent |
| Workflow | `.github/workflows/*.yml` | `.yml` | GitHub Actions CI/CD |

---

## 3. VS Code Custom Agent vs GitHub.com Copilot Coding Agent

### 3.1 プロファイル分離方針

本プロジェクトでは **GitHub.com Copilot Coding Agent（cloud agent）** と **VS Code Custom Agent** を単一の `.agent.md` ファイルで共用する。ただし、各ファイルは以下のルールを遵守すること。

| 属性 | VS Code Custom Agent | GitHub.com Copilot Coding Agent |
|------|--------------------|-------------------------------|
| ファイル拡張子 | `.agent.md` | `.agent.md`（同一） |
| `tools` 使用可能値 | 任意（tool aliases、tool sets、MCP/extension tools） | `read` `edit` `search` `execute` `agent` `web` `todo`、`*`、`server/tool`、`server/*` |
| `handoffs` | 有効 | 無視される |
| `mcp-servers` | `.vscode/mcp.json` を優先、frontmatter も可 | frontmatter で指定 |
| `argument-hint` | 有効 | 無視される |
| `disable-model-invocation` | 有効 | N/A |

**結論**: `.agent.md` の `tools` フィールドには公式エイリアス（`read` / `edit` / `search` / `execute` / `agent` / `web` / `todo`）、`*`、または正規の MCP/extension 形式（`server/tool`、`server/*`）のみを記載する。旧テンプレート由来の `search/codebase`、`edit/editFiles`、`runCommands` などは使用しない。VS Code 専用の高度な設定が必要な場合は `handoffs`、`argument-hint` を使用する。

### 3.2 tools フィールド 正・誤対照

| ❌ 非公式（使用禁止） | ✅ 公式エイリアス |
|----------------------|----------------|
| `editFiles`, `readFiles` | `edit`, `read` |
| `runCommands` | `execute` |
| `read_file`, `edit_file`, `write_file` | `read`, `edit` |
| `grep_search`, `list_directory` | `search` |
| `run_terminal_command` | `execute` |

---

## 4. Agent Frontmatter 仕様

### 4.1 必須フィールド

```yaml
---
name: <スキル名（フォルダ名と一致）>
description: >
  何をするか + USE FOR / DO NOT USE FOR で構成する日本語説明
tools:
  - read      # 公式エイリアス、または必要に応じて server/tool 形式
  - search
  - edit
  - execute
---
```

### 4.2 オプションフィールド

| フィールド | 型 | 説明 |
|-----------|------|------|
| `model` | string / array | 使用モデルを固定。VS Code では単一文字列または優先順位付き配列。例: `Claude Sonnet 4.6 (copilot)` |
| `user-invocable` | bool | `false` で @エージェント名での直接呼び出しを禁止 |
| `disable-model-invocation` | bool | `true` でサブエージェントのモデル推論を無効化 |
| `argument-hint` | string | `#agent` 呼び出し時のヒントテキスト（VS Code のみ有効） |
| `handoffs` | list | 他エージェントへの引き継ぎ定義（VS Code のみ有効） |
| `mcp-servers` | list | このエージェント専用の MCP サーバー設定 |

### 4.3 handoffs 正しいインデント

```yaml
handoffs:
  - label: 表示テキスト
    agent: agent-name
    prompt: 送信するプロンプト
    send: true
```

> ⚠️ `-` の直後と `label`/`agent`/`prompt`/`send` は同じインデントレベルにすること。

---

## 4.4 PM 一元受付と Scrum Team Custom Agents

ユーザーからの依頼はすべて `project-manager` が一次受付する。スクラムチーム自体は構成するが、品質確保のため、進行はウォーターフォール型 SIer プロジェクトと同等のフェーズゲートで管理する。

専門 agent は原則として `user-invocable: false` を設定し、PM からの handoff を受けて作業する。これにより、依頼の入口、影響評価、承認条件、成果物定義を PM に集約する。

Git 履歴（v0.24〜v0.29 系）では、ダッシュボード UI デグレ、学習計画/再計画、午後試験 AI 採点、Cosmos/試験データ fallback、Azure/App Service/Functions、E2E evidence、hooks/self-inspect が繰り返し変更されている。そのため、実装用 Custom Agents は以下の Scrum Team として構成する。

| Agent | 主担当 | Git 履歴からの根拠 |
|---|---|---|
| `project-manager` | 全依頼の一次受付、フェーズ計画、承認ゲート、担当割り当て | 横断 PR が多く、要件・設計・検証・出荷の抜けを PM で統制する必要がある |
| `product-owner` | 要求、優先順位、受け入れ基準 | 学習計画、採点、ダッシュボードなど機能単位の PR が継続 |
| `scrum-master` | Phase ゲート、作業分担、PR 準備 | main 直接 push 禁止、E2E evidence、self-inspect 運用 |
| `solution-architect` | Next.js/Azure/Cosmos/AI 横断設計 | App Service、api-ai、Cosmos、Gemini 地域制限の複合構成 |
| `frontend-learning-engineer` | 学習 UI、ダッシュボード、試験 UI | Performance Insights、カード配置、採点結果 UI、差分ハイライト |
| `backend-data-engineer` | API、Cosmos、試験データ防壁 | ensureContainer、fallback guard、StudyPlan 永続化、PerformanceProfile |
| `data-management-specialist` | IPA 問題データ抽出、登録、Cosmos dry-run/同期 | `exam-list.ts`、ローカル JSON 監査、qNo=99 旧プレースホルダー削除計画 |
| `ai-scoring-engineer` | 午後試験 AI 採点、Gemini、SSE | 採点 API v2、ルーブリック、SSE、CLKS/論述評価 |
| `devops-sre-engineer` | Azure、CI/CD、hooks、監視 | App Service startup、Functions deploy、workflow YAML、repository guards |
| `qa-evidence-engineer` | Vitest、Playwright、E2E 証跡 | custom-report、E2E evidence policy、UI 回帰テスト |
| `security-observability-engineer` | セキュリティ、ログ、再発防止 | R2 console.error、Application Insights、CodeQL、gh pr merge 禁止 hook |
| `security-agent` | security alerts、secret scanning、機微情報レビュー | GitHub alerts、Dependabot、CodeQL、Cosmos 操作ログ、secret 出力禁止 |

### PM ルーティング方針

1. 新規依頼は必ず `project-manager` → `product-owner` → `solution-architect` → 担当実装 agent → `qa-evidence-engineer` → `scrum-master` → `project-manager` の順で進める。
2. `project-manager` は Phase 0〜6 の現在位置、成果物、承認ゲート、担当 agent を明示する。
3. UI 変更は `frontend-learning-engineer` と `qa-evidence-engineer` を必ず通し、E2E evidence 要否を判定する。
4. Cosmos/試験データ変更は `backend-data-engineer` を通し、fallback guard と standalone tracing を確認する。
5. IPA データ抽出・登録・再同期は `data-management-specialist` を通し、apply 前に `security-agent` のレビューを必ず受ける。
6. Azure/CI/CD 変更は `devops-sre-engineer` と `security-observability-engineer` を通し、公式ドキュメントと禁止操作を確認する。
7. AI 採点変更は `ai-scoring-engineer` を通し、Gemini 地域制限、schema 検証、設計書同期を確認する。
8. 仕様変更や割り込みが発生した場合は `project-manager` が変更管理票を作成し、承認後に計画を更新する。

### PM フェーズゲート

| Phase | 名称 | 主担当 | 必須成果物 |
|---|---|---|---|
| 0 | 受付・起票 | `project-manager` | 依頼受付票、影響領域、担当候補 |
| 1 | 要件定義 | `product-owner` | 要件、受け入れ基準、スコープ外、未解決事項 |
| 2 | 基本設計 | `solution-architect` | 方式設計、影響範囲、設計書更新先 |
| 3 | 詳細設計・WBS | `project-manager` / `scrum-master` | WBS、担当、検証計画、リスク |
| 4 | 実装 | 専門 agent | 変更差分、自己レビュー |
| 5 | 単体・結合検証 | `qa-evidence-engineer` | テスト結果、guard、E2E evidence |
| 6 | 受入・出荷 | `project-manager` / `scrum-master` | PR、CI 結果、残リスク、ユーザー承認 |

### PM Prompt Files

| Prompt | 用途 |
|---|---|
| `.github/prompts/pm-request-intake.prompt.md` | 依頼受付票を作成し、PM が Phase 0 を完了する |
| `.github/prompts/pm-phase-gate-review.prompt.md` | 各フェーズの Go / Conditional Go / No Go を判定する |
| `.github/prompts/pm-change-control.prompt.md` | 進行中の仕様変更、割り込み、スコープ変更を変更管理する |

---

## 5. Hooks 設計

### 5.1 イベント名（PascalCase）

| イベント | タイミング |
|---------|-----------|
| `SessionStart` | セッション開始時 |
| `UserPromptSubmit` | ユーザープロンプト送信前 |
| `PreToolUse` | ツール実行前 |
| `PostToolUse` | ツール実行後 |
| `PreCompact` | コンテキスト圧縮前 |
| `SubagentStart` | サブエージェント起動時 |
| `SubagentStop` | サブエージェント終了時 |
| `Stop` | セッション終了時 |

### 5.2 Hook エントリフォーマット

```json
{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "pwsh -NoProfile ...",
        "windows": "pwsh -NoProfile ...",
        "timeout": 30000
      }
    ]
  }
}
```

> ⚠️ `powershell` フィールドは非公式。`command`（全プラットフォーム）または `windows`/`linux`/`osx` を使用すること。

### 5.3 Agent Activity Logging

`.github/hooks/agent-activity.json` は VS Code 公式 hook 形式に従い、`SessionStart`、`SubagentStart`、`SubagentStop` で `.github/hooks/write-agent-activity-log.ps1` を実行する。
ログは `agent_logs/hooks/agent-activity.log` に JSON Lines として追記し、`*.log` として git 管理対象外にする。

記録する情報は以下に限定する。

- UTC タイムスタンプ
- hook event 名
- リポジトリ名
- session id の短い SHA-256 hash
- agent 名または subagent 名の安全化済み token
- prompt、tool input、接続文字列、キー、トークンを除外した hook 入力フィールド名

hook は監査ログ用途であり、失敗しても通常の agent 作業をブロックしない。ただし、secret 出力が疑われる変更は `security-agent` のレビュー対象とする。

---

## 6. Prompt Files 仕様

### 6.1 Input 変数構文

```markdown
<!-- 正しい構文 -->
${input:variableName}
${input:variableName:プレースホルダーテキスト}

<!-- 禁止構文 -->
${{ input:variableName }}   ← GitHub Actions 構文（誤り）
{{{ input }}}               ← Mustache 構文（誤り）
```

### 6.2 frontmatter

```yaml
---
description: プロンプトの説明
tools:
  - read
  - search
---
```

---

## 7. Agent Skills 仕様

### 7.1 配置規則

- パス: `.github/skills/<skill-name>/SKILL.md`
- `name` はフォルダ名と一致させること（小文字英数字とハイフンのみ、最大 64 文字）
- 1 ファイル 500 行以内。超過分は `references/` に分離

### 7.2 必須セクション

| セクション | 内容 |
|-----------|------|
| frontmatter | `name`, `description` |
| Gotchas | 3 項目以上、具体的な落とし穴 |
| Quality Gates | チェックボックス形式の完了条件 |
| 検証ループ | 失敗時リカバリ手順 |

---

## 8. E2E テストエビデンス報告書 必須化ポリシー

### 8.1 方針

`SKIP_EVIDENCE` 環境変数は廃止。すべての E2E テスト実行（CI / ローカル）で報告書を生成する。

### 8.2 自動生成フロー

```
E2E テスト実行
  ↓
apps/web/e2e/reporters/custom-report.ts（Playwright Reporter）
  ↓
docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md を生成
```

### 8.3 custom-report 5 セクション構成

| # | セクション | 内容 |
|---|-----------|------|
| 1 | エグゼクティブサマリー | フレームワーク、テスト数、成功率、実行時間、ブランチ、PR番号 |
| 2 | 変更概要 | テスト対象の変更内容の要約 |
| 3 | テストシナリオ一覧 | テストID、シナリオ名、結果を表形式で記載 |
| 4 | スクリーンショットエビデンス | `../../apps/web/e2e/evidence/` 相対パスで画像埋め込み |
| 5 | 結論 | テスト結果総括と UI 影響判断 |

### 8.4 Quality Gates

- [ ] 未記入プレースホルダー（`{...}`）が存在しない
- [ ] 5 セクションすべてが揃っている
- [ ] 画像リンクが `../../apps/web/e2e/evidence/` 形式を使用している
- [ ] すべての E2E 実行後に報告書が生成されている
- [ ] `SKIP_EVIDENCE` が一切使用されていない

---

## 9. MCP 設定

### 9.1 VS Code ワークスペース MCP

配置先: `.vscode/mcp.json`（`.mcp.json` は非標準）

```json
{
  "servers": {
    "server-name": {
      "type": "stdio",
      "command": "コマンド",
      "args": ["引数"]
    }
  }
}
```

### 9.2 GitHub.com cloud agent MCP

`.agent.md` の frontmatter に `mcp-servers` として記載する。

---

## 10. 既知の問題と対応状況

| ファイル | 問題 | 対応状況 |
|---------|------|---------|
| `.github/hooks/template.json` | `sessionStart`/`sessionEnd`（小文字）、`powershell` フィールド、末尾カンマ | ✅ 修正済み（2026-04-29） |
| `.github/agents/documentation-steward.agent.md` | `handoffs` YAML インデント崩れ | ✅ 修正済み（2026-04-29） |
| `.github/agents/bug-fixer.agent.md` | `editFiles`, `runCommands`（非公式） | ✅ 修正済み（2026-04-29） |
| `.github/agents/document-agent.agent.md` | `editFiles`, `runCommands`（非公式） | ✅ 修正済み（2026-04-29） |
| `.github/agents/harness-reviewer.md` | 拡張子が `.md`（正式は `.agent.md`） | ✅ リネーム済み（2026-04-29） |
| `.github/agents/skill-developer.md` | 拡張子が `.md`、非公式 tool names | ✅ リネーム・修正済み（2026-04-29） |
| `.github/prompts/sync-cosmosdb.prompt.md` | `${{ input:x }}` 構文（GitHub Actions 記法） | ✅ 修正済み（2026-04-29） |
| `.github/workflows/playwright.yml` | `SKIP_EVIDENCE: 1` でエビデンスをスキップ | ✅ 削除済み（2026-04-29） |
| `apps/web/e2e/helpers/evidence.ts` | `SKIP_EVIDENCE` フラグによるスキップ分岐 | ✅ 削除済み（2026-04-29） |
| `.github/assets/prompts/*.prompt.md` | `{{{ input }}}` 構文（Mustache 記法）、非公式 tool names | 🔶 未対応（`.github/assets/` は実行可能プロンプトではなくアセット） |
| `.github/skills/skill-scaffolder/SKILL.md` | `.mcp.json`, `tu_tools`, `agents/*.md` など古い仕様 | 🔶 未対応（別タスク） |

---

## 11. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `.github/agents/*.agent.md` | Custom Agent 定義 |
| `.github/hooks/*.json` | セッションフック設定 |
| `.github/prompts/*.prompt.md` | 再利用可能プロンプト |
| `.github/skills/*/SKILL.md` | Agent Skills |
| `.vscode/mcp.json` | VS Code MCP サーバー設定 |
| `apps/web/e2e/reporters/custom-report.ts` | E2E エビデンス報告書 Playwright レポーター |
| `apps/web/e2e/helpers/evidence.ts` | スクリーンショットキャプチャヘルパー |
| `docs/04_reports/E2E_Test_Evidence_Report_TEMPLATE.md` | 報告書テンプレート |
