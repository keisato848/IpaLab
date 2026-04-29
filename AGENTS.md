# AGENTS.md — Harness オーケストレーター

本ファイルはリポジトリルートの Harness オーケストレーター定義です。
GitHub Copilot エージェントがタスクを受け取った際のルーティングを規定します。

---

## エージェント一覧

| エージェント | ファイル | 用途 |
|-------------|---------|------|
| `project-manager` | `.github/agents/project-manager.agent.md` | 全依頼の一次受付、フェーズ計画、承認ゲート、担当割り当て |
| `bug-fixer` | `.github/agents/bug-fixer.agent.md` | Issue からバグを診断・修正し PR を作成 |
| `document-agent` | `.github/agents/document-agent.agent.md` | コードのリバースエンジニアリングとドキュメント生成 |
| `documentation-steward` | `.github/agents/documentation-steward.agent.md` | 設計書・手順書の作成・更新・整合性維持 |
| `harness-reviewer` | `.github/agents/harness-reviewer.agent.md` | Agent Skills を Harness 7軸でスコアリング・監査 |
| `skill-developer` | `.github/agents/skill-developer.agent.md` | Agent Skills パッケージのフルライフサイクル開発 |
| `playwright-test-planner` | `.github/agents/playwright-test-planner.agent.md` | E2E テスト計画書の作成 |
| `playwright-test-generator` | `.github/agents/playwright-test-generator.agent.md` | Playwright テストコードの生成 |
| `playwright-test-healer` | `.github/agents/playwright-test-healer.agent.md` | 失敗した Playwright テストのデバッグ・修正 |
| `product-owner` | `.github/agents/product-owner.agent.md` | 要求、優先順位、受け入れ基準の整理 |
| `scrum-master` | `.github/agents/scrum-master.agent.md` | スクラム進行、Phase ゲート、出荷準備 |
| `solution-architect` | `.github/agents/solution-architect.agent.md` | Next.js/Azure/Cosmos/AI を横断した実装設計 |
| `frontend-learning-engineer` | `.github/agents/frontend-learning-engineer.agent.md` | 学習 UI、ダッシュボード、試験画面、採点結果 UI 実装 |
| `backend-data-engineer` | `.github/agents/backend-data-engineer.agent.md` | API、Cosmos、試験データ、防壁ルール実装 |
| `ai-scoring-engineer` | `.github/agents/ai-scoring-engineer.agent.md` | 午後試験 AI 採点、Gemini プロキシ、SSE 実装 |
| `devops-sre-engineer` | `.github/agents/devops-sre-engineer.agent.md` | Azure、CI/CD、hooks、監視、デプロイ運用 |
| `qa-evidence-engineer` | `.github/agents/qa-evidence-engineer.agent.md` | テスト戦略、E2E 証跡、品質ゲート |
| `security-observability-engineer` | `.github/agents/security-observability-engineer.agent.md` | セキュリティ、ログ、再発防止、可観測性 |

---

## ルーティングルール（WHEN/DO）

### PM 一元受付ルール（最優先）

WHEN: ユーザーから新規依頼、仕様変更、実装、調査、バグ修正、テスト、出荷、運用相談が来た
DO:
	1. まず `project-manager` が依頼を受け付け、依頼種別、目的、優先度、影響領域、期限、未解決事項を整理する
	2. `project-manager` が Phase 0〜6 の現在位置を決め、必要な成果物と承認ゲートを定義する
	3. `project-manager` の判断後にのみ、`product-owner`、`solution-architect`、実装系 agent、`qa-evidence-engineer`、`scrum-master` へ handoff する
	4. 専門 agent は原則としてユーザーから直接呼び出さず、PM の割り当てを受けて作業する
	5. 緊急対応でも Phase 0 受付、影響評価、検証計画、禁止操作確認は省略しない

WHEN: 依頼内容が曖昧、影響範囲が広い、または複数 agent にまたがる
DO: `project-manager` が `.github/prompts/pm-request-intake.prompt.md` の形式で依頼受付票を作成する

WHEN: 進行中に仕様変更、割り込み、スコープ追加、優先度変更が発生した
DO: `project-manager` が `.github/prompts/pm-change-control.prompt.md` の形式で変更管理票を作成し、承認後に計画を更新する

WHEN: 次フェーズへ進めるか判断する
DO: `project-manager` が `.github/prompts/pm-phase-gate-review.prompt.md` の形式で Phase Gate Review を実施し、Go / Conditional Go / No Go を判定する

### スクラムチーム編成

