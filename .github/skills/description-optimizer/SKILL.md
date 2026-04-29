---
name: description-optimizer
description: >
  Agent Skill の description フィールドを最適化し、ルーティング精度と発見精度を最大化する。
  スキルが正しく起動されない、description がスキル間で重複している、
  Tool Coverage スコアを改善したい場合に使用する。
metadata:
  author: coreclaw
  version: "1.0"
---

# Description Optimizer

スキルの `description` フィールドを最適化し、ルーティング精度と発見精度を最大化するスキル。

## 最適化手順

1. 現在の `description` を分析:
   - 「何をするか」が明確か
   - 「いつ使うか（Use when...）」が含まれるか
   - キーワードが具体的か（「Helps with data」は ❌）

2. 同一リポジトリ内の他スキルの `description` と比較:
   - キーワードの重複を検出
   - 起動条件の曖昧な境界を特定
   - 競合するスキルペアをリストアップ

3. 改善版 `description` を生成:
   - 構成: 「<動作の具体的説明>。Use when <起動条件>。」
   - 1024文字以内
   - 他スキルと重複しないキーワード選定
   - LLM がルーティングしやすい語彙を使用

4. 改善前後を比較表示して確認

## 分析テンプレート

```markdown
# Description Analysis: <skill-name>

## 現在の description
> <current description>

## 問題点
- [ ] 「何をするか」が不明確
- [ ] 「Use when」が欠落
- [ ] キーワードが汎用的すぎる
- [ ] 他スキルとキーワード競合: <competing-skill>

## 競合分析

| スキル | 重複キーワード | 影響度 |
|--------|---------------|--------|
| <name> | <keywords> | 🔴/🟡/🟢 |

## 改善案
> <optimized description>

## 変更理由
- <理由1>
- <理由2>
```

## キーワード棲み分けの原則

- **計画系**: planning, defining, structuring, scoping, designing
- **収集系**: collecting, searching, gathering, investigating, researching
- **分析系**: analyzing, evaluating, assessing, comparing, auditing
- **生成系**: generating, creating, writing, building, producing
- **検証系**: validating, checking, verifying, testing, reviewing
- **最適化系**: optimizing, improving, refining, tuning, enhancing

同一カテゴリのスキルが複数ある場合、**対象物**で差別化する:
- 「Analyze CSV data」 vs 「Analyze security vulnerabilities」
- 「Generate reports」 vs 「Generate code」

## Quality Gates

- [ ] 「何をするか」と「Use when」に相当する起動条件が含まれている
- [ ] 1024文字以内で、汎用語だけに依存していない
- [ ] 同一スイート内の他スキルと主要キーワードが衝突していない
- [ ] 改善前後の差分と変更理由が提示されている

## Gotchas

- `description` は人間向けではなく LLM のルーティングエンジン向けに書く。自然な日本語よりキーワード密度を優先する
- 「Use when」の部分が曖昧だと、本来起動すべき場面で起動しない「死蔵スキル」になる
- 複数スキルの `description` に同じ動詞+目的語の組み合わせがあると、どちらが選ばれるか不安定になる
- description を最適化した後は、実際にエージェントに試し発話して起動確認すること
- 1024文字の制限を超えると仕様違反。`name` は64文字以内

## 検証ループ

1. 改善版 description を生成
2. チェック:
   - 「何をするか」+「Use when」の2部構成か
   - 1024文字以内か
   - 他スキルとキーワード競合がないか
   - 具体的なキーワードが含まれるか
3. 不合格なら修正して再チェック
4. 合格後、テスト発話リスト（起動すべき/すべきでないケース）を提示
