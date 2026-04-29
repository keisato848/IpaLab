# skill-scaffolder

Harness 最適化を組み込んだフルスイート Agent Skills パッケージ生成スキル。

## 機能

単体スキルからフルスイート（AGENTS.md オーケストレーター、Custom Agents、copilot-instructions.md、MCP 設定、補助ディレクトリ含む）まで、完全な Agent Skills パッケージを生成する。

## 使用場面

- 新しい Agent Skill スイートをゼロから作成する
- 単体スキルを Harness パターンでブートストラップする
- スイートインフラ（AGENTS.md、agents/、`.vscode/mcp.json`）を生成する

## 動作の流れ

1. **Phase 0 — Purpose Discovery**: 入力の充足度を評価（8要素）。不足があれば `purpose-discovery` で1問1答ダイアログへ
2. **Phase 1 — パッケージ生成**: メタデータ、AGENTS.md、copilot-instructions、agents、サブスキル、MCP 設定を生成
3. **Phase 2 — 補助ディレクトリ評価**: 各スキルに対して assets/（テンプレート）、references/（詳細定義）、scripts/（バリデーションコード）の必要性を判定。作成して条件付き参照を追加
4. **Phase 3 — Harness 7軸チェック**: 全生成スキルを7軸でスコアリング（3/3 目標）。閾値未満の軸を修正

## 主な機能

- `assets/` に3つの出力テンプレートを用意: AGENTS.md、SKILL.md、copilot-instructions.md
- `references/suite-checklist.md` にスイート完全性チェックリスト
- 補助ディレクトリ判定ガイド（assets/references/scripts を作成する条件）
- 生成後の Harness 7軸バリデーション必須

## 補助ファイル

```
skill-scaffolder/
├── SKILL.md
├── assets/
│   ├── agents-md-template.md
│   ├── skill-md-template.md
│   └── copilot-instructions-template.md
└── references/
    └── suite-checklist.md
```
