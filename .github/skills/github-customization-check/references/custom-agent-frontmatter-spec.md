# Custom Agent / Skill Frontmatter Spec Excerpt

この抜粋は 2026-04-29 時点の公式ドキュメント確認結果に基づく。

## VS Code Custom Agent Header

出典: VS Code Docs `Custom agents in VS Code`。

| 属性 | 仕様 |
|---|---|
| `description` | Custom Agent の短い説明。Chat 入力欄の placeholder として表示される。 |
| `name` | Custom Agent 名。未指定の場合はファイル名が使われる。 |
| `argument-hint` | Chat 入力欄に表示する任意のヒントテキスト。 |
| `tools` | この agent で利用可能なツールまたは tool set 名のリスト。built-in tools、tool sets、MCP tools、extension tools を指定できる。MCP サーバー配下の全ツールは `<server>/*` 形式。利用できないツール名は無視される。 |
| `agents` | subagent として利用できる agent 名のリスト。`*` は全 agent、`[]` は subagent 禁止。指定する場合は `tools` に `agent` を含める。 |
| `model` | prompt 実行時の AI model。単一文字列または優先順位付き配列。未指定の場合は model picker の現在選択モデル。 |
| `user-invocable` | agent dropdown に表示するかを制御する boolean。既定は `true`。 |
| `disable-model-invocation` | 他 agent から subagent として呼び出されることを防ぐ boolean。既定は `false`。 |
| `infer` | Deprecated。`user-invocable` と `disable-model-invocation` を使う。 |
| `target` | 対象環境。`vscode` または `github-copilot`。 |
| `mcp-servers` | `target: github-copilot` で使う MCP server config。 |
| `handoffs` | agent 間遷移の候補。応答後に handoff button として表示される。 |
| `handoffs.label` | handoff button の表示文字列。 |
| `handoffs.agent` | 遷移先 agent identifier。 |
| `handoffs.prompt` | 遷移先 agent に渡す prompt。 |
| `handoffs.send` | prompt を自動送信する boolean。既定は `false`。 |
| `handoffs.model` | handoff 実行時の model。`Model Name (vendor)` 形式。例: `GPT-5 (copilot)`, `Claude Sonnet 4.5 (copilot)`。 |
| `hooks` | Preview。agent に scoped された hook commands。`chat.useCustomAgentHooks` が必要。 |

## GitHub Custom Agents Configuration

出典: GitHub Docs `Custom agents configuration`。

| 属性 | 型 | 仕様 |
|---|---|---|
| `name` | string | 表示名。任意。 |
| `description` | required string | custom agent の目的と capabilities の説明。 |
| `target` | string | `vscode` または `github-copilot`。未指定なら両方。 |
| `tools` | list of strings / string | 利用可能な tools。未指定なら全 tools。`tools: []` は全 tools 無効。 |
| `model` | string | 実行時 model。未指定なら default model を継承。 |
| `disable-model-invocation` | boolean | cloud agent が context に基づき自動選択することを無効化。未指定なら `false`。 |
| `user-invocable` | boolean | ユーザーが手動選択できるか。未指定なら `true`。 |
| `infer` | boolean | Retired。`disable-model-invocation` と `user-invocable` を使う。 |
| `mcp-servers` | object | custom agent 用の追加 MCP servers。VS Code / IDE custom agents では未使用。 |
| `metadata` | object | string key/value の注釈。VS Code / IDE custom agents では未使用。 |

本文 prompt は YAML frontmatter の下に記述し、最大 30,000 文字。

## Agent Skill Header

出典: VS Code Docs `Use Agent Skills in VS Code`。

| 属性 | 必須 | 仕様 |
|---|---:|---|
| `name` | Yes | lowercase letters、numbers、hyphens のみ。parent directory 名と一致。最大 64 文字。slashes、colons、dots、namespace prefixes は不可。 |
| `description` | Yes | skill が何をし、いつ使うかの説明。Copilot が skill をいつ load するか判断できるよう具体化する。最大 1024 文字。 |
| `argument-hint` | No | slash command として invoke した時に chat input に表示する hint text。 |
| `user-invocable` | No | slash command menu に表示するか。既定は `true`。 |
| `disable-model-invocation` | No | 関連性に基づく自動 load を無効化するか。既定は `false`。 |

追加ファイル（scripts、examples、resources 等）は skill directory 配下に置けるが、agent に拾わせるには `SKILL.md` から相対パスで参照する。