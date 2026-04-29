# スイート完全性チェックリスト

生成したスイートの完全性を検証する際にこのリファレンスを読む。

## 必須ファイル

### メタデータ（全スイート必須）
- [ ] `README.md` — グループ説明、バージョン、サブスキル数
- [ ] `group.json` — 名前、説明、アイコン、カウント
- [ ] `skill.json` — 名前、バージョン、説明、entrypoint: "AGENTS.md"

### オーケストレーション（全スイート必須）
- [ ] `AGENTS.md` — WHEN/DO ルーティング、タスク分類、Phase ゲート、緊急度トリアージ、禁止事項、Gotchas、検証ループ

### 指示書（推奨）
- [ ] `copilot-instructions.md` — 言語ルール、ファイル優先ポリシー、検証ループ、エージェントテーブル、Gotchas

### Custom Agents（推奨）
- [ ] ファイルは `agents/*.agent.md`（拡張子は `.agent.md` 必須）
- [ ] `tools` には公式エイリアス（`read`/`edit`/`search`/`execute`/`agent`/`web`/`todo`）、`*`、または正規の `server/tool` 形式のみを使う
- [ ] オーケストレーション用エージェントが最低1体（`read`/`edit`/`search`/`execute`）
- [ ] 読み取り専用監査エージェントが最低1体（`read`/`search` のみ）
- [ ] 各エージェントに: 名前、説明、ツールリスト、役割説明、ワークフロー、制約がある

### サブスキル（必須）
- [ ] 各スキルが `skills/<スイート名>-<接尾辞>/SKILL.md` に配置
- [ ] 各スキルに: name、description（「Use when」含む）、ワークフロー、成果物、Quality Gates、Gotchas（3項目以上）、検証ループ
- [ ] フォルダ名が `name` フィールドと一致
- [ ] 各スキルが500行以内

### MCP（外部ツールが必要な場合）
- [ ] `.vscode/mcp.json` にサーバー設定（VS Code ワークスペース用）
- [ ] cloud agent 用は `.agent.md` の `mcp-servers` frontmatter に記載
- [ ] 関連 SKILL.md に「利用可能ツール（MCP）」セクション
- [ ] MCP 利用不可時のフォールバック手順が記載

### 補助ディレクトリ（必要に応じて）
- [ ] `assets/` テンプレートが SKILL.md から参照されている
- [ ] `references/` ドキュメントが条件付き参照のみ
- [ ] `scripts/` に実行可能なバリデーション/変換コード

## 品質チェック

### Harness 7軸カバレッジ
- [ ] Tool Coverage: WHEN/DO ルーティングが全リクエスト種別をカバー
- [ ] Context Efficiency: 全 SKILL.md が500行以内、条件付き参照
- [ ] Quality Gates: 全スキルに検証ループ
- [ ] Memory Persistence: 全ファイルに Gotchas 3項目以上、学び収集スキル
- [ ] Eval Coverage: 検証ループに失敗時リカバリ
- [ ] Security Guardrails: 禁止事項、データ取り扱いルール
- [ ] Cost Efficiency: スキル間で description キーワードが重複しない

### 命名規約
- [ ] スキル名: 小文字英数字 + ハイフンのみ、64文字以内
- [ ] 先頭/末尾のハイフンなし、連続ハイフンなし
- [ ] スイートプレフィックス: 全サブスキルが `<スイート名>-` プレフィックスを共有
- [ ] フォルダ名 = 全 SKILL.md の `name` フィールドと一致
