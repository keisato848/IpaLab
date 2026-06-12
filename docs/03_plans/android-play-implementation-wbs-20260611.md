# Android Google Play版 実装WBS

## 1. 計画条件

- 開発者1名、週5人日を基準とする。
- Androidを先行し、iOS公開は対象外とする。
- 管理画面を除くWeb版学習機能を対象とする。
- 見積は実装・テスト・設計同期を含み、外部審査待ちは含めない。
- 基準工数は140人日、リスクバッファ20%込みで168人日、約34週とする。
- 認証、同期、試験演習を最優先のクリティカルパスとする。

## 2. マイルストーン

| MS | 目安 | 到達点 | 出荷可否 |
|---|---:|---|---|
| M0 | 2週 | Expo基盤、CI、環境分離 | 不可 |
| M1 | 8週 | OAuth/ゲスト、SQLite、Mobile API骨格 | 内部開発版 |
| M2 | 16週 | 試験DL、午前演習、履歴、同期 | Internal testing |
| M3 | 23週 | 午後演習、AI採点、学習計画 | Closed beta候補 |
| M4 | 28週 | ダッシュボード、AIアシスタント、全機能 | Closed beta |
| M5 | 34週 | 品質収束、Play審査資料、一般公開判定 | Production候補 |

## 3. WBS

### WP-0 プロジェクト・基盤

| ID | タスク | 人日 | 依存 | 完了条件 |
|---|---|---:|---|---|
| 0.1 | 作業ブランチ・Expo workspace作成 | 2 | なし | `apps/mobile`がdev buildで起動 |
| 0.2 | Router、環境設定、手動DI | 3 | 0.1 | dev/beta/prodで起動・遷移 |
| 0.3 | Jest/RNTL、lint、typecheck | 3 | 0.1 | PRで自動実行 |
| 0.4 | EAS Build、Android署名、AAB smoke | 3 | 0.2 | internal用AAB生成 |
| 0.5 | テーマ、共通UI、A11y基盤 | 5 | 0.2 | light/dark、200%、48dpを確認 |
|  | 小計 | 16 |  |  |

### WP-1 認証・アカウント

| ID | タスク | 人日 | 依存 | 完了条件 |
|---|---|---:|---|---|
| 1.1 | OAuth clients、callback、App Links登録 | 2 | 0.2 | 環境別callback成功 |
| 1.2 | Auth transaction、PKCE、callback API | 5 | 1.1 | 改ざん・再利用試験合格 |
| 1.3 | JWT/JWKS、refresh rotation、revoke | 5 | 1.2 | reuse検知と失効が動作 |
| 1.4 | Expo AuthSession、SecureStore、interceptor | 5 | 1.3 | 再起動、自動refresh、logout成功 |
| 1.5 | guest credential、正式アカウント統合 | 4 | 1.3, 2.5 | 冪等merge、横取り拒否 |
| 1.6 | 認証監視、rate limit、セキュリティ試験 | 4 | 1.2-1.5 | Critical/High 0件 |
|  | 小計 | 25 |  |  |

### WP-2 データ・同期・Mobile API

| ID | タスク | 人日 | 依存 | 完了条件 |
|---|---|---:|---|---|
| 2.1 | shared Zod DTO、共通エラー | 3 | 0.2 | Web/mobile契約テスト合格 |
| 2.2 | SQLite schema、Drizzle migration | 5 | 0.1 | migration/rollback試験合格 |
| 2.3 | bootstrap、manifest、content API | 5 | 2.1 | version/ETag/0件防壁が動作 |
| 2.4 | 回答保存、Outbox writer/worker | 6 | 2.2 | 同一TX、lease、再起動耐性 |
| 2.5 | sync batch、部分ACK、pull cursor | 7 | 2.1, 2.4 | 50件、冪等、部分失敗が動作 |
| 2.6 | 競合解決、dead-letter、手動再送 | 4 | 2.5 | 規則別試験合格 |
| 2.7 | Cosmos repository・新規コンテナ | 4 | 2.5 | PK/認可/ensureContainer確認 |
| 2.8 | 同期監視、失敗注入、結合試験 | 5 | 2.3-2.7 | データ消失・重複0件 |
|  | 小計 | 39 |  |  |

### WP-3 試験・学習コア

| ID | タスク | 人日 | 依存 | 完了条件 |
|---|---|---:|---|---|
| 3.1 | 試験一覧、filter、差分DL | 5 | 0.5, 2.3 | DL/削除/破損検知が動作 |
| 3.2 | 試験入口、resume、問題ナビ | 4 | 3.1, 2.2 | 途中再開成功 |
| 3.3 | 午前演習、採点、解説、timer | 8 | 3.2, 2.4 | オフライン回答・結果表示 |
| 3.4 | 数式、Markdown、Mermaid | 5 | 0.5 | 代表問題とfallback成功 |
| 3.5 | 午後短文・論述、原稿用紙 | 8 | 3.3, 3.4 | 下書き・IME・復元成功 |
| 3.6 | SSE採点、結果、差分表示 | 6 | 3.5 | 中断・429・再試行が動作 |
| 3.7 | 学習履歴、詳細、同期状態 | 5 | 2.5, 3.3 | 暫定/同期済みを区別 |
|  | 小計 | 41 |  |  |

### WP-4 Web全機能移植

| ID | タスク | 人日 | 依存 | 完了条件 |
|---|---|---:|---|---|
| 4.1 | ダッシュボード、heatmap、目標 | 5 | 2.5, 3.7 | キャッシュ/更新表示成功 |
| 4.2 | 学習計画作成、編集、完了 | 6 | 2.5 | version競合を処理 |
| 4.3 | AIアシスタント、画像、rate limit | 6 | 1.4, 3.6 | streaming/429/履歴が動作 |
| 4.4 | 設定、テーマ、手動同期、logout | 3 | 1.4, 2.6 | 設定永続化、再送成功 |
|  | 小計 | 20 |  |  |

