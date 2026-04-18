# 機能詳細設計 体系化整備計画

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-04-09 | 初版作成。既存 docs の粒度を前提に、機能詳細設計を体系的に整備するための実行計画を定義 |
| 2026-04-09 | P1 / P2 の新規詳細設計書 (`12` 〜 `17`) を初版作成し、コア導線と横断関心事の空白を解消 |
| 2026-04-09 | 既存詳細文書 (`ai-planner-design.md`, `07`, `08`, `09`) をレビューし、当面は現状維持で運用可能と判断 |

---

## 1. 目的

本計画の目的は、現状の「機能概要・構成レベル中心の設計書」を、開発再開や機能改修に直接使える「機能詳細設計」へ段階的に拡張することである。

特に以下を重視する。

- 会話コンテキストが圧縮されても、docs だけで次の着手点を復元できること
- 既存の `01_planning/` と `02_design/` の役割を壊さないこと
- 一度に読み込むコード量・ドキュメント量を制限し、LLM のコンテキスト上限を超えないこと

---

## 2. 現状認識

### 2.1 現在の docs の粒度

現状の docs は、主に以下の 2 系統で構成される。

1. `01_planning/`
   - 要件、基本設計、環境設計などの高レベル文書
   - 「何を作るか」「なぜ作るか」「全体としてどう実現するか」を示す

2. `02_design/`
   - 構成設計、アプリ構造、DB、画面遷移、デプロイなどの設計書
   - 実装全体の構造を理解するには有効だが、個別機能の詳細仕様としては不足がある

### 2.2 既に比較的詳細な文書

以下は例外的に、機能詳細に近い粒度を持つ。

- `docs/ai-planner-design.md`
- `docs/02_design/07_GamificationDesign.md`
- `docs/02_design/08_AdvertisementDesign.md`
- `docs/02_design/09_AdminAndFeatureFlagsDesign.md`

### 2.3 体系的に不足している領域

以下のコア機能は、機能別の詳細設計書としては未整備である。

- 認証・ゲスト利用
- ダッシュボード・学習履歴
- 午前問題演習
- 午後問題演習・採点
- 共通 API 契約・エラー応答
- テレメトリ・監視
- データ読み込み境界（`packages/data` と `apps/web` の接続面）

---

## 3. 完了目標

本計画の完了条件は以下とする。

1. 主要なユーザー導線ごとに、対応する機能詳細設計書が存在する
2. 既存の詳細寄り文書が、同じ章立て・粒度に寄せられている
3. `docs/00_Documentation_Map.md` から、計画書と正式設計書の役割分担が追える
4. 各文書が「次に何を読むか」「どのコードを確認すべきか」を示しており、再開しやすい

---

## 4. 非目標

以下は本計画の対象外とする。

- 全コンポーネントの逐語的なコード説明
- 全内部関数の API 仕様化
- 過去の planning 文書の全面改稿
- 既存ファイルの一括リネーム
- 1 セッションで全設計書を完成させること

---

## 5. 文書体系の方針

### 5.1 役割分担

| レベル | 保存場所 | 役割 |
|------|------|------|
| Planning Level | `docs/01_planning/` | 要件・背景・全体方針 |
| Implementation Level | `docs/02_design/` | 実装の正解基準となる正式設計 |
| Execution Plan Level | `docs/03_plans/` | 整備の段取り、優先順位、再開ポイント |

### 5.2 運用原則

- `03_plans/` は「作業計画」の保管場所であり、実装仕様の最終版ではない
- 機能仕様として確定した内容は、最終的に `02_design/` または既存の正式設計書へ反映する
- `ai-planner-design.md` は現時点では例外的に正式設計書扱いとする

---

## 6. 新たに整備する詳細設計の対象

### 6.1 新規追加対象（正式設計）

| 優先度 | 想定ファイル | 目的 |
|------|------|------|
| P0 | `docs/02_design/10_DetailedDesignGuide.md` | 詳細設計の章立て、粒度、更新ルールの標準化 |
| P1 | `docs/02_design/11_AuthAndGuestAccessDesign.md` | 認証、ゲスト利用、権限境界、移行フロー |
| P1 | `docs/02_design/12_DashboardAndLearningHistoryDesign.md` | ダッシュボード、統計、履歴、保存ルール |
| P1 | `docs/02_design/13_AMPracticeDesign.md` | 午前演習の出題、回答、正誤判定、解説表示 |
| P1 | `docs/02_design/14_PMPracticeAndScoringDesign.md` | 午後演習、記述入力、AI採点、結果表示 |
| P2 | `docs/02_design/15_CommonApiAndErrorDesign.md` | API 契約、HTTP ステータス、エラー整形 |
| P2 | `docs/02_design/16_TelemetryAndMonitoringDesign.md` | 計測、監視、ログ、Application Insights |
| P2 | `docs/02_design/17_DataLoadingAndSyncBoundaryDesign.md` | `packages/data` と `apps/web` の読み込み境界 |

### 6.2 既存文書の正規化対象

