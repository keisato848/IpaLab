# モバイル版（Android Play版）設計確定記録 / Design Baseline

## 文書情報

| 項目 | 内容 |
|---|---|
| 種別 | 設計ベースライン（凍結記録） |
| バージョン | 1.1 |
| 対象 | IpaLab mobile（Android Google Play 版） |
| 関連 | [25_AndroidPlayBasicDesign_Compact](./25_AndroidPlayBasicDesign_Compact.md) / [26_AndroidPlayDetailedDesign](./26_AndroidPlayDetailedDesign.md) / [WBS](../03_plans/android-play-implementation-wbs-20260611.md) / [要件定義](../01_planning/mobile_app_requirements.md) |
| 目的 | 既決事項を凍結し、未決だった4論点を確定。WBS§の「要承認」リスト（陳腐化）を正式に解決する。 |

## 1. 本記録の位置づけ

詳細設計§1で主要判断は既に確定済みだが、WBS末尾の「要承認」チェックリストが未更新のままだった。本記録はそれを**正式に解決済みへ反映し、設計をベースライン（凍結）**する。以降の実装はこの確定内容を前提とする。

## 2. 凍結する既決事項（詳細設計§1ほかより再掲）

- アーキ：Expo/React Native、**BFFプロキシ方式**（端末からGeminiを直接呼ばない）、SQLite=端末正本／TanStack Query=サーバ状態／Zustand=UI状態。
- 認証：OAuth PKCE → bridge code → exchange。Access Token **15分**、Refresh Token **絶対30日＋ローテーション**。Refresh は `{sessionId}.{secret}` 自己完結形式＋point read（U-01/U-02 確定済）。
- 同期：Outbox、回答保存とOutbox追加は同一 `BEGIN IMMEDIATE` Tx。**最大50件の部分ACK**、`eventId` 冪等。バックオフ 2/4/8/16/32/60s＋jitter、8回失敗で dead_letter。
- データ：SQLite 12テーブル（PK/索引確定）。新規Cosmosコンテナ3種 **`MobileSyncEvents:/userId`・`MobileGuestMerges:/userId`・`MobileSessions:/userId`**（全て PK `/userId`）。
- スコープ：午前/午後演習・ダッシュボード・学習計画・履歴・AI採点閲覧・AIアシスタントを移植。管理画面・オフラインAI採点・課金は非スコープ。

## 3. 本日確定した4論点（2026-06-21）

### 3.1 ダッシュボード = モバイル最適の「再設計」（Web版1:1移植はしない）

Web版ダッシュボードは過去のUX分析（`IpaLab-dashboard-ux-analysis`）で「今日のミッションが埋もれる」「ゲーミフィケーション中途半端」「ファーストビューが全部0で達成感ゼロ」「認知負荷高」が指摘済み。モバイルはこれを**持ち込まず**、以下の軽量構成に再設計する。

**確定構成（上から順・単一階層）**
1. **今日の学習（最優先CTA）**：次に解くべき問題／前回の続きへ1タップ。未設定時も「最初の1問を解く」を必ず表示（0羅列・空状態フォールバック欠如を禁止）。
2. **連続学習（streak）＋今日の到達**：小さく1行。意味の伝わる数値のみ。
3. **通算進捗 1枚**：合格目標に対する達成率＋コンパクトheatmap（カード単位で再試行可）。
4. **弱点カテゴリ Top3**：タップで該当演習へ。

- 表示は L1(メモリ)→L2(SQLite)→L3(API) のキャッシュ階層に従い、最終更新時刻を明示。
- 「似た指標の散乱」を避け、1画面1メッセージ（次に何をすべきか）を徹底する。

### 3.2 クローズドβスコープ = 午前＋午後を一括

- Shikakuno の目玉である **AI記述採点（午後）をβ初日から提供**する。
- 午後演習画面（短文＝テキスト入力／論述＝原稿用紙UI・書記素単位カウント、§9特殊表示準拠）と SSE 採点中継（1回再開→結果照会）を WP-4 のリリース必須項目とする。
- 影響：WP-4 の実装ボリュームが増えるため、β開始は午前先行案より後ろ倒し。スケジュールはこの前提で引き直す。

