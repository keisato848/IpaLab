# 午後試験 AI採点ルーブリック・評価観点設計書

> 関連Issue: #175 (P1-A-1) / 担当: ai-engineer
> Phase: Priority 1 - Phase 1-A
> **改訂履歴**: v1.1 試験区分別（記述式 / 論述式）の二系統に分離

## 1. 目的

午後試験のAI採点について、**試験形式ごとに異なるルーブリック**を定義する。情報処理試験の午後は「記述式（短答）」と「論述式（小論文）」で評価軸が根本的に異なるため、別系統として設計する。

## 2. 対象試験区分の整理

| 系統 | 対象試験 | 出題形式 | 文字数 | ルーブリック |
|---|---|---|---|---|
| **A. 記述式** | AP午後 / SC午後 / PM午後I / SA午後I / ST午後I | 短答記述 | 30〜200字程度 | §3 を適用 |
| **B. 論述式（小論文）** | PM午後II / SA午後II / ST午後II | 設問ア・イ・ウの論文 | 2,200〜3,200字 | §4 を適用 |
| **C. 選択式** | IP / FE科目B / 上記の選択部分 | 多肢選択 | — | 既存ロジック（対象外） |

> **重要**: 系統Aと系統Bは別エンドポイント・別ルーブリック・別UIで扱う。1つの汎用ルーブリックでは破綻する。

### 試験区分判定ロジック
- 設問メタデータに `format: 'short_answer' | 'essay' | 'choice'` を付与
- `essay` は **PM午後II / SA午後II / ST午後II** のみ
- `short_answer` は **AP午後 / SC午後 / PM午後I / SA午後I / ST午後I**

## 3. 系統A：記述式ルーブリック（短答記述）

| 観点 ID | 観点名 | 配点比率 | 判定基準 |
|---|---|---|---|
| `keyword_coverage` | キーワード網羅 | 40% | 模範解答に含まれる必須キーワードの被覆率 |
| `logical_structure` | 論理構造の妥当性 | 25% | 因果関係・主述対応・解答全体の整合性 |
| `expression_accuracy` | 表現の正確性 | 20% | 専門用語の正しい使用、誤用の有無 |
| `conciseness` | 字数・簡潔性 | 15% | 制限字数の遵守、冗長表現の有無 |

合計を設問配点（例: 4点 / 6点 / 8点）にスケーリングする。

### 3.1 必須キーワードの根拠づけ（エビデンスベース・ティア制／公開情報限定）

`keyword_coverage` 観点で参照する「必須キーワード」は、**根拠ソースに応じた4ティア**で管理する。
ユーザーへの説明可能性を担保するため、辞書登録時にソース・エビデンスの記録を必須化する。

> **著作権・再現性の観点から、市販書籍からの抽出は採用しない。**
> ソースは「IPA公式（公開・引用許諾範囲）」または「自社蓄積データ」に限定する。

| Tier | 根拠ソース | 必須度 | 採点での扱い |
|---|---|---|---|
| **T1** | IPA公式採点講評で加点要件と明記された語（公開PDF） | 必須 | `keyword_coverage` を 1件あたり **25点減点** |
| **T2** | IPA公式解答例の主語/目的語として直接出現する語（公開PDF） | 必須 | `keyword_coverage` を 1件あたり **12点減点** |
| **T3** | 自社プラットフォームのユーザー解答コーパスで正答群に頻出する語（自社データ） | 推奨 | `keyword_coverage` を 1件あたり **4点減点** |
| **T4** | LLMが**IPA公式解答例から**抽出した未レビュー候補 | 参考 | 採点には使わずLLMプロンプトの「参考」欄に注入 |

辞書 (`packages/shared/src/scoring/keywords/dictionary.ts`) の各エントリは
`tier / source / evidence / reviewedBy` を必須メタデータとして持つ。
辞書生成・運用パイプラインの詳細は **`22_KeywordDictionarySOP.md`** を参照。

### 3.2 ティアの活用箇所（採点フローでどう使うか）

ティアはデータ構造ではなく、以下4箇所での **動的振る舞い** に使われる。

```
┌─────────────────┐    ┌──────────────────────────┐    ┌─────────────────┐
│ 採点リクエスト   │ ─► │ ① detectMatchedKeywords  │ ─► │ byTier 内訳生成  │
│ (#176 API)      │    │   tier別 matched/missing │    │                 │
└─────────────────┘    └──────────────────────────┘    └────────┬────────┘
                                                                │
        ┌───────────────────────────────────────────────────────┤
        │                                                       │
        ▼                                                       ▼
┌──────────────────────────────┐               ┌──────────────────────────────────┐
│ ② scoreKeywordCoverage       │               │ ③ buildShortAnswerPrompt         │
│  ルールベース下限値を算出     │               │  T1/T2=必須, T3=推奨, T4=参考    │
│  100 - 25T1 - 12T2 - 4T3     │               │  ラベル付きで LLM に注入          │
└──────────────┬───────────────┘               └──────────────┬───────────────────┘
               │                                              │
               └─────────► min(②, LLM観点スコア) ◄────────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │ ④ UI フィードバック     │
                          │  T1miss=赤 / T2=橙 /   │
                          │  T3=グレー (#178/#179) │
                          └────────────────────────┘
```

