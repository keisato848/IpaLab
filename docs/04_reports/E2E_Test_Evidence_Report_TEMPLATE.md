# E2E テスト エビデンス報告書

**実行日時**: {YYYY-MM-DD HH:MM} JST (UTC: {YYYY-MM-DD}T{HH:MM})

---

## 1. エグゼクティブサマリー

| 項目 | 内容 |
|------|------|
| テストフレームワーク | Playwright (Chromium) |
| テストファイル数 | {N} |
| 総テスト数 | {N} |
| 成功数 | {N} |
| 失敗数 | {N} |
| 成功率 | **{N}%** |
| 実行時間 | {N} 秒 |
| 対象ブランチ | `{branch_name}` |
| PR番号 | #{N} |

---

## 2. 変更概要

{今回の変更内容の要約。何をテスト対象としたかを記載}

本 E2E テストは、上記の変更が既存の UI 機能に悪影響を与えていないことを確認する目的で実施した。

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

最新実行タイムスタンプ: `{YYYY-MM-DD}T{HH-MM}-*`（UTC）

<!--
  スクリーンショットの埋め込みルール:
  - 相対パス形式: ![alt](../../apps/web/e2e/evidence/{FILENAME}.png)
  - テストIDごとにグループ化
  - 比較画像はテーブルで横並び表示
  - テーブルヘッダーのアラインメント: |:---:| (中央揃え)
-->

### D-01: デフォルトテーマの確認

![D-01](../../apps/web/e2e/evidence/{TIMESTAMP}_D-01.png)

### D-02: ダークモードのトップページ表示

| ライトテーマ（変更前） | ダークテーマ（変更後） |
|:---:|:---:|
| ![D-02-1](../../apps/web/e2e/evidence/{TIMESTAMP}_D-02.png) | ![D-02-2](../../apps/web/e2e/evidence/{TIMESTAMP}_D-02.png) |

### D-03: ダークモードのログイン画面表示

| ライトテーマ | ダークテーマ |
|:---:|:---:|
| ![D-03-1](../../apps/web/e2e/evidence/{TIMESTAMP}_D-03.png) | ![D-03-2](../../apps/web/e2e/evidence/{TIMESTAMP}_D-03.png) |

### D-04: テーマ設定の localStorage 永続化

| ダーク設定 | ライト設定 |
|:---:|:---:|
| ![D-04-dark](../../apps/web/e2e/evidence/{TIMESTAMP}_D-04_localStorage_dark.png) | ![D-04-light](../../apps/web/e2e/evidence/{TIMESTAMP}_D-04_localStorage_light.png) |

### D-05: ページ再読み込みでテーマ維持

![D-05-1](../../apps/web/e2e/evidence/{TIMESTAMP}_D-05.png)
![D-05-2](../../apps/web/e2e/evidence/{TIMESTAMP}_D-05.png)
![D-05-3](../../apps/web/e2e/evidence/{TIMESTAMP}_D-05.png)

### D-06: テーマのトグル切替（ライト→ダーク→ライト）

| Step 1: ライト | Step 2: ダーク | Step 3: ライト |
|:---:|:---:|:---:|
| ![D-06-1](../../apps/web/e2e/evidence/{TIMESTAMP}_D-06_Step1.png) | ![D-06-2](../../apps/web/e2e/evidence/{TIMESTAMP}_D-06_Step2.png) | ![D-06-3](../../apps/web/e2e/evidence/{TIMESTAMP}_D-06_Step3.png) |

### D-07: システム prefers-color-scheme 反映

| システムダークモード | システムライトモード |
|:---:|:---:|
| ![D-07-dark](../../apps/web/e2e/evidence/{TIMESTAMP}_D-07.png) | ![D-07-light](../../apps/web/e2e/evidence/{TIMESTAMP}_D-07.png) |

### D-08: ライトテーマの CSS 変数値検証

![D-08](../../apps/web/e2e/evidence/{TIMESTAMP}_D-08_CSS.png)

### D-09: ダークテーマの CSS 変数値検証

![D-09](../../apps/web/e2e/evidence/{TIMESTAMP}_D-09_CSS.png)

