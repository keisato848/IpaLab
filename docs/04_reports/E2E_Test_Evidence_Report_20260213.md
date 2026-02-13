# E2E テスト エビデンス報告書

**実行日時**: 2026-02-13 06:47 JST (UTC: 2026-02-12T21:47)

---

## 1. エグゼクティブサマリー

| 項目 | 内容 |
|------|------|
| テストフレームワーク | Playwright (Chromium) |
| テストファイル数 | 3 |
| 総テスト数 | 49 |
| 成功数 | 49 |
| 失敗数 | 0 |
| 成功率 | **100%** |
| 実行時間 | 52.7 秒 |
| 対象ブランチ | `feature/cosmosdb-zero-trust` |
| PR番号 | #111 |

---

## 2. 変更概要

CosmosDB ゼロトラスト保護（Service Endpoint + IP フィルタ方式）の実装に伴い、以下の変更が行われた：

- **Step 5**: Bicep テンプレートにネットワーク保護構成を追加（`infra/azure/network.bicep` 新規作成、`main.bicep` / `resources.bicep` 更新）
- **Step 6**: ローカルアクセス手順ドキュメント追加（`docs/azure-sync-guide.md`）
- **Step 7**: 設計書にネットワーク構成を追記（`docs/03_migration/`, `docs/01_planning/azure_config/`）
- **Step 8**: CI/CD ワークフローにデプロイ後のネットワーク整合性チェックを追加
- その他: AIプラン生成の同期タイムアウト延長、依存関係更新

本 E2E テストは、上記のインフラ・ドキュメント変更が既存の UI 機能に悪影響を与えていないことを確認する目的で実施した。

---

## 3. テストシナリオ一覧

### 3.1 dark-theme.spec.ts — ダークテーマテスト

| テストID | シナリオ名 | 結果 |
|----------|-----------|------|
| D-01 | デフォルトテーマの確認（初回アクセス時はライトテーマ） | ✅ Pass |
| D-02 | ダークモードのトップページ表示（背景色の検証） | ✅ Pass |
| D-03 | ダークモードのログイン画面表示 | ✅ Pass |
| D-04 | テーマ設定の localStorage 永続化 | ✅ Pass |
| D-05 | ページ再読み込みでテーマ維持（ダーク） | ✅ Pass |
| D-05 | ページ再読み込みでテーマ維持（ライト） | ✅ Pass |
| D-06 | テーマのトグル切替（ライト→ダーク→ライト） | ✅ Pass |
| D-07 | システム prefers-color-scheme 反映（ダーク） | ✅ Pass |
| D-07 | システム prefers-color-scheme 反映（ライト） | ✅ Pass |
| D-08 | ライトテーマの CSS 変数値検証 | ✅ Pass |
| D-09 | ダークテーマの CSS 変数値検証 | ✅ Pass |
| D-10 | トップページのライト/ダーク並列比較 | ✅ Pass |
| D-10 | ログイン画面のライト/ダーク並列比較 | ✅ Pass |
| D-10 | OAuthエラー画面のライト/ダーク並列比較 | ✅ Pass |

### 3.2 error-cases.spec.ts — 異常系テスト

| テストID | シナリオ名 | 結果 |
|----------|-----------|------|
| E-01 | 存在しないURL（404）— 浅い階層 | ✅ Pass |
| E-01 | 存在しないURL（404）— 深い階層 | ✅ Pass |
| E-02 | OAuthSignin エラー表示 | ✅ Pass |
| E-03 | OAuthAccountNotLinked エラー表示 | ✅ Pass |
| E-04 | AccessDenied エラー表示 | ✅ Pass |
| E-05 | Configuration エラー表示 | ✅ Pass |
| E-02b | 未知のエラーコードのデフォルトメッセージ | ✅ Pass |
| E-02c | エラーパラメータなしの正常表示 | ✅ Pass |
| E-06 | XSS 含む callbackUrl への耐性 | ✅ Pass |
| E-06 | 超長文 callbackUrl への耐性 | ✅ Pass |
| E-06 | 複数 error パラメータへの耐性 | ✅ Pass |
| E-07 | 未ログインでの保護ページアクセス | ✅ Pass |
| E-08 | ボタン連打防止（クリック前/クリック後の無効化） | ✅ Pass |
| E-09 | HTML lang 属性の設定確認 | ✅ Pass |
| E-09 | ボタンの role 属性（アクセシビリティ） | ✅ Pass |

### 3.3 top-to-login.spec.ts — トップページ→ログインフロー

