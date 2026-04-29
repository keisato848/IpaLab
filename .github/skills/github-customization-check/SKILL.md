---
name: github-customization-check
description: >
  .github 配下の Agent Skills、Custom Agents、Prompt Files、Hooks を機械的に検証し、
  旧ツール名、壊れた YAML frontmatter、MCP ツール直書き、未登録 hook、
  スキルレベル品質ゲートの不足を検出する。Use when .github カスタマイズを
  修正した後、hook で自動検証したい時、または Harness 監査前に構文・規約を確認したい時。
metadata:
  author: coreclaw
  version: "1.0"
---

# GitHub Customization Check

.github 配下のエージェント、プロンプト、hooks、skills を deterministic に検証するスキル。
Anthropic の public skills と同様に、`SKILL.md`、`scripts/`、`examples/` を 1 つのスキルパッケージとして自己完結させる。

## 使用する場面

- `.github/agents/*.agent.md`、`.github/prompts/*.prompt.md`、`.github/assets/prompts/*.prompt.md` を編集した後
- `.github/skills/*/SKILL.md` を追加または更新した後
- hook 設定を変更し、機械チェックが必ず実行されることを確認したい時
- Harness 7軸レビュー前に、構文・旧記法・品質ゲート不足を先に潰したい時

## チェック方法

1. 手動検証では次を実行する。
   `pwsh .github/skills/github-customization-check/scripts/validate-github-customizations.ps1 -Mode manual -FailOnFinding`
2. hook 検証では `.github/hooks/security.json` の `SessionStart` と `Stop` から同じスクリプトを実行する。
3. 失敗した場合はレポートの Rule、File、Detail を確認し、該当ファイルを修正して再実行する。
4. findings が 0 件になるまで繰り返し、0 件になった状態のみ完了とする。

## 検出ルール

- hook JSON が厳密 JSON として解析でき、`version: 1`、PascalCase イベント、`command`/`windows` を持つこと
- `security.json` が `github-customization-check` の validator を `SessionStart` と `Stop` で呼び出すこと
- `.agent.md` / `.prompt.md` / `SKILL.md` の frontmatter が壊れていないこと
- frontmatter `description` が 1024 文字以内であること
- `model` に現在選択できない旧モデル名を指定していないこと
- Custom Agent の本文 prompt が 30,000 文字以内であること
- top-level `tools` には公式エイリアス、`*`、または正規の MCP/extension tool 名（`server/tool`、`server/*`）のみを使うこと
- `search/codebase`、`edit/editFiles` など旧テンプレート由来の tool 名を使わないこと
- Prompt File で triple-brace input 形式を使わず、`${input:name:説明}` 形式を使うこと
- Skill は `name` とフォルダ名が一致し、500行以内、Gotchas 3項目以上、Quality Gates、検証ループを持つこと

## 出力フォーマット

検証レポートの標準形を確認する場合のみ `examples/validation-report.md` を読む。

公式 frontmatter 属性仕様を確認する場合のみ `references/custom-agent-frontmatter-spec.md` を読む。

## Quality Gates

- [ ] validator が `.github` 配下を再帰的に走査する
- [ ] hook から validator が `SessionStart` と `Stop` の両方で実行される
- [ ] findings がある場合、`-FailOnFinding` で非ゼロ終了する
- [ ] hook JSON の trailing comma などを厳密 JSON エラーとして検出できる
- [ ] Custom Agent の prompt 30,000 文字制限を検出できる
- [ ] 出力が Rule / Severity / File / Detail を含む表形式である
- [ ] 既知の旧記法（非公式 tools、triple-brace input、廃止済み model 名）を検出できる
- [ ] description 1024 文字制限と旧 model 名を検出できる

## Gotchas

- `tools` フィールドを省略すると全ツール許可になる。制限したい時だけ公式エイリアスで明示する
- top-level `tools` の MCP/extension tool 名は `server/tool` または `server/*` 形式。`mcp-servers` 配下の `tools` は MCP サーバー側の公開設定であり、役割が異なる
- Prompt File の `${input:name:説明}` は VS Code 公式形式。triple-brace input は旧テンプレート由来で発火しない
- hook は指示ではなく強制チェック。validator が常時失敗する状態で厳格化すると、以後の作業開始時に詰まる
- 例示フォーマットは `examples/` に置き、`SKILL.md` には「いつ読むか」を条件付きで書く

## 検証ループ

1. validator を `-FailOnFinding` 付きで実行する
2. findings があれば該当ファイルを修正する
3. 同じ validator を再実行する
4. findings 0 件を確認する
5. `grep_search` で旧記法（triple-brace input、MCP ツール直書き、旧ツール名、廃止済み MCP 表記）が残っていないことを確認する