### D-10: ライト/ダーク並列比較

#### トップページ

| ライト | ダーク |
|:---:|:---:|
| ![D-10-top-light](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_LIGHT.png) | ![D-10-top-dark](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_DARK.png) |

#### ログイン画面

| ライト | ダーク |
|:---:|:---:|
| ![D-10-login-light](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_LIGHT.png) | ![D-10-login-dark](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_DARK.png) |

#### OAuthエラー画面

| ライト | ダーク |
|:---:|:---:|
| ![D-10-oauth-light](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_OAuth_LIGHT.png) | ![D-10-oauth-dark](../../apps/web/e2e/evidence/{TIMESTAMP}_D-10_OAuth_DARK.png) |

### E-01: 存在しないURL（404）

| 浅い階層 | 深い階層 |
|:---:|:---:|
| ![E-01-shallow](../../apps/web/e2e/evidence/{TIMESTAMP}_E-01_404_page.png) | ![E-01-deep](../../apps/web/e2e/evidence/{TIMESTAMP}_E-01_deep_path_404.png) |

### E-02〜E-05: OAuth認証エラーパラメータの表示

| E-02: OAuthSignin | E-03: AccountNotLinked |
|:---:|:---:|
| ![E-02](../../apps/web/e2e/evidence/{TIMESTAMP}_E-02_OAuth_error_OAuthSignin.png) | ![E-03](../../apps/web/e2e/evidence/{TIMESTAMP}_E-03_OAuth_error_OAuthAccountNotLinked.png) |

| E-04: AccessDenied | E-05: Configuration |
|:---:|:---:|
| ![E-04](../../apps/web/e2e/evidence/{TIMESTAMP}_E-04_OAuth_error_AccessDenied.png) | ![E-05](../../apps/web/e2e/evidence/{TIMESTAMP}_E-05_OAuth_error_Configuration.png) |

| E-02b: 未知のエラーコード | E-02c: エラーパラメータなし |
|:---:|:---:|
| ![E-02b](../../apps/web/e2e/evidence/{TIMESTAMP}_E-02b_unknown_error_code.png) | ![E-02c](../../apps/web/e2e/evidence/{TIMESTAMP}_E-02c_no_error_normal.png) |

### E-06: 不正なパラメータへの耐性

| XSS callbackUrl | 超長文 callbackUrl | 複数 error パラメータ |
|:---:|:---:|:---:|
| ![E-06-xss](../../apps/web/e2e/evidence/{TIMESTAMP}_E-06_XSS_callbackUrl.png) | ![E-06-long](../../apps/web/e2e/evidence/{TIMESTAMP}_E-06_long_callbackUrl.png) | ![E-06-multi](../../apps/web/e2e/evidence/{TIMESTAMP}_E-06_multiple_error_params.png) |

### E-07: 未ログインでの保護ページアクセス

![E-07](../../apps/web/e2e/evidence/{TIMESTAMP}_E-07_unauthenticated_settings.png)

### E-08: ボタン連打防止（二重サブミット）

| クリック前 | クリック後（無効化） |
|:---:|:---:|
| ![E-08-before](../../apps/web/e2e/evidence/{TIMESTAMP}_E-08_before_click.png) | ![E-08-after](../../apps/web/e2e/evidence/{TIMESTAMP}_E-08_after_click_disabled.png) |

### E-09: ページ基本構造の確認

| lang 属性 | アクセシビリティ（role 属性） |
|:---:|:---:|
| ![E-09-lang](../../apps/web/e2e/evidence/{TIMESTAMP}_E-09_lang_attribute.png) | ![E-09-a11y](../../apps/web/e2e/evidence/{TIMESTAMP}_E-09_a11y_role_check.png) |

---

## 5. 結論

- **全{N}テストが成功**（成功率 {N}%）
- {変更の影響範囲に関する記述}
- ダークテーマの表示・切替・永続化・CSS 変数値はすべて正常動作
- 異常系（404、OAuth エラー、XSS 耐性、アクセシビリティ）もすべて正常動作
- トップページ→ログイン→ゲスト利用フローもすべて正常動作
- **変更が UI に悪影響を与えていないことを確認した**