### WP-5 品質・β・公開

| ID | タスク | 人日 | 依存 | 完了条件 |
|---|---|---:|---|---|
| 5.1 | Maestro P0 E2E、証跡Reporter | 5 | WP-1-4 | 主要フロー3回連続合格 |
| 5.2 | 端末/OS、TalkBack、200%文字 | 3 | 5.1 | 下限/主力/最新/Samsung合格 |
| 5.3 | 性能、Profiler、起動最適化 | 3 | 5.1 | cold start p95基準内 |
| 5.4 | MobSF、Data Safety、Privacy、削除導線 | 4 | WP-1-4 | Play提出内容と実装一致 |
| 5.5 | Internal/Closed配布、更新・rollback | 3 | 0.4, 5.1-5.4 | Play経由install/update成功 |
| 5.6 | β監視、不具合回帰、一般公開判定 | 5 | 5.5 | Go KPI達成 |
|  | 小計 | 23 |  |  |

重複するテスト実装を各WPへ内包するため、単純合計144人日から横断重複4人日を控除し、基準計画を140人日とする。

## 4. スプリント案

2週間、10人日を1スプリントとする。

| Sprint | 主成果物 |
|---|---|
| S1 | Expo、Router、CI、EAS preview |
| S2 | SQLite、DTO、共通UI |
| S3-S4 | Auth Bridge、OAuth、Token管理 |
| S5 | guest、bootstrap、content manifest |
| S6-S7 | Outbox、sync batch、pull、競合 |
| S8-S9 | 試験一覧、午前演習、履歴 |
| S10-S11 | 特殊表示、午後演習、AI採点 |
| S12 | 学習計画 |
| S13 | ダッシュボード、設定 |
| S14 | AIアシスタント、全機能結合 |
| S15 | Maestro、端末/A11y/性能 |
| S16 | Closed beta、回帰、審査資料 |
| S17 | バッファ、一般公開判定 |

## 5. クリティカルパス

```text
Expo基盤
 -> Shared DTO / SQLite
 -> Auth Bridge / OAuth
 -> Content API
 -> Outbox / Sync API
 -> 試験一覧 / 午前演習
 -> 午後演習 / AI採点
 -> E2E / Closed beta
 -> 一般公開判定
```

学習計画、ダッシュボード、AIアシスタントはコア同期安定後に実装する。外部OAuth設定やPlay審査待ちは早期着手し、実装待ちと並行する。

## 6. 品質ゲート

### Gate A: 基盤

- Expo Development Buildとpreview AABが起動する。
- lint、typecheck、Jest/RNTL、Android buildがPRで成功する。
- dev/beta/prodの秘密情報が分離されている。

### Gate B: 認証・同期

- Google、GitHub、ゲスト、refresh、logout、mergeが実機で成功する。
- P0同期テスト成功率100%。
- オフラインからの復帰でデータ消失・重複0件。
- body/queryの`userId`で他ユーザーへアクセスできない。

### Gate C: 機能完成

- 管理画面を除くWeb機能が移植されている。
- 午前・午後問題、AI採点、計画、履歴、アシスタントがP0 E2Eで合格する。
- 問題データfallback防壁の既存guardが合格する。

### Gate D: Closed beta

- P0テスト成功率100%。
- crash-free users 99.5%以上。
- ANR率0.3%未満。
- 同期成功率99.5%以上。
- OAuth成功率99%以上。
- データ消失・重複0件。
- Blocker/Critical 0件。

### Gate E: Production

- Closed betaで重大障害ゼロを2週間継続する。
- Data Safety、Privacy、削除手順、ストア素材が承認済み。
- AAB更新とrollback手順を検証済み。
- PMがGo判定し、ユーザーが公開を承認する。

## 7. E2Eエビデンス

```text
docs/04_reports/android/E2E_Test_Evidence_Report_YYYYMMDD_BUILD.md
apps/mobile/e2e/evidence/YYYYMMDD_BUILD/
```

報告書にはbuild番号、commit、端末/OS、通信条件、シナリオ、結果、画像、動画、Maestro XML、不具合、残存リスク、KPIを含める。Token、メール、自由記述回答を証跡へ残さない。

## 8. リスク予備費

| リスク | 予備対応 |
|---|---|
| OAuth callback/App Links | S3までに実機PoCを完了 |
| SQLite/Expo互換 | S2でmigration PoCを完了 |
| SSE非対応 | XHR/結果polling fallbackを先行検証 |
| 数式/Mermaid | WebView fallbackをS9前に確定 |
| 1名開発による割込み | 20%バッファ、WIPは常に1機能 |
| Play審査 | Internal testingとData Safetyを早期準備 |

## 9. Phase 3実装着手判定

**判定: Conditional Go**

実装着手前に次を確定する。

- [ ] Compact版基本設計書を正式版として承認する。
- [ ] Access Token 15分、同期バッチ50件を承認する。
- [ ] 新規Cosmosコンテナ3種の採否とパーティションキーを承認する。
- [ ] Google/GitHubのstaging/production OAuth Appを準備する。
- [ ] `com.shikakuno.app`等のAndroid package名を確定する。
- [ ] Sentry採用とData Safety上の送信項目を承認する。

条件確定後、最初の実装単位はWP-0とWP-2.1/2.2とする。

## 変更履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-06-11 | 1.0 | Phase 3初版 |
