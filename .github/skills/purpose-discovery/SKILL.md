---
name: purpose-discovery
description: >
  1問1答の構造化ダイアログを通じて Agent Skills 開発の真の目的を発見する。
  要件を抽出し、プロンプトを構造化し、スキル生成前に最適化された仕様書を生成する。
  ユーザーのスキル開発リクエストが曖昧、詳細不足、または Agent Skills
  パッケージ生成前に明確化が必要な場合に使用する。
metadata:
  author: coreclaw
  version: "1.0"
---

# スキル開発のための Purpose Discovery

ユーザーの真の目的を明確にし、スキル生成前に最適化された仕様書を生成する。

## このスキルを使用する場面

- ユーザーが Agent Skills 開発を依頼したが、リクエストが曖昧
- 重要な情報（ドメイン、対象ユーザー、ワークフロー、連携先）が不足している
- 生成開始前に要件を構造化する必要がある

## ワークフロー

### Phase 1: 情報充足度チェック

Evaluate the user's input against these 8 required elements:

| # | Element | Question to ask if missing |
|---|---------|--------------------------|
| 1 | **PURPOSE** | What decision, workflow, or outcome should this skill enable? |
| 2 | **DOMAIN** | What professional domain or subject area? |
| 3 | **AUDIENCE** | Who will use this skill? |
| 4 | **SCOPE** | Single skill or suite? How many sub-skills? |
| 5 | **WORKFLOWS** | What are the main task types or phases? |
| 6 | **INTEGRATIONS** | Does it need MCP tools, databases, or APIs? |
| 7 | **REFERENCE MODEL** | Is there an existing skill group to reference? |
| 8 | **QUALITY CRITERIA** | What defines success? |

**Sufficiency rule**: 5+ elements clear → proceed to Phase 3.
<5 elements clear → enter Phase 2 dialogue.

### Phase 2: One-Question-at-a-Time Dialogue

**Rules**:
- Ask exactly **one question** per turn. Never batch multiple questions.
- Prefer closed or multiple-choice questions over open-ended.
- After each answer, re-check sufficiency (5+ elements met?).
- Maximum 8 rounds. After 8, proceed with stated assumptions.

**Priority order** (ask most impactful gaps first):
1. PURPOSE → 2. DOMAIN → 3. WORKFLOWS → 4. SCOPE
5. AUDIENCE → 6. INTEGRATIONS → 7. REFERENCE MODEL → 8. QUALITY CRITERIA

### Phase 3: Structured Prompt Generation

Compile into optimized specification:

```markdown
# Agent Skills 開発仕様書

## 目的
[目的の一文要約]

## ドメインと対象ユーザー
- ドメイン: [ドメイン]
- 主なユーザー: [対象ユーザー]

## アーキテクチャ
- 種別: [単体 / スイート]
- サブスキル: [一覧]
- Custom Agents: [役割付き一覧]

## ワークフローのフェーズ
| Phase | サブスキル | 説明 | ゲート |
|-------|-----------|------|------|
| 0 | [名前] | [説明] | ⏸️/自動 |

## 連携
- MCP: [一覧またはなし]
- データベース: [一覧またはなし]

## 参考モデル
- 基準: [既存グループまたはなし]

## 品質基準
- [基準]

## 仮定事項
- [情報不足からの仮定]
```

### Phase 4: ユーザー承認 ⏸️

仕様書を提示し、承認を待つ。
- 承認 → `skill-scaffolder` に渡す
- 修正要求 → 更新して再提示

## 成果物

- 構造化仕様書（skill-scaffolder への入力）
- `results/skill-spec.md`（参照用に保存）

## Quality Gates

- [ ] PURPOSE が明確かつ実行可能
- [ ] 8要素中5つ以上が明示的に対応されている
- [ ] 仕様書が標準テンプレート形式を使用している
- [ ] 生成開始前にユーザーが仕様書を承認している
- [ ] 仮定事項が明示されている

いずれかのゲートが不合格の場合: Phase 2 のダイアログに戻る。

## Gotchas

- 複数の質問を一度に投げてはならない。1問1答を厳守する
- ユーザーの最初の入力は「要望」であり「仕様」ではない。仕様は対話を経て構造化される
- PURPOSE が曖昧なまま SCOPE を決めてはならない。目的不明確だとスキル数の判断を誤る
- 8ラウンドで情報が揃わない場合は仮定を明記して進む。無限ループに入らないこと
- 既存スイートを参考にする場合も、ユーザー目的に合わせてカスタマイズすること

## 検証ループ

1. 充足度チェックを実行
2. チェック: 5/8要素が明確か、PURPOSE が具体的か
3. 不足 → 1問1答で追加ヒアリング
4. ユーザー承認後のみスキル生成に進む