| # | 利用箇所 | 実装 | 役割 |
|---|---|---|---|
| ① | バックエンド採点API (#176) | `detectMatchedKeywords()` | 各ティアでの hit/miss 内訳生成 |
| ② | 同上 | `scoreKeywordCoverage()` (aggregator.ts) | LLMから独立した**ルールベース下限値** |
| ③ | 同上、LLM呼び出し前 | `buildShortAnswerPrompt()` | LLM に必須度の差を伝達 |
| ④ | フロントエンド (#178/#179) | 採点結果ページ | ユーザーへ視覚的優先度を提示 |

最終 `keyword_coverage` スコアは:
```
final = min(LLM観点スコア, scoreKeywordCoverage(matchResult).score)
```
この設計により「LLM が緩く採点しても、IPA公式の必須キーワード欠落は確実に減点される」を保証する。

### 適用例
- AP午後 問1〜11（200字以内の記述）
- SC午後 問1〜4 の小問（30〜80字）
- PM/SA/ST午後Iの記述小問

## 4. 系統B：論述式ルーブリック（小論文）

論述式は **設問構成への適合・実体験性・論理構成・字数要件** が評価軸となり、キーワード網羅は副次的な指標に留まる。

| 観点 ID | 観点名 | 配点比率 | 判定基準 |
|---|---|---|---|
| `question_alignment` | 設問要求への適合 | 25% | 設問ア・イ・ウの各設問が問うている内容に正面から答えているか（論点ズレ・設問落としの検出） |
| `logical_composition` | 論理構成 | 20% | 背景→課題→施策→効果の論理展開、章立ての明瞭性、主張の一貫性 |
| `concreteness_experience` | 具体性・実体験性 | 20% | 自身の関与・役職・プロジェクト規模・固有名詞・数値の明示。抽象的・一般論への減点 |
| `feasibility_validity` | 実現可能性・妥当性 | 15% | 提案施策が現実的か、技術的・組織的に矛盾がないか、専門家視点で破綻していないか |
| `character_count_compliance` | 字数要件の遵守 | 10% | 設問ごとの字数下限・上限の遵守（例: 設問ア 800字以内、設問イ 800〜1,600字、設問ウ 600〜1,200字）|
| `expression_quality` | 表現品質 | 10% | 誤字脱字・主述対応・冗長表現・論文として読みやすい文体 |

### 4.1 設問ア・イ・ウの個別採点
論述式は設問ア・イ・ウを **個別に採点** し、それぞれに上記6観点を適用 → 重み付け合計 → 全体評価。

```
設問ア (背景・概要)   ── 6観点で採点 ── 設問ア小計
設問イ (課題・施策)   ── 6観点で採点 ── 設問イ小計
設問ウ (評価・改善)   ── 6観点で採点 ── 設問ウ小計
                                          │
                                          ▼
                                   全体スコア + A/B/C/D 判定
```

### 4.2 IPA採点基準への適合
IPA公式の論述評価ランクに合わせ、最終出力は **A / B / C / D の4段階判定** + 各観点スコアを返す。

| ランク | 目安 | 合否 |
|---|---|---|
| A | 設問要求を充足し具体性・実現性が高い | 合格 |
| B | 一部に弱点があるが概ね妥当 | 合格 |
| C | 設問要求の充足が不十分 | 不合格 |
| D | 設問要求を満たしていない / 字数不足 | 不合格 |

### 4.3 適用例
- PM午後II（プロジェクトマネージャ論述）
- SA午後II（システムアーキテクト論述）
- ST午後II（ITストラテジスト論述）

## 5. 観点別 採点プロンプト雛形

### 5.1 系統A（記述式）プロンプト

```text
あなたは情報処理試験の午後試験（記述式）採点官です。
以下のユーザー解答を、観点「{観点名}」に基づいて 0〜100 のスコアで評価し、
加点・減点の根拠を 2 文以内で日本語で出力してください。

【設問】 {question_text}
【模範解答】 {model_answer}
【必須キーワード】 {required_keywords}
【字数制限】 {char_limit}
【ユーザー解答】 {user_answer}

出力 (JSON):
{
  "score": <0-100>,
  "matched_keywords": [...],
  "missing_keywords": [...],
  "rationale": "<2 文以内>"
}
```

### 5.2 系統B（論述式）プロンプト

```text
あなたは情報処理試験の論述式（小論文）採点官です。IPA公式の採点ランク（A/B/C/D）と
評価観点に基づき、設問{ア|イ|ウ}に対する解答を観点「{観点名}」で評価してください。

【試験区分】 {exam_type}  例: PM午後II
【全体テーマ】 {theme}
【当該設問の要求事項】 {sub_question_requirements}
【字数要件】 {char_min}〜{char_max} 字
【模範解答骨子・採点ポイント】 {scoring_points}

【ユーザー解答（当該設問分）】
{user_answer_for_sub_question}

評価ルール:
- 「具体性・実体験性」観点では、固有名詞・役割・規模・数値の有無を重視
- 「設問要求への適合」観点では、設問が問うている事項に正面から答えているかを重視
- 抽象的・一般論的な記述は減点

出力 (JSON):
{
  "score": <0-100>,
  "rationale": "<3 文以内>",
  "evidence_quotes": ["<解答からの引用1>", "<引用2>"],
  "improvement_hint": "<次回への具体的助言 1 文>"
}
```

## 6. 採点フロー

### 6.1 系統A（記述式）
1. 設問メタ（模範解答・必須キーワード・字数制限）を取得
2. 4観点を並列でLLM呼び出し
3. 各観点スコアを配点比率で重み付け → 合計
4. 設問配点にスケール
5. 観点別スコア・根拠・差分情報を集約して返却

### 6.2 系統B（論述式）
1. 設問メタ（テーマ・各小問要求・字数要件・採点ポイント）を取得
2. ユーザー解答を **設問ア・イ・ウに分割**（章節検出 or ユーザー入力時にセクション分け）
3. 各小問×6観点 = 18 LLM呼び出しを並列実行
4. 小問ごとに重み付け合計 → 小問スコア
5. 全体重み（例: ア 25% / イ 45% / ウ 30%）で総合スコア算出
6. 総合スコアから **A/B/C/D ランク判定**
7. 結果集約 → 返却

## 7. データスキーマ

### 7.1 共通基底

```typescript
type AfternoonFormat = 'short_answer' | 'essay';

interface AfternoonScoringResultBase {
  questionId: string;
  format: AfternoonFormat;
  scoringVersion: string;
  scoredAt: string;
}
```

### 7.2 系統A：記述式

```typescript
interface ShortAnswerScoringResult extends AfternoonScoringResultBase {
  format: 'short_answer';
  totalScore: number;
  maxScore: number;
  perspectiveScores: Array<{
    id: 'keyword_coverage' | 'logical_structure' | 'expression_accuracy' | 'conciseness';
    name: string;
    score: number;             // 0-100
    weight: number;
    rationale: string;
    matchedKeywords?: string[];
    missingKeywords?: string[];
  }>;
  modelAnswerDiff?: {
    additions: string[];
    deletions: string[];
    rephrasing: Array<{ user: string; model: string }>;
  };
}
```

### 7.3 系統B：論述式

```typescript
interface EssayScoringResult extends AfternoonScoringResultBase {
  format: 'essay';
  examType: 'PM' | 'SA' | 'ST';
  overallRank: 'A' | 'B' | 'C' | 'D';
  overallScore: number;          // 0-100
  characterCounts: {
    setsumonA: number;
    setsumonI: number;
    setsumonU: number;
  };
  subQuestionScores: Array<{
    subQuestion: 'ア' | 'イ' | 'ウ';
    score: number;               // 0-100
    weight: number;              // 例: 0.25 / 0.45 / 0.30
    perspectiveScores: Array<{
      id: 'question_alignment' | 'logical_composition' | 'concreteness_experience'
        | 'feasibility_validity' | 'character_count_compliance' | 'expression_quality';
      name: string;
      score: number;             // 0-100
      weight: number;
      rationale: string;
      evidenceQuotes?: string[];
      improvementHint?: string;
    }>;
  }>;
  overallFeedback: {
    strengths: string[];
    weaknesses: string[];
    nextActions: string[];
  };
}

type AfternoonScoringResult = ShortAnswerScoringResult | EssayScoringResult;
```

## 8. 品質目標 (DoD)

### 系統A（記述式）
- 観点別プロンプト雛形 4 本完成
- 模範解答セット 30 問でドライラン → 人間採点との誤差 ±5 点以内
- ルーブリック v1.0 として `packages/ai-scoring/rubrics/short-answer/v1/` に配置

### 系統B（論述式）
- 観点別プロンプト雛形 6 本完成
- 過去問題 10 題 × ユーザー解答 30 件でドライラン
- IPA公式ランク（A/B/C/D）との一致率 70% 以上を目標
- 採点コスト：1 論文あたり ≤ ¥30（18 LLM 呼び出しを想定）
- ルーブリック v1.0 として `packages/ai-scoring/rubrics/essay/v1/` に配置

## 9. 今後の拡張余地

- 試験区分ごとの細かなルーブリック調整（PM論述 vs ST論述で重み差別化）
- ユーザーフィードバックを取り込んだ重み再学習
- 「優秀解答例」との差分提示
- 論述式の **設問分割** をAI支援（ユーザーが章節分けせずに貼り付けても自動検出）

## 10. 関連

- 関連Issue: #176 採点API v2（系統A/B両対応に修正要）, #182 評価データセット, #184 苦手観点抽出
- 参考: `docs/02_design/13_AMPracticeDesign.md`