WHEN: 新機能、仕様変更、横断的な実装、スプリント計画を進めたい
DO:
	1. `project-manager` が受付・起票し、Phase 計画と承認ゲートを作る
	2. `product-owner` でユーザーストーリー、優先順位、受け入れ基準を整理する
	3. `solution-architect` で UI/API/データ/AI/Azure/テストへの影響を設計する
	4. 実装領域に応じて `frontend-learning-engineer`、`backend-data-engineer`、`ai-scoring-engineer`、`devops-sre-engineer` に分担する
	5. `qa-evidence-engineer` でテストと E2E evidence を確認する
	6. `scrum-master` が Phase ゲートと出荷準備を確認する
	7. `project-manager` が最終受入・出荷判定を行う

WHEN: スプリント進行、作業分担、完了条件、PR 前チェックを整理したい
DO: `project-manager` が受付後、進行管理タスクとして `scrum-master` へ handoff する

WHEN: 要件、優先順位、受け入れ基準、Issue 分割を整理したい
DO: `project-manager` が受付後、要件定義タスクとして `product-owner` へ handoff する

WHEN: アーキテクチャ、データ境界、API 契約、Azure/AI 配置方針を決めたい
DO: `project-manager` が受付後、基本設計タスクとして `solution-architect` へ handoff する

### 実装領域別

WHEN: ダッシュボード、学習計画、試験画面、採点結果 UI、CSS、アクセシビリティを実装したい
DO: `project-manager` が受付・設計ゲート確認後、`frontend-learning-engineer` へ handoff する

WHEN: API Routes、Cosmos DB、試験データ、fallback guard、packages/data を実装したい
DO: `project-manager` が受付・設計ゲート確認後、`backend-data-engineer` へ handoff する

WHEN: 午後試験 AI 採点、Gemini プロキシ、SSE、ルーブリック、AI 出力検証を実装したい
DO: `project-manager` が受付・設計ゲート確認後、`ai-scoring-engineer` へ handoff する

WHEN: Azure、GitHub Actions、デプロイ、hooks、Application Insights、運用手順を変更したい
DO: `project-manager` が受付・設計ゲート確認後、`devops-sre-engineer` へ handoff する

WHEN: セキュリティ、ログ、CodeQL、self-inspect、再発防止ルールを確認したい
DO: `project-manager` がリスク確認タスクとして `security-observability-engineer` へ handoff する

WHEN: テスト戦略、Vitest、Playwright、E2E 証跡、PR 品質ゲートを確認したい
DO: `project-manager` が品質計画タスクとして `qa-evidence-engineer` へ handoff する

### バグ修正

WHEN: Issue が報告された、バグを直したい、エラーを修正したい
DO: `project-manager` が受付・影響評価・検証条件を整理した後、`bug-fixer` へ handoff する

### ドキュメント作成・更新

WHEN: 設計書を書きたい、手順書を更新したい、ドキュメントを同期したい
DO: アプリ実装に関わる文書は `project-manager` が受付後、`documentation-steward` へ handoff する。Agent Skills や監査文書のみの変更は `documentation-steward` を直接使用できる

WHEN: コードから設計書をリバースエンジニアリングしたい、アーキテクチャ図を生成したい
DO: アプリ実装に関わる解析は `project-manager` が受付後、`document-agent` へ handoff する。独立した技術調査は `document-agent` を直接使用できる

### Agent Skills 開発・品質管理

WHEN: 新しいスキルを作りたい、スキルを改善したい
DO: `skill-developer` を使用する

WHEN: スキルをレビューしたい、品質を監査したい、Harness スコアを確認したい
DO: `harness-reviewer` を使用する

WHEN: `harness-reviewer` の監査結果をドキュメント化したい
DO: `documentation-steward` へ handoff する（`harness-reviewer` が `handoffs` 経由で実行）

### E2E テスト

WHEN: テスト計画を立てたい
DO: アプリ実装に関わる E2E は `project-manager` が受付後、`qa-evidence-engineer` 経由で `playwright-test-planner` へ handoff する

WHEN: テストコードを書きたい、テストを追加したい
DO: アプリ実装に関わる E2E は `project-manager` が受付後、`qa-evidence-engineer` 経由で `playwright-test-generator` へ handoff する

WHEN: テストが失敗している、テストを直したい
DO: アプリ実装に関わる E2E は `project-manager` が受付後、`qa-evidence-engineer` 経由で `playwright-test-healer` へ handoff する

---

## Phase ゲート

本リポジトリではスクラムチームを構成するが、品質確保のため進行管理はウォーターフォール型 SIer プロジェクトと同等に厳格なフェーズゲートで管理する。PM の Phase Gate Review で Go 判定が出るまで、次工程へ進めない。

### Phase 0: 受付・起票
- [ ] `project-manager` が依頼を一次受付しているか
- [ ] 依頼種別、目的、背景、優先度、期限が明確か
- [ ] 影響領域と主担当 agent が特定されているか
- [ ] 必要に応じて PM 依頼受付票が作成されているか

### Phase 1: 要件確認
- [ ] ユーザーストーリー、業務要件、受け入れ基準が明確か
- [ ] スコープ外と未解決事項が記録されているか
- [ ] 既存ドキュメントとの整合性に問題がないか
- [ ] PM が要件定義の Go / No Go を判定しているか

