# Android Google Play版 詳細設計書

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書ID | 26_AndroidPlayDetailedDesign |
| 対象 | `apps/mobile`、`/api/mobile/v1`、モバイル同期基盤 |
| 前提 | `mobile_app_requirements.md`、`25_AndroidPlayBasicDesign_Compact.md` |
| ステータス | Phase 3 詳細設計 |
| 更新日 | 2026-06-11 |

## 1. 決定事項

- Android先行、Expo/React Nativeで将来iOSへ展開する。
- 管理画面を除くWeb版学習機能を移植する。
- 業務データの端末側正本はSQLite、サーバー状態はTanStack Query、UI状態はZustandで管理する。
- 回答保存とOutbox追加を同一SQLiteトランザクションで行う。
- Access Tokenは15分、Refresh Tokenは絶対30日とし、Refresh Tokenをローテーションする。
- 同期は最大50イベントの部分ACK方式とし、イベントIDで冪等性を保証する。
- AI採点とAIアシスタントはオンライン必須とし、端末からGeminiを直接呼ばない。
- E2EはMaestroを標準とし、内部状態の精密検証はJest/RNTL/実SQLiteで補完する。

## 2. ルーティング

```text
apps/mobile/app/
  _layout.tsx
  index.tsx
  (auth)/
    login.tsx
    oauth-result.tsx
  (tabs)/
    _layout.tsx
    dashboard.tsx
    exams.tsx
    plan.tsx
    history.tsx
    settings.tsx
  exam/[examId]/
    index.tsx
    question/[qNo].tsx
    result.tsx
  scoring/
    short-answer.tsx
    essay.tsx
    result/[recordId].tsx
  history/[sessionId].tsx
  plan/setup.tsx
  plan/edit/[planId].tsx
  assistant.tsx
  sync-status.tsx
  legal/privacy.tsx
  legal/terms.tsx
```

主要タブはホーム、問題、計画、履歴、設定とする。AIアシスタントは共通モーダルとし、試験中は非表示にする。`examId` は不透明IDとして扱い、画面側で分解しない。

## 3. アプリ内責務

| レイヤー | 責務 |
|---|---|
| Presentation | 画面、共通UI、アクセシビリティ、ナビゲーション |
| Application | 認証、回答保存、同期、採点、学習計画のユースケース |
| Domain | エンティティ、同期イベント、競合規則、入力制約 |
| Infrastructure | API、SQLite、SecureStore、SSE、Telemetry |

routeファイルはパラメーター検証と画面呼び出しだけを行う。RepositoryとServiceはbootstrap時に手動DIし、テストで差し替え可能にする。

## 4. 画面状態

共通状態を `initializing / loading / ready / refreshing / empty / error / offline-ready` とする。

| 画面 | オフライン時 | 主なエラー処理 |
|---|---|---|
| ログイン | ゲスト開始のみ許可 | OAuth取消、redirect不正、認証障害 |
| ダッシュボード | 最終更新付きキャッシュ | カード単位の再試行 |
| 試験一覧 | ダウンロード済み試験のみ開始 | 容量不足、破損、取得失敗 |
| 午前演習 | 回答をOutbox保存 | 問題欠損、保存失敗 |
| 午後演習 | 下書き保存、採点不可 | 文字数超過、AI障害 |
| 履歴 | ローカル履歴を表示 | 同期待ちバッジと再送導線 |
| 学習計画 | 閲覧・完了操作可 | 生成不可、競合を通知 |
| AIアシスタント | 入力保持、送信不可 | 429、切断、画像失敗 |
| 設定 | 端末設定変更可 | 同期・ログアウト失敗 |

## 5. 認証詳細

### 5.1 OAuth

1. アプリがPKCE verifier/challengeとstateを生成する。
2. `POST /api/mobile/v1/auth/authorize` で認証トランザクションを開始する。
3. システムブラウザでGoogle/GitHubへ遷移する。
4. BFF callbackがProvider code、state、nonceを検証する。
5. BFFが既存NextAuth User/Accountを解決し、一回限りのbridge codeを発行する。
6. アプリがbridge codeとverifierを`/auth/exchange`へ送り、Mobile sessionを取得する。

Provider tokenは端末へ返さない。任意redirectは禁止し、環境別allowlistから解決する。本番はAndroid App Links、開発時はDevelopment Buildとcustom schemeを使う。

### 5.2 トークン

