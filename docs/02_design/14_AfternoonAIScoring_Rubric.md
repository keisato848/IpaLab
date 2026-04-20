# 午後試験 AI採点ルーブリック・評価観点設計書

> 関連Issue: #175 (P1-A-1) / 担当: ai-engineer
> Phase: Priority 1 - Phase 1-A

## 1. 目的

午後試験（記述式）のAI採点について、評価観点・配点・判定基準を定義する。「なぜその点数か」をユーザーに説明可能な状態にし、納得感の高い採点体験を実現する。

## 2. スコープ

### 対象
- 記述式問題（応用情報・基本情報・SC・PM の午後）
- 模範解答が存在する設問
- 観点別スコアと根拠テキストを返す採点プロセス

### 対象外
- 選択式問題（既存ロジック）
- 採点API実装（→ #176）
- UI実装（→ #177, #178）

## 3. 評価観点（ルーブリック）

| 観点 ID | 観点名 | 配点比率 | 判定基準 |
|---|---|---|---|
| `keyword_coverage` | キーワード網羅 | 40% | 模範解答に含まれる必須キーワードの被覆率 |
| `logical_structure` | 論理構造の妥当性 | 25% | 因果関係・主述対応・解答全体の整合性 |
| `expression_accuracy` | 表現の正確性 | 20% | 専門用語の正しい使用、誤用の有無 |
| `conciseness` | 字数・簡潔性 | 15% | 制限字数の遵守、冗長表現の有無 |

合計を設問配点（例: 4点 / 6点 / 8点）にスケーリングする。

## 4. 観点別 採点プロンプト雛形

```text
あなたは情報処理試験の午後試験 採点官です。
以下のユーザー解答を、観点「{観点名}」に基づいて 0〜100 のスコアで評価し、
加点・減点の根拠を 2 文以内で日本語で出力してください。

【設問】
{question_text}

【模範解答】
{model_answer}

【必須キーワード】
{required_keywords}

【ユーザー解答】
{user_answer}

出力フォーマット (JSON):
{
  "score": <0-100>,
  "matched_keywords": [...],
  "missing_keywords": [...],
  "rationale": "<2 文以内>"
}
```

## 5. 採点フロー

1. 設問メタデータ（模範解答・必須キーワード・字数制限）を取得
2. 4観点を並列で LLM 呼び出し
3. 各観点スコアを配点比率で重み付け → 合計点を算出
4. 合計点を設問配点にスケール（小数第1位四捨五入）
5. 観点別スコア・根拠・差分情報を集約して返却

## 6. データスキーマ

```typescript
interface AfternoonScoringResult {
  questionId: string;
  totalScore: number;        // 設問配点ベース
  maxScore: number;
  perspectiveScores: Array<{
    id: 'keyword_coverage' | 'logical_structure' | 'expression_accuracy' | 'conciseness';
    name: string;
    score: number;           // 0-100
    weight: number;          // 配点比率
    rationale: string;       // 2文以内
    matchedKeywords?: string[];
    missingKeywords?: string[];
  }>;
  modelAnswerDiff?: {
    additions: string[];
    deletions: string[];
    rephrasing: Array<{ user: string; model: string }>;
  };
  scoringVersion: string;    // 採点モデルのバージョン
  scoredAt: string;          // ISO8601
}
```

## 7. 品質目標 (DoD)

- 観点定義書の確定（本書）
- 観点別プロンプト雛形 4 本完成
- 模範回答セット 30 問でドライラン実施 → 人間採点との誤差 ±5 点以内
- ルーブリック v1.0 として `packages/ai-scoring/rubrics/v1/` に配置

## 8. 今後の拡張余地

- 設問種別ごとのルーブリック差分（例: SC午後 II は論理構造の比重を上げる）
- ユーザーフィードバックを取り込んだ重み再学習
- 「優秀解答例」との差分提示

## 9. 関連

- 関連Issue: #176 採点API v2, #182 評価データセット, #184 苦手観点抽出
- 参考: `docs/02_design/13_AMPracticeDesign.md`