| テストID | シナリオ名 | 結果 |
|----------|-----------|------|
| — | トップページが正常に表示される | ✅ Pass |
| — | ヘッダーに「ログイン / 登録」リンクが表示される | ✅ Pass |
| — | CTA ボタンが正しく表示される | ✅ Pass |
| — | フィーチャーカードが3つ表示される | ✅ Pass |
| — | フッターが表示される | ✅ Pass |
| — | ヘッダーリンクからログイン画面へ遷移 | ✅ Pass |
| — | 「履歴を保存して始める」ボタンからログイン画面へ遷移 | ✅ Pass |
| — | ログイン画面の見出しと説明文が表示される | ✅ Pass |
| — | Google ログインボタンが表示される | ✅ Pass |
| — | GitHub ログインボタンが表示される | ✅ Pass |
| — | 利用規約とプライバシーポリシーのリンク表示 | ✅ Pass |
| — | 「ゲストとして利用する」ボタンが表示される | ✅ Pass |
| — | 同意テキストが正しく表示される | ✅ Pass |
| — | 「ゲストとして利用する」ボタンで試験ページへ遷移 | ✅ Pass |
| — | 利用規約リンクが新しいタブで開く設定 | ✅ Pass |
| — | プライバシーポリシーリンクが新しいタブで開く設定 | ✅ Pass |
| — | トップ→ログイン→ゲスト利用の E2E フロー | ✅ Pass |
| — | 「登録なしで試す」ボタンからダッシュボードへ遷移 | ✅ Pass |
| — | トップページでJavaScriptエラーが発生しない | ✅ Pass |
| — | ログイン画面でJavaScriptエラーが発生しない | ✅ Pass |

---

## 4. スクリーンショットエビデンス

エビデンスファイルの保存先: `apps/web/e2e/evidence/`

最新実行タイムスタンプ: `2026-02-12T21-48-*`（UTC）

### D-01: デフォルトテーマの確認

![D-01](../../apps/web/e2e/evidence/2026-02-12T21-48-06-302Z_D-01.png)

### D-02: ダークモードのトップページ表示

| ライトテーマ（変更前） | ダークテーマ（変更後） |
|:---:|:---:|
| ![D-02-1](../../apps/web/e2e/evidence/2026-02-12T21-48-08-395Z_D-02.png) | ![D-02-2](../../apps/web/e2e/evidence/2026-02-12T21-48-09-008Z_D-02.png) |

### D-03: ダークモードのログイン画面表示

| ライトテーマ | ダークテーマ |
|:---:|:---:|
| ![D-03-1](../../apps/web/e2e/evidence/2026-02-12T21-48-10-563Z_D-03.png) | ![D-03-2](../../apps/web/e2e/evidence/2026-02-12T21-48-11-057Z_D-03.png) |

### D-04: テーマ設定の localStorage 永続化

| ダーク設定 | ライト設定 |
|:---:|:---:|
| ![D-04-dark](../../apps/web/e2e/evidence/2026-02-12T21-48-12-576Z_D-04_localStorage_dark.png) | ![D-04-light](../../apps/web/e2e/evidence/2026-02-12T21-48-12-941Z_D-04_localStorage_light.png) |

### D-05: ページ再読み込みでテーマ維持

![D-05-1](../../apps/web/e2e/evidence/2026-02-12T21-48-14-614Z_D-05.png)
![D-05-2](../../apps/web/e2e/evidence/2026-02-12T21-48-16-553Z_D-05.png)
![D-05-3](../../apps/web/e2e/evidence/2026-02-12T21-48-19-533Z_D-05.png)

### D-06: テーマのトグル切替（ライト→ダーク→ライト）

| Step 1: ライト | Step 2: ダーク | Step 3: ライト |
|:---:|:---:|:---:|
| ![D-06-1](../../apps/web/e2e/evidence/2026-02-12T21-48-21-962Z_D-06_Step1.png) | ![D-06-2](../../apps/web/e2e/evidence/2026-02-12T21-48-22-639Z_D-06_Step2.png) | ![D-06-3](../../apps/web/e2e/evidence/2026-02-12T21-48-23-162Z_D-06_Step3.png) |

### D-07: システム prefers-color-scheme 反映

| システムダークモード | システムライトモード |
|:---:|:---:|
| ![D-07-dark](../../apps/web/e2e/evidence/2026-02-12T21-48-25-744Z_D-07.png) | ![D-07-light](../../apps/web/e2e/evidence/2026-02-12T21-48-29-418Z_D-07.png) |

### D-08: ライトテーマの CSS 変数値検証

![D-08](../../apps/web/e2e/evidence/2026-02-12T21-48-31-416Z_D-08_CSS.png)

### D-09: ダークテーマの CSS 変数値検証

![D-09](../../apps/web/e2e/evidence/2026-02-12T21-48-33-973Z_D-09_CSS.png)

### D-10: ライト/ダーク並列比較

#### トップページ