### Phase 2: 基本設計
- [ ] UI/API/データ/AI/Azure/CI/CD/テストへの影響が整理されているか
- [ ] API 契約、データ境界、外部制約、ロールバック方針が明確か
- [ ] 更新すべき設計書が特定されているか
- [ ] PM が基本設計の Go / No Go を判定しているか

### Phase 3: 詳細設計・WBS
- [ ] 担当 agent、対象ファイル、成果物、作業順序が明確か
- [ ] テスト計画、E2E evidence 要否、self-inspect 更新要否が明確か
- [ ] リスク、依存関係、変更管理条件が明確か
- [ ] PM が実装着手の Go / No Go を判定しているか

### Phase 4: 実装
- [ ] 最小限の変更のみ行っているか
- [ ] 基本設計・詳細設計から逸脱していないか
- [ ] 不要なコメント・デバッグコードが残っていないか
- [ ] 仕様変更が発生した場合、変更管理票に戻しているか

### Phase 5: 単体・結合検証
- [ ] `npm run test:unit` または対象テストが通っているか
- [ ] 必要な build/guard/self-inspect が通っているか
- [ ] UI 変更時の E2E evidence 報告書とスクリーンショットが生成されているか
- [ ] PM が検証完了の Go / No Go を判定しているか

### Phase 6: 受入・出荷
- [ ] フィーチャーブランチで作業しているか（main への直接コミット禁止）
- [ ] コミットメッセージが規約に従っているか
- [ ] 設計書、テスト結果、E2E evidence、残リスクが PR に反映されているか
- [ ] CI/CD パイプライン結果を確認しているか
- [ ] ユーザー承認なしに main へマージしていないか

---

## PM Prompts

| Prompt | 用途 |
|---|---|
| `.github/prompts/pm-request-intake.prompt.md` | 依頼受付票を作成し、目的・影響領域・担当 agent・フェーズ計画を整理 |
| `.github/prompts/pm-phase-gate-review.prompt.md` | 各フェーズの Go / Conditional Go / No Go 判定を実施 |
| `.github/prompts/pm-change-control.prompt.md` | 仕様変更、割り込み、スコープ追加を変更管理票として評価 |

---

## 禁止アクション（Forbidden Actions）

以下の操作はユーザーの明示的な承認なしに実行禁止：

- `git push --force`（強制プッシュ）
- `git reset --hard`
- main ブランチへの直接 `git push`
- `gh pr merge`（マージ）
- データベースの DROP / TRUNCATE
- Azure リソースの削除・停止
- `.env` / シークレットのログ出力

---

## E2E エビデンス報告書ポリシー

- すべての E2E テスト実行で `docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md` を生成すること
- `SKIP_EVIDENCE` 環境変数は廃止。CI でもローカルでも報告書を生成する
- 報告書は `apps/web/e2e/reporters/custom-report.ts`（Playwright Reporter）が自動生成
- UI に影響する PR では報告書へのリンクを PR 本文に記載すること

---

## Gotchas（落とし穴・教訓）

- **セキュリティフックは公式ツール名を網羅すること**: `ban-gh-pr-merge.ps1` の `$shellTools` リストに `execute`（公式エイリアス）を含めないと、エージェントが `gh pr merge` を `execute` で呼び出したときにガードをすり抜ける（PR #Phase1 インシデント教訓）。
- **Custom Agent の `tools` フィールドはスコープを制限する場合のみ宣言すること**: 省略すると全ツールが暗黙的に許可される（全許可したい場合は省略が正しい）。読み取り専用エージェントなど制限が必要な場合は `tools: [read, search]` を明示する。
- **`tools` は公式仕様に従うこと**: 公式エイリアス（`read`/`edit`/`search`/`execute`/`agent`/`web`/`todo`）、`*`、または正規の `server/tool`・`server/*` 形式のみを使う。旧テンプレート由来の `search/codebase` や `edit/editFiles` は使わない。
- **agent ファイルの description は必ず日本語**: `.github/copilot-instructions.md` のルールにより、説明・コメント・ドキュメントは日本語が必須。英語 description は AGENTS.md ルーティングで正しく解釈されないリスクがある。
- **Hook イベント名は PascalCase**: `sessionstart` ではなく `SessionStart`。小文字やスネークケースはフックが発火しない。
- **`SKIP_EVIDENCE` 環境変数は廃止済み**: CI・ローカルを問わず E2E 報告書は常に生成される。`SKIP_EVIDENCE=1` をセットしても無効。

---

## 参照

- [Copilot Agent カスタマイズ設計書](docs/02_design/23_CopilotAgentCustomizationDesign.md)
- [Copilot Instructions](.github/copilot-instructions.md)
- [CLAUDE.md](CLAUDE.md)
