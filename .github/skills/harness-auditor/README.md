# harness-auditor

Harness 7軸フレームワークによる Agent Skills 品質評価・スコアリングと改善ガイダンス。

## 機能

Agent Skills とその周辺環境（AGENTS.md、Custom Agents、assets、references、MCP 設定）を Harness 7軸フレームワークで監査する。優先度付きの改善提案を含むスコアリングレポートを生成する。

## 使用場面

- リリース前にスキルやスイートの品質を評価したい
- スキルが性能不足や未起動の原因を診断したい
- マージ前・コミット前の品質チェックを実施したい
- Harness 成熟度をスコアリングしたい（Beginner → Intermediate → Advanced → Expert）

## 7軸の評価項目

| # | 軸 | 評価内容 |
|---|-----|--------|
| 1 | Tool Coverage | description の品質、キーワード棲み分け、WHEN/DO ルーティング、Agent→軸マッピング |
| 2 | Context Efficiency | SKILL.md の行数、条件付き参照、assets/references の活用 |
| 3 | Quality Gates | 検証ループ、失敗時リカバリ、チェックリスト |
| 4 | Memory Persistence | Gotchas の具体性、学びの収集スキル、コンパクション耐性 |
| 5 | Eval Coverage | バリデーションループ、CI 統合ポイント |
| 6 | Security Guardrails | 禁止事項、データ取り扱い、読み取り専用エージェント |
| 7 | Cost Efficiency | MCP 上限、デフォルトツール、簡潔な設計 |

## スコアリング

- **0**: 未対応
- **1**: 基本対応
- **2**: 良好
- **3**: 優秀

成熟度: Beginner (0–7) / Intermediate (8–14) / Advanced (15–18) / Expert (19–21)

## 出力

軸ごとのスコア、重大度別の指摘事項（🔴/🟡/🟢）、具体的な改善アクションを含む構造化された監査レポートを生成。