### 3.3 エラー監視 = Sentry 採用（PIIスクラブ前提）

- クラッシュ／ANR／重大障害を Sentry で可視化。
- **送信禁止**：Token、メールアドレス、記述式回答本文、Cosmos接続情報。送信前スクラブを必須とする（§14防壁と整合）。
- Play **Data Safety** に「診断情報（クラッシュログ・診断）」を申告する。既存 `client-errors` 補助送信は併用。

### 3.4 Android package名（applicationId）= `com.shikakuno.app`

- ドメイン `shikaku-no.com` に整合する逆ドメイン。
- OAuth リダイレクト（Android App Links / カスタムスキーム）、Play 登録、`app.json` の `android.package` をこの値で確定。

### 3.5 UI/UX とアーキテクチャの出自原則（重要）

本アプリは **shikakuno（IPA 試験対策）のモバイル版**である。daidoko（家族のレシピ手帳アプリ）とは別プロダクトであり、両者の責務を明確に分離する。

- **UI/UX = shikakuno Web 版（`apps/web`）に準拠する。**
  - ブランド表記は「**シカクノ**」。daidoko のロゴ「臺所（台所）」は使用しない。
  - カラーは shikakuno Web の `globals.css` を正とし、モバイルは `apps/mobile/src/constants/theme.ts` のトークンを参照する（アクセント = 青 `#0070F3`、ダーク背景 `#0F1117`/`#1A202C`、テキスト `#F7FAFC` 系）。daidoko の和風・金茶パレットは使用しない。
  - タグラインは「情報処理技術者試験 学習プラットフォーム」。
- **アーキテクチャ = daidoko の設計パターンを参考にする。**
  - クリーンアーキテクチャ（`domain` / `application` / `infrastructure` / `store` 層）、Outbox による同期、SQLite を端末正本とする方針、エージェント運用スクリプトの考え方など、daidoko で確立された構造を踏襲する。
  - ただし参考にするのは**構造・設計手法のみ**であり、ブランド・文言・データ（DB名は `shikakuno.db`）は shikakuno 固有とする。

> 背景: 初期実装で daidoko のテンプレートを土台にしたため、ロゴ「臺所」・金茶カラー・`daidoko.db` 等の **daidoko 由来のビジュアル/識別子が混入**していた。2026-06 にこれらを shikakuno 基準へ全面的に是正済み。

## 4. WBS「要承認」チェックリストの解決状況

| WBS項目 | 状態 | 根拠 |
|---|---|---|
| Compact基本設計を正式版へ昇格 | ✅ 本記録で承認・凍結 | 本書 v1.1 |
| Access Token 15分・同期50件 | ✅ 確定済（既決） | 詳細設計§1 |
| 新規Cosmosコンテナ3種＋PK | ✅ 確定済（`/userId`×3） | 詳細設計§13 / 本書§2 |
| Android package名 | ✅ `com.shikakuno.app` | 本書§3.4 |
| Sentry採用・Data Safety申告 | ✅ 採用（PIIスクラブ） | 本書§3.3 |
| 環境別OAuthアプリ準備 | ⏳ 運用準備（下記§5） | — |

## 5. 残るのは「設計判断」ではなく「運用準備」

設計判断はすべて確定。以降ブロッカーとして残るのはセットアップ作業のみ：

- Google/GitHub の環境別 OAuth アプリ（dev/staging/production）作成とリダイレクトURI登録。
- Cosmos 3コンテナの実プロビジョニング（`apps/web/lib/cosmos.ts` の `ensureContainer` と DB設計書を同時更新）。
- Sentry プロジェクト作成＋DSNの環境変数化、PIIスクラブ設定。
- Play Console：アプリ作成、Data Safety 申告、内部テストトラック準備。

## 6. ベースライン化と次アクション

- 本記録をもって設計を **v1.1 で凍結**。実装（WP-4残り：ダッシュボード再設計・学習計画画面・午後演習・AIアシスタント）は本確定を前提に進める。
- WBS のスプリント案は §3.2（午前＋午後一括β）に合わせて引き直す。