以下は新規ファイルを作らず、章立て・粒度を標準に寄せる。

- `docs/ai-planner-design.md`
- `docs/02_design/07_GamificationDesign.md`
- `docs/02_design/08_AdvertisementDesign.md`
- `docs/02_design/09_AdminAndFeatureFlagsDesign.md`

---

## 7. 実行フェーズ

### Phase 0: 基準作成

目的:
- 詳細設計を増やしても散らからないように、雛形と管理ルールを先に固定する

成果物:
- `docs/02_design/10_DetailedDesignGuide.md`
- 本計画書の整備
- `docs/00_Documentation_Map.md` の更新

完了条件:
- 新規詳細設計書の章立てが固定されている
- 計画書と正式設計書の違いが docs 上で説明されている

### Phase 1: コア導線の詳細設計

対象:
- 認証・ゲスト利用
- ダッシュボード・学習履歴
- 午前問題演習
- 午後問題演習・採点

成果物:
- `11_AuthAndGuestAccessDesign.md`
- `12_DashboardAndLearningHistoryDesign.md`
- `13_AMPracticeDesign.md`
- `14_PMPracticeAndScoringDesign.md`

理由:
- 主要導線であり、後続の広告、管理、AI 計画より参照頻度が高い
- ここが固まると、多くの改修で planning 文書ではなく詳細設計を参照できる

進捗:
- `11_AuthAndGuestAccessDesign.md` 初版作成済み
- `12_DashboardAndLearningHistoryDesign.md` 初版作成済み
- `13_AMPracticeDesign.md` 初版作成済み
- `14_PMPracticeAndScoringDesign.md` 初版作成済み

### Phase 2: 横断関心事の詳細設計

対象:
- 共通 API
- エラー設計
- テレメトリ
- データ読み込み・同期境界

成果物:
- `15_CommonApiAndErrorDesign.md`
- `16_TelemetryAndMonitoringDesign.md`
- `17_DataLoadingAndSyncBoundaryDesign.md`

理由:
- コア導線の記述で共通化できる論点を後から集約する方が、抽象論になりにくい

進捗:
- `15_CommonApiAndErrorDesign.md` 初版作成済み
- `16_TelemetryAndMonitoringDesign.md` 初版作成済み
- `17_DataLoadingAndSyncBoundaryDesign.md` 初版作成済み

### Phase 3: 既存の詳細寄り文書の標準化

対象:
- AI 学習計画
- ゲーミフィケーション
- 広告
- 管理者・フィーチャーフラグ

実施内容:
- 章立てを共通テンプレートに揃える
- 画面、API、データ、エラー、監視、テスト観点を補強する
- 重複記述を削減し、リンク参照へ寄せる

### Phase 4: 仕上げ

対象:
- ドキュメント間リンクの整備
- 更新履歴の整理
- どの設計書を起点に読むべきかの明確化

完了条件:
- 新規参加者が docs だけで主要機能の責務と改修境界を追える

---

## 8. コンテキスト上限を超えないための作業単位

本計画では、1 セッションあたりの調査対象を強制的に小さく保つ。

### 8.1 1 セッションの上限

- 対象機能は 1 つだけ
- 読む既存ドキュメントは最大 2 本
- 読む実装ファイルは最大 6 ファイル
- 読むテストファイルは最大 2 ファイル
- 目安読込量は合計 1,500 行前後まで

### 8.2 1 文書の作成手順

各詳細設計書は必ず 3 パスで作成する。

1. スコープ確定パス
   - 画面、API、主要モデル、主要コンポーネントだけを洗い出す

2. 骨子作成パス
   - 章立てだけ先に作り、不明点は `未確定` として残す

3. 補完パス
   - `未確定` の箇所だけ追加調査し、過剰に読み広げない

### 8.3 禁止事項

- 1 回で複数機能の詳細設計を同時に書くこと
- `apps/web` 全体を丸ごと読み直すこと
- planning 文書を毎回最初から全文読むこと
- 実装より先に完璧な共通設計を作ろうとすること

---

## 9. 詳細設計書の標準テンプレート

今後の詳細設計書は、原則として以下の章立てを持つ。

1. 概要
2. 対象範囲
3. ユーザーフロー
4. 画面・コンポーネント構成
5. API / サーバー処理
6. データモデル
7. 状態遷移・保存ルール
8. 認証・認可
9. エラー処理
10. テレメトリ / 監視
11. テスト観点
12. 未確定事項 / 今後の論点

この章立てを先に固定することで、既存の詳細寄り文書も後から同じフォーマットへ寄せられる。

---

## 10. 機能ごとの最小調査単位

### 10.1 認証・ゲスト利用

優先度: P1

最初に見る対象の例:
- `middleware.ts` 相当の認証境界
- NextAuth 設定
- ゲスト利用の保存ロジック
- ログイン画面
- ゲスト同期関連 hook / util

この文書で確定したいこと:
- ゲストから認証ユーザーへの移行フロー
- ロールの境界
- 認証不要 API と必須 API の区分

