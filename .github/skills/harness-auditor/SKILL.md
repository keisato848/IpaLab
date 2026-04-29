---
name: harness-auditor
description: >
  Agent Skills とその環境を Harness 7軸フレームワークで監査する。
  AGENTS.md オーケストレーション、SKILL.md 品質、assets/references の活用、
  MCP 設定、Custom Agent 設計を評価する。
  スキル品質の評価、Harness 成熟度のスコアリング、スキルの性能不足診断、
  リリース前の Harness レビュー実施時に使用する。
metadata:
  author: coreclaw
  version: "2.0"
---

# Harness Auditor

既存の Agent Skills と周辺環境を Harness 7軸フレームワークで監査するスキル。

## 監査手順

1. 対象スキルの SKILL.md を読み込む
2. 以下の 7軸それぞれについてスコアリング（0–3）:

### 軸1: Tool Coverage（ツール網羅性）
- [ ] `description` が具体的で起動条件を含む
- [ ] 関連スキル間で `description` キーワードが重複していない
- [ ] スイート構成の場合、AGENTS.md に WHEN/DO ルーティングが定義されている
- [ ] Custom Agents が適切なツール制限で定義されている
- [ ] MCP 連携が必要な Custom Agent は `mcp-servers` frontmatter または `.vscode/mcp.json` で設定し、top-level `tools` は公式エイリアス、`*`、または正規の `server/tool` 形式のみを使っている
- **スコア**: 0=未対応 / 1=基本対応 / 2=良好 / 3=優秀

### 軸2: Context Efficiency（コンテキスト効率）
- [ ] SKILL.md が 500行以内
- [ ] 参照ファイルへの言及が条件付き（「いつ読むか」明示）
- [ ] Progressive Disclosure パターンに従っている
- [ ] 大量の参照情報が `references/` に分離されている
- [ ] `assets/` テンプレートが適切に活用されている
- **スコア**: 0=未対応 / 1=基本対応 / 2=良好 / 3=優秀

### 軸3: Quality Gates（品質ゲート）
- [ ] 検証ループまたはバリデーション手順が存在
- [ ] PostToolUse Hook 相当の品質チェックが設計されている
- [ ] チェックリストが含まれる
- **スコア**: 0=未対応 / 1=基本対応 / 2=良好 / 3=優秀

### 軸4: Memory Persistence（メモリ永続化）
- [ ] Gotchas セクションが存在し 3項目以上
- [ ] 学びをファイルに書き出す指示がある
- [ ] コンパクション耐性（重要な中間結果のファイル保存）が考慮されている
- **スコア**: 0=未対応 / 1=基本対応 / 2=良好 / 3=優秀

### 軸5: Eval Coverage（評価カバレッジ）
- [ ] 出力の検証基準が明示されている
- [ ] 検証ループで失敗時のリカバリ手順がある
- [ ] CI での `skills-ref validate` 相当のバリデーションがある
- **スコア**: 0=未対応 / 1=基本対応 / 2=良好 / 3=優秀

### 軸6: Security Guardrails（セキュリティガードレール）
- [ ] 禁止事項が明示されている
- [ ] 危険操作の事前チェック機構がある
- [ ] 機密情報の取り扱いルールが定義されている
- **スコア**: 0=未対応 / 1=基本対応 / 2=良好 / 3=優秀

### 軸7: Cost Efficiency（コスト効率）
- [ ] スキル本文が簡潔（冗長な説明がない）
- [ ] エージェントが知らない固有情報のみ記載
- [ ] デフォルトが明示され選択肢が最小化されている
- **スコア**: 0=未対応 / 1=基本対応 / 2=良好 / 3=優秀

3. 総合スコアと改善提案を生成

## 出力テンプレート

固定フォーマットの監査レポートを出す場合は `examples/harness-audit-report.md` を参照する。

```markdown
# Harness Audit Report: <skill-name>

## サマリー
- **総合スコア**: <合計>/21
- **成熟度**: <Beginner|Intermediate|Advanced|Expert>

## 軸別スコア

| # | 軸 | スコア | 判定 |
|---|-----|--------|------|
| 1 | Tool Coverage | /3 | <状態> |
| 2 | Context Efficiency | /3 | <状態> |
| 3 | Quality Gates | /3 | <状態> |
| 4 | Memory Persistence | /3 | <状態> |
| 5 | Eval Coverage | /3 | <状態> |
| 6 | Security Guardrails | /3 | <状態> |
| 7 | Cost Efficiency | /3 | <状態> |

## 改善提案（優先度順）

1. 🔴 **[軸名]**: <具体的な改善アクション>
2. 🟡 **[軸名]**: <具体的な改善アクション>
3. 🟢 **[軸名]**: <具体的な改善アクション>

## 成熟度基準
- Beginner: 0–7 / Expert が必要な軸にスコア0がある
- Intermediate: 8–14 / 全軸でスコア1以上
- Advanced: 15–18 / 全軸でスコア2以上
- Expert: 19–21 / 全軸でスコア2以上かつ半数がスコア3
```

## Gotchas

- スコアリングはスキル単体ではなく Harness 環境全体（AGENTS.md, agents/, copilot-instructions.md, `.vscode/mcp.json`, `mcp-servers` frontmatter）も考慮すべき
- Quality Gates はスキル内の検証ループだけでなく、CI パイプラインの Hooks も評価対象
- Memory Persistence の評価で、Gotchas の「量」だけでなく「具体性」も重要。汎用的すぎる Gotchas はスコア1止まり
- description の評価は「人が読んで分かるか」ではなく「LLM がルーティングできるか」の観点で行う
- スイート構成でルート Orchestrator が SKILL.md になっている場合は AGENTS.md への変更を推奨する
- assets/ が存在するのに SKILL.md から参照されていない場合はスコア減点（死蔵アセット）

## 検証ループ

1. 監査レポートを生成
2. 以下を確認:
   - 全7軸にスコアが付与されているか
   - 改善提案が具体的かつ実行可能か
   - 成熟度判定が基準と整合しているか
3. 不整合がある場合は修正して再生成
4. 整合後のみ完了とする