- Access Token: ES256またはRS256、TTL 15分、メモリ保持。
- Refresh Token: 256bit乱数、絶対TTL 30日、無操作TTL 14日、SecureStore保持。
- JWT claim: `iss`, `aud`, `sub`, `sid`, `jti`, `role`, `auth_type`, `iat`, `exp`。
- 401時のrefreshはsingle-flightで1回だけ実行する。
- Refresh Token再利用時はtoken familyを全失効する。
- Provider secret、JWT秘密鍵、NextAuth secretは共有しない。
- セッション解決: Refresh Tokenは`{sessionId}.{secret}`の自己完結形式とする。サーバーは`sessionId`でMobileSessions（PK `/userId`はJWT`sub`または保存済みuid部から解決）をpoint readし、`secret`部はハッシュ照合する。Tokenからの逆引き全件検索は行わない。

### 5.3 ゲスト統合

ゲストはUUIDとサーバー発行guest credentialで所有を証明する。OAuth成功後に固定`mergeId`で履歴を移管し、完了ACKをSQLiteへ記録するまでローカルデータを削除しない。同一guestの別アカウントへの統合は拒否する。

## 6. Mobile API

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/mobile/v1/auth/authorize` | OAuth開始 |
| GET | `/api/mobile/v1/auth/callback/{provider}` | Provider callback |
| POST | `/api/mobile/v1/auth/exchange` | bridge code交換 |
| POST | `/api/mobile/v1/auth/refresh` | Token更新 |
| POST | `/api/mobile/v1/auth/revoke` | Session失効 |
| GET | `/api/mobile/v1/auth/me` | Session確認 |
| POST | `/api/mobile/v1/auth/guest` | ゲスト発行 |
| GET | `/api/mobile/v1/bootstrap` | 初期設定、version、cursor |
| GET | `/api/mobile/v1/content/manifest` | コンテンツ差分一覧 |
| GET | `/api/mobile/v1/content/exams/{examId}` | 試験データ取得 |
| POST | `/api/mobile/v1/sync/batch` | Outbox部分ACK同期 |
| GET | `/api/mobile/v1/sync/changes` | サーバー差分pull |
| POST | `/api/mobile/v1/guest/merge` | ゲスト統合 |
| GET/PUT | `/api/mobile/v1/study-plans/{id?}` | 学習計画取得・更新 |
| POST | `/api/mobile/v1/telemetry/client-errors` | 重大障害補助送信 |

共通ヘッダーはBearer token、`X-Correlation-Id`、ハッシュ化した`X-Device-Id`、`X-App-Version`とする。入力DTOは`packages/shared/src/mobile/`へZod schemaとして配置する。入力の`userId`は認可判断に使わず、JWTの`sub`を正本とする。

同期結果はイベントごとに `applied / duplicate / conflict / rejected / retryable_error` を返す。エラーは `code`, `message`, `retryable`, `correlationId` を共通項目とする。

## 7. SQLite

| テーブル | 主キー | 用途・主要索引 |
|---|---|---|
| `app_users` | `id` | 現在ユーザーの非機密情報 |
| `exams` | `id` | `download_state`, `updated_at` |
| `questions` | `id` | UNIQUE(`exam_id`,`q_no`) |
| `learning_sessions` | `id` | `owner_id`,`started_at` |
| `learning_events` | `event_id` | 学習履歴の追記型正本 |
| `study_plans` | `id` | version、sync status |
| `outbox_events` | `event_id` | `state`,`next_attempt_at`,`created_at` |
| `sync_cursors` | `scope` | pull cursor、content version |
| `sync_conflicts` | `id` | eventごとの競合情報 |
| `guest_merges` | `merge_id` | 統合の再開・完了保証 |
| `content_staging` | 複合主キー | コンテンツ原子入替 |
| `schema_metadata` | `key` | DB schema version |

`PRAGMA foreign_keys=ON`を必須とする。TokenはSQLiteへ保存しない。検索対象はJSONだけに埋めず正規カラムを持つ。

## 8. Outbox同期

回答保存とOutbox追加は`BEGIN IMMEDIATE`から`COMMIT`までの同一トランザクションで実施する。

```text
pending -> in_flight -> acknowledged
                    -> conflict
                    -> dead_letter
                    -> retry_wait -> pending