### 10.2 ダッシュボード・学習履歴

優先度: P1

最初に見る対象の例:
- ダッシュボード本体
- 学習記録取得 API
- 統計 hook
- 履歴保存 API
- 学習時間や進捗の表示ロジック

この文書で確定したいこと:
- 何を「進捗」として表示するか
- ゲスト時と認証時の差分
- 履歴保存の単位

### 10.3 午前問題演習

優先度: P1

最初に見る対象の例:
- 問題取得処理
- 選択肢表示コンポーネント
- 正誤判定処理
- 解説表示ロジック
- 関連 E2E テスト

この文書で確定したいこと:
- 出題から解説表示までの一連の流れ
- 選択肢データの扱い
- 学習記録への保存条件

### 10.4 午後問題演習・採点

優先度: P1

最初に見る対象の例:
- 問題表示コンポーネント
- 記述入力 UI
- AI 採点 API
- 結果表示コンポーネント
- 関連設計書 `ai-planner-design.md` 以外の AI 関連箇所

この文書で確定したいこと:
- 問題表示から採点結果保存までの流れ
- 採点失敗時の挙動
- 構造化データと表示データの対応関係

---

## 11. 進捗管理表

| 対象 | 種別 | 優先度 | 状態 | 備考 |
|------|------|------|------|------|
| DetailedDesignGuide | 新規 | P0 | 初版作成済み | `10_DetailedDesignGuide.md` を作成 |
| AuthAndGuestAccess | 新規 | P1 | 初版作成済み | `11_AuthAndGuestAccessDesign.md` を作成 |
| DashboardAndLearningHistory | 新規 | P1 | 初版作成済み | `12_DashboardAndLearningHistoryDesign.md` を作成 |
| AMPractice | 新規 | P1 | 初版作成済み | `13_AMPracticeDesign.md` を作成 |
| PMPracticeAndScoring | 新規 | P1 | 初版作成済み | `14_PMPracticeAndScoringDesign.md` を作成 |
| CommonApiAndError | 新規 | P2 | 初版作成済み | `15_CommonApiAndErrorDesign.md` を作成 |
| TelemetryAndMonitoring | 新規 | P2 | 初版作成済み | `16_TelemetryAndMonitoringDesign.md` を作成 |
| DataLoadingAndSyncBoundary | 新規 | P2 | 初版作成済み | `17_DataLoadingAndSyncBoundaryDesign.md` を作成 |
| ai-planner-design | 正規化 | P3 | レビュー済み（現状維持） | 基本設計として独立性あり |
| 07_GamificationDesign | 正規化 | P3 | レビュー済み（現状維持） | 機能設計として十分な粒度あり |
| 08_AdvertisementDesign | 正規化 | P3 | レビュー済み（現状維持） | 実装計画と制御条件が明示済み |
| 09_AdminAndFeatureFlagsDesign | 正規化 | P3 | レビュー済み（現状維持） | API・権限・分析要件が明示済み |

---

## 12. 次回再開時の最初の手順

会話履歴を見ずに再開する場合は、以下の順で進める。

1. 本文書を読む
2. `docs/00_Documentation_Map.md` を読む
3. `docs/02_design/10_DetailedDesignGuide.md` を確認する
4. 影響範囲の機能別詳細設計書を確認する
5. 実装変更がある場合のみ該当設計書と `docs/00_Documentation_Map.md` を同期更新する

次回着手時に迷った場合の判断基準:

- 迷ったらコア導線を先に書く
- 横断関心事は後でまとめる
- 既存の詳細寄り文書の正規化は最後でよい

---

## 13. 判断メモ

- 詳細設計の保存先は `02_design/` を正本とする
- `03_plans/` は「何をどういう順序で書くか」を覚えておくための場所とする
- `ai-planner-design.md` は当面そのまま維持し、無理に移動しない
- ファイル名は ASCII を優先し、会話外でも扱いやすくする
- 一度に大きな完璧さを狙わず、再開可能性を優先する

## 14. 現時点の到達点

本計画における「新規に不足していた機能別詳細設計」の追加は完了した。

現時点で docs 上に存在する新規詳細設計書:

- `10_DetailedDesignGuide.md`
- `11_AuthAndGuestAccessDesign.md`
- `12_DashboardAndLearningHistoryDesign.md`
- `13_AMPracticeDesign.md`
- `14_PMPracticeAndScoringDesign.md`
- `15_CommonApiAndErrorDesign.md`
- `16_TelemetryAndMonitoringDesign.md`
- `17_DataLoadingAndSyncBoundaryDesign.md`

また、既存詳細文書 (`ai-planner-design.md`, `07_GamificationDesign.md`, `08_AdvertisementDesign.md`, `09_AdminAndFeatureFlagsDesign.md`) はレビューの結果、当面は現状維持で運用可能と判断した。

以後の作業は、新規空白の補完ではなく、実装差分に合わせた設計更新と必要時の章立て整理が中心となる。