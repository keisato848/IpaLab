# Harness Audit Report: `<skill-name>`

## サマリー

- **総合スコア**: `<total>/21`
- **成熟度**: `<Beginner|Intermediate|Advanced|Expert>`
- **対象**: `<skill-or-suite-path>`
- **検証コマンド**: `pwsh .github/skills/github-customization-check/scripts/validate-github-customizations.ps1 -Mode manual -FailOnFinding`

## 軸別スコア

| # | 軸 | スコア | 判定 |
|---|---|---:|---|
| 1 | Tool Coverage | `/3` | `<状態>` |
| 2 | Context Efficiency | `/3` | `<状態>` |
| 3 | Quality Gates | `/3` | `<状態>` |
| 4 | Memory Persistence | `/3` | `<状態>` |
| 5 | Eval Coverage | `/3` | `<状態>` |
| 6 | Security Guardrails | `/3` | `<状態>` |
| 7 | Cost Efficiency | `/3` | `<状態>` |

## 改善提案（優先度順）

| 重大度 | 軸 | 問題 | 提案 |
|---|---|---|---|
| 🔴 高 | `<軸名>` | `<具体的な問題>` | `<実行可能な修正>` |
| 🟡 中 | `<軸名>` | `<具体的な問題>` | `<実行可能な修正>` |
| 🟢 低 | `<軸名>` | `<具体的な問題>` | `<実行可能な修正>` |

## 完了条件

- 全7軸にスコアと根拠がある。
- 🔴 高の指摘が 0 件である。
- 機械検証 `github-customization-check` が成功している。