| ライト | ダーク |
|:---:|:---:|
| ![D-10-top-light](../../apps/web/e2e/evidence/2026-02-12T21-48-36-141Z_D-10_LIGHT.png) | ![D-10-top-dark](../../apps/web/e2e/evidence/2026-02-12T21-48-36-961Z_D-10_DARK.png) |

#### ログイン画面

| ライト | ダーク |
|:---:|:---:|
| ![D-10-login-light](../../apps/web/e2e/evidence/2026-02-12T21-48-38-425Z_D-10_LIGHT.png) | ![D-10-login-dark](../../apps/web/e2e/evidence/2026-02-12T21-48-39-025Z_D-10_DARK.png) |

#### OAuthエラー画面

| ライト | ダーク |
|:---:|:---:|
| ![D-10-oauth-light](../../apps/web/e2e/evidence/2026-02-12T21-48-40-256Z_D-10_OAuth_LIGHT.png) | ![D-10-oauth-dark](../../apps/web/e2e/evidence/2026-02-12T21-48-40-857Z_D-10_OAuth_DARK.png) |

### E-01: 存在しないURL（404）

| 浅い階層 | 深い階層 |
|:---:|:---:|
| ![E-01-shallow](../../apps/web/e2e/evidence/2026-02-12T21-48-01-237Z_E-01_404_page.png) | ![E-01-deep](../../apps/web/e2e/evidence/2026-02-12T21-48-02-628Z_E-01_deep_path_404.png) |

### E-02〜E-05: OAuth認証エラーパラメータの表示

| E-02: OAuthSignin | E-03: AccountNotLinked |
|:---:|:---:|
| ![E-02](../../apps/web/e2e/evidence/2026-02-12T21-48-06-435Z_E-02_OAuth_error_OAuthSignin.png) | ![E-03](../../apps/web/e2e/evidence/2026-02-12T21-48-08-764Z_E-03_OAuth_error_OAuthAccountNotLinked.png) |

| E-04: AccessDenied | E-05: Configuration |
|:---:|:---:|
| ![E-04](../../apps/web/e2e/evidence/2026-02-12T21-48-10-531Z_E-04_OAuth_error_AccessDenied.png) | ![E-05](../../apps/web/e2e/evidence/2026-02-12T21-48-12-517Z_E-05_OAuth_error_Configuration.png) |

| E-02b: 未知のエラーコード | E-02c: エラーパラメータなし |
|:---:|:---:|
| ![E-02b](../../apps/web/e2e/evidence/2026-02-12T21-48-14-650Z_E-02b_unknown_error_code.png) | ![E-02c](../../apps/web/e2e/evidence/2026-02-12T21-48-16-934Z_E-02c_no_error_normal.png) |

### E-06: 不正なパラメータへの耐性

| XSS callbackUrl | 超長文 callbackUrl | 複数 error パラメータ |
|:---:|:---:|:---:|
| ![E-06-xss](../../apps/web/e2e/evidence/2026-02-12T21-48-19-369Z_E-06_XSS_callbackUrl.png) | ![E-06-long](../../apps/web/e2e/evidence/2026-02-12T21-48-21-343Z_E-06_long_callbackUrl.png) | ![E-06-multi](../../apps/web/e2e/evidence/2026-02-12T21-48-23-761Z_E-06_multiple_error_params.png) |

### E-07: 未ログインでの保護ページアクセス

![E-07](../../apps/web/e2e/evidence/2026-02-12T21-48-27-991Z_E-07_unauthenticated_settings.png)

### E-08: ボタン連打防止（二重サブミット）

| クリック前 | クリック後（無効化） |
|:---:|:---:|
| ![E-08-before](../../apps/web/e2e/evidence/2026-02-12T21-48-30-918Z_E-08_before_click.png) | ![E-08-after](../../apps/web/e2e/evidence/2026-02-12T21-48-31-262Z_E-08_after_click_disabled.png) |

### E-09: ページ基本構造の確認

| lang 属性 | アクセシビリティ（role 属性） |
|:---:|:---:|
| ![E-09-lang](../../apps/web/e2e/evidence/2026-02-12T21-48-33-672Z_E-09_lang_attribute.png) | ![E-09-a11y](../../apps/web/e2e/evidence/2026-02-12T21-48-36-183Z_E-09_a11y_role_check.png) |

---

## 5. 結論

- **全49テストが成功**（成功率 100%）
- 今回の変更（Bicep テンプレート追加、CI/CD ワークフロー更新、設計書更新）は**インフラ・ドキュメント・CI のみの変更**であり、アプリケーションコードには直接影響を与えていない
- ダークテーマの表示・切替・永続化・CSS 変数値はすべて正常動作
- 異常系（404、OAuth エラー、XSS 耐性、アクセシビリティ）もすべて正常動作
- トップページ→ログイン→ゲスト利用フローもすべて正常動作
- **変更が UI に悪影響を与えていないことを確認した**