```

- workerはleaseを取得して最大50件を送る。
- `eventId`は再送時も変更しない。
- バックオフは2, 4, 8, 16, 32, 60秒、以降は最大60秒+jitterとする。
- 8回失敗しても削除せず、手動同期または次回起動で再開する。
- `acknowledged`は監査のため7日保持する。
- content更新はstagingへ保存し、件数・hash検証後に原子的に切り替える。
- 0件またはhash不一致で既存問題キャッシュを削除しない。

### 8.1 競合規則

| データ | 規則 |
|---|---|
| 学習回答 | 追記型。複数回答を保持 |
| 提出済み回答 | サーバー確定版を正、端末変更は別ドラフト |
| 学習計画 | versionによる楽観ロック、自動上書き禁止 |
| 設定 | サーバー時刻によるLWWを許容 |
| 問題マスタ | サーバー正本、端末編集禁止 |
| 集計 | LearningRecordsから派生、端末値を正本にしない |

## 9. 特殊表示

- 数式: `react-native-math-view`を第一候補とし、失敗時はローカルKaTeX WebViewへフォールバックする。
- Mermaid: バンドル済みMermaidをWebViewで実行し、`securityLevel: strict`とする。
- 原稿用紙: 単一TextInputを入力元とし、マス目は表示専用Gridとする。書記素単位で数える。
- SSE: ストリーミングfetchを第一候補、XHR増分読込を代替とする。1回だけ再開し、その後は結果照会へ切り替える。
- AI採点要求はOutboxへ自動投入せず、オンラインで明示的に再試行する。

## 10. 状態管理

- Zustand: session、preferences、exam session、network、sync、assistant UIだけを保持する。
- TanStack Query: dashboard、exams、questions、history、plans、feature flagsを保持する。
- SQLite: 問題キャッシュ、回答、履歴、計画、同期キューを永続化する。
- Query keyには必ず`user:{id}`または`guest:{id}`のscopeを含める。

## 11. セキュリティ・可観測性

- HTTPS/TLS 1.2以上、cleartext禁止。
- body/queryの`userId`を信用しない。
- OAuth code、Token、メール、回答本文をログへ出さない。
- `X-Correlation-Id`をアプリ、BFF、Functionsへ伝搬する。
- Sentryはクラッシュ/ANR、Application InsightsはAPI、認証、同期を監視する。
- 主イベント: auth成功率、refresh失敗、token再利用、同期成功率、dead-letter件数、guest merge結果。
- Play提出前にData Safety台帳、プライバシーポリシー、アカウント削除導線を整備する。

## 12. テスト詳細

- Unit: Jest。共有純粋ロジックは既存構成に合わせVitestを許可する。
- Component: React Native Testing Library。
- API mock: MSW。
- DB: 実SQLiteでmigration、transaction、unique制約を試験する。
- E2E: Maestro。3回以上flakyで解消困難なシナリオのみDetoxを検討する。
- Security: CodeQL、Dependabot、secret scanning、MobSF、Play Pre-launch report。

P0 E2Eは、ゲスト演習、OAuth再起動復元、オフライン回答後同期、午後AI採点、学習計画、AIアシスタント、テーマ永続化、429復旧を含む。

## 13. 実装対象

```text
apps/mobile/
apps/web/app/api/mobile/v1/
apps/web/lib/mobile/
apps/web/lib/repositories/mobile*.ts
packages/shared/src/mobile/
apps/web/__tests__/api/mobile/
apps/mobile/src/**/__tests__/
apps/mobile/e2e/
```

新規Cosmosコンテナ候補は`MobileSyncEvents:/userId`、`MobileGuestMerges:/userId`、`MobileSessions:/userId`とする。追加時は`apps/web/lib/cosmos.ts`、構成設計書、DB設計書を同時更新する。

## 14. 防壁・禁止事項

- モバイル対応を理由に既存exam filesystem fallbackを弱めない。
- `getExamData()`、問題JSON tracing glob、fallback警告ログを削除・変更しない。
- Cosmos接続文字列やProvider secretをアプリへ含めない。
- Google/GitHubのメール一致だけでアカウントを自動リンクしない。
- 同期失敗を理由にローカル学習記録を削除しない。

## 15. Phase 3完了条件

- [x] 画面、route、状態、オフライン挙動を定義した。
- [x] 認証・Token・ゲスト統合を定義した。
- [x] API契約、SQLite、Outbox、競合規則を定義した。
- [x] 数式、Mermaid、原稿用紙、SSE方式を定義した。
- [x] テスト方式、E2E、品質指標を定義した。
- [x] 実装対象と既存防壁を明示した。

## 変更履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-06-11 | 1.0 | Phase 3初版 |
| 2026-06-12 | 1.1 | レビュー指摘反映: §5.2へRefresh Token提示時のMobileSessions解決方式を補記 |
