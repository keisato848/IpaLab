# 認証機能 (Login) セットアップガイド

本アプリケーションでログイン機能（GitHub / Google 認証）を有効化するための手順書です。
初めて設定する人でも迷わないよう、画面の操作をステップごとに説明しています。

---

## 全体の流れ（まず読んでください）

```
① 共通の秘密鍵を作る (NEXTAUTH_SECRET)
② GitHub で OAuth アプリを作る → Client ID / Secret を取得
③ Google で OAuth アプリを作る → Client ID / Secret を取得
④ 取得した値を Azure の環境変数に登録する
⑤ ローカル開発用の .env.local ファイルを作る
```

---

## 1. 共通設定（必須）

### 1.1 `NEXTAUTH_SECRET` を作る

これは「暗号化に使うパスワードのようなもの」です。ログイン情報を安全にやり取りするために必要です。

**作り方:**

ターミナル（コマンドプロンプト / PowerShell / Git Bash）を開いて、以下のどちらかを実行します:

```bash
# 方法1: openssl が使える場合（Git Bash や Mac/Linux）
openssl rand -base64 32

# 方法2: Node.js が使える場合
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

実行すると `aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AB=` のようなランダムな文字列が表示されます。
**この文字列をコピーして保存しておいてください。**（あとで Azure とローカルの両方で使います。）

### 1.2 `NEXTAUTH_URL` を決める

アプリの URL です。環境によって変わります:

| 環境 | 値 |
|------|-----|
| ローカル開発 | `http://localhost:3000` |
| 本番 (Azure SWA) | `https://shikaku-no.com` |

### 1.3 `AUTH_TRUST_HOST`

Azure Static Web Apps で動かす場合は `true` に設定します。
（「このサーバーは信頼できますよ」と教える設定です。）

---

## 2. GitHub 認証設定

### 2.1 GitHub に OAuth App を作る

1. GitHub にログインした状態で、以下の URL を開きます:
   👉 https://github.com/settings/developers
2. 左のメニューから **「OAuth Apps」** をクリックします。
3. 右上の **「New OAuth App」** ボタンをクリックします。

### 2.2 フォームを埋める

| 項目 | 入力する値 | 説明 |
|------|-----------|------|
| **Application name** | `シカクノ` | アプリの名前（何でもOK） |
| **Homepage URL** | `https://shikaku-no.com` | アプリのトップページ URL |
| **Authorization callback URL** | `https://shikaku-no.com/api/auth/callback/github` | ログイン完了後に戻ってくる URL |

4. **「Register application」** ボタンをクリックします。

### 2.3 Client ID と Client Secret を取得する

登録が完了すると、アプリの設定画面が表示されます。

1. **Client ID** が画面上部に表示されています → **コピーして保存**
2. **「Generate a new client secret」** ボタンをクリック → 緑色の文字列が表示されます → **コピーして保存**

> ⚠️ **注意**: Client Secret は一度しか表示されません！ ページを閉じると二度と見られないので、必ずその場でコピーしてください。

### 2.4 ローカル開発もしたい場合

本番とは別にもう1つ OAuth App を作るのがおすすめです:
- **Homepage URL**: `http://localhost:3000`
- **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

**取得した環境変数:**
| キー | 値 |
|------|-----|
| `AUTH_GITHUB_ID` | コピーした Client ID |
| `AUTH_GITHUB_SECRET` | コピーした Client Secret |

---

## 3. Google 認証設定

Google の設定は GitHub より少し手順が多いですが、一つずつやれば大丈夫です。
大きく分けて **3つのステップ** があります:

```
Step A: Google Cloud プロジェクトを作る
Step B: 「OAuth 同意画面」を設定する（= Google に「こんなアプリです」と申告する）
Step C: 「OAuth クライアント ID」を作る（= パスワードを発行してもらう）
```

### Step A: Google Cloud プロジェクトの準備

#### A-1. Google Cloud Console を開く

1. ブラウザで以下の URL を開きます:
   👉 https://console.cloud.google.com/
2. Google アカウントでログインします（普段使っている Gmail アカウントでOK）。

#### A-2. プロジェクトを作る（初めての場合）

1. 画面の左上、**「Google Cloud」ロゴの右横** に「プロジェクトの選択」というドロップダウンがあります。クリックします。
2. 右上の **「新しいプロジェクト」** をクリックします。
3. 以下を入力して **「作成」** をクリック:
   - **プロジェクト名**: `shikakuno`（何でもOK）
   - **場所**: そのまま（「組織なし」でOK）
4. 作成が完了したら、そのプロジェクトが選択されていることを確認します。
   （画面左上に `shikakuno` と表示されていればOK）

---

### Step B: OAuth 同意画面の設定

「OAuth 同意画面」とは、ユーザーが Google ログインするときに表示される **「〇〇がアカウントへのアクセスをリクエストしています」という画面** の設定です。

#### B-1. OAuth 同意画面を開く

1. 画面左上のハンバーガーメニュー（☰）をクリックします。
2. **「API とサービス」** をクリックします。
3. **「OAuth 同意画面」** をクリックします。

> 💡 直接 URL でもアクセスできます:
> https://console.cloud.google.com/apis/credentials/consent

#### B-2. User Type を選ぶ

「User Type」を聞かれたら **「外部」** を選んで **「作成」** をクリックします。

> 「外部」= Google アカウントを持っている人なら誰でもログインできる、という意味です。

#### B-3. アプリ情報を入力する（ステップ1/4: OAuth 同意画面）

| 項目 | 入力する値 | 説明 |
|------|-----------|------|
| **アプリ名** | `シカクノ` | ログイン画面に表示される名前 |
| **ユーザー サポート メール** | あなたのメールアドレス | ドロップダウンから選ぶ |
| **アプリのロゴ** | （空欄でOK） | あとから設定できる |

ページ下の方にスクロールして:

| 項目 | 入力する値 |
|------|-----------|
| **承認済みドメイン** | `shikaku-no.com` |
| **デベロッパーの連絡先情報** | あなたのメールアドレス |

「承認済みドメイン」は **「+ ドメインを追加」** をクリックして入力します。

入力が終わったら **「保存して次へ」** をクリックします。

#### B-4. スコープの設定（ステップ2/4: スコープ）

スコープとは「このアプリが Google アカウントのどんな情報にアクセスしますか？」という許可範囲です。

1. **「スコープを追加または削除」** ボタンをクリックします。
2. 一覧から以下の **3つにチェック** を入れます:
   - `email` (ユーザーのメールアドレス)
   - `profile` (ユーザーの名前・プロフィール写真)
   - `openid` (ログイン認証の基本情報)

3. **「更新」** をクリックします。
4. **「保存して次へ」** をクリックします。

> 💡 見つけにくい場合は、検索ボックスに `email` と入力するとフィルタできます。

#### B-5. テストユーザーの設定（ステップ3/4: テストユーザー）

アプリが「テスト中」のステータスの間は、ここに登録したユーザーだけがログインできます。

1. **「+ ADD USERS」** をクリックします。
2. テストに使いたい Google アカウントの **メールアドレス** を入力します。
3. **「追加」** → **「保存して次へ」** をクリックします。

> ⚠️ **重要**: テストユーザーに追加していないアカウントでログインしようとすると、`403 access_denied` エラーになります。

#### B-6. 概要の確認（ステップ4/4: 概要）

入力内容を確認して **「ダッシュボードに戻る」** をクリックします。

#### B-7. アプリを本番公開する（テスト完了後）

テストが終わって一般公開する準備ができたら:

1. 「OAuth 同意画面」のページに戻ります。
2. 「公開ステータス」のところに **「アプリを公開」** ボタンがあるのでクリックします。
3. 確認ダイアログが出るので **「確認」** をクリックします。

> 📝 公開しないままだとテストユーザー以外はログインできません。
> 公開には Google の審査が **不要** です（機密性の高いスコープを使っていない場合）。

---

### Step C: OAuth クライアント ID の作成

ここでアプリが Google と通信するための「鍵」を発行します。

#### C-1. 認証情報のページを開く

1. 画面左メニューの **「API とサービス」→「認証情報」** をクリックします。

> 💡 直接 URL でもアクセスできます:
> https://console.cloud.google.com/apis/credentials

#### C-2. OAuth クライアント ID を作成する

1. 画面上部の **「+ 認証情報を作成」** をクリックします。
2. **「OAuth クライアント ID」** を選択します。

#### C-3. フォームを埋める

| 項目 | 入力する値 |
|------|-----------|
| **アプリケーションの種類** | `ウェブ アプリケーション` (ドロップダウンから選ぶ) |
| **名前** | `シカクノ Web` (何でもOK) |

#### C-4. 承認済みの JavaScript 生成元を追加する

「これらの URL からのリクエストを許可しますよ」という設定です。

**「+ URI を追加」** を2回クリックして、以下の2つを追加します:

| # | URI |
|---|-----|
| 1 | `https://shikaku-no.com` |
| 2 | `http://localhost:3000` |

> 💡 1つ目は本番用、2つ目はローカル開発用です。

#### C-5. 承認済みのリダイレクト URI を追加する

「ログインが完了したあと、ユーザーをどの URL に戻しますか？」という設定です。

**「+ URI を追加」** を2回クリックして、以下の2つを追加します:

| # | URI |
|---|-----|
| 1 | `https://shikaku-no.com/api/auth/callback/google` |
| 2 | `http://localhost:3000/api/auth/callback/google` |

> ⚠️ **ここが一番大事です！** URL を1文字でも間違えると認証が動きません。
> コピペして正確に入力してください。

#### C-6. 作成を完了する

1. **「作成」** ボタンをクリックします。
2. ポップアップ画面に **「クライアント ID」** と **「クライアント シークレット」** が表示されます。

```
┌─────────────────────────────────────────────┐
│  OAuth クライアントを作成しました             │
│                                              │
│  クライアント ID:                            │
│  123456789-xxxxx.apps.googleusercontent.com  │
│                                              │
│  クライアント シークレット:                   │
│  GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx              │
│                                              │
│  [OK]  [JSON をダウンロード]                 │
└─────────────────────────────────────────────┘
```

3. **両方ともコピーして安全な場所に保存してください。**

> 💡 **「JSON をダウンロード」** をクリックすると、ファイルとして保存もできます（バックアップにおすすめ）。
> 後からでも「認証情報」ページの鉛筆アイコン（✏️）をクリックすれば確認できます。

**取得した環境変数:**
| キー | 値 | 例 |
|------|-----|-----|
| `AUTH_GOOGLE_ID` | クライアント ID | `123456789-xxxxx.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | クライアント シークレット | `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx` |

---

## 4. 取得した値を設定する

### 4.1 Azure Static Web Apps（本番環境）に登録する

1. ブラウザで [Azure Portal](https://portal.azure.com/) を開きます。
2. 検索バーに `Static Web Apps` と入力し、対象のアプリを開きます。
3. 左メニューの **「構成 (Configuration)」** をクリックします。
4. **「アプリケーション設定 (Application settings)」** のタブで、以下の値を1つずつ追加します:

   **追加方法**: 「+ 追加」ボタンをクリック → 名前と値を入力 → 「OK」

| 名前 (Name) | 値 (Value) | 説明 |
|------|------|------|
| `NEXTAUTH_SECRET` | (手順1.1で作った文字列) | 暗号化キー |
| `NEXTAUTH_URL` | `https://shikaku-no.com` | アプリの URL |
| `AUTH_TRUST_HOST` | `true` | ホスト信頼設定 |
| `AUTH_GITHUB_ID` | (GitHub の Client ID) | GitHub 認証用 |
| `AUTH_GITHUB_SECRET` | (GitHub の Client Secret) | GitHub 認証用 |
| `AUTH_GOOGLE_ID` | (Google の クライアント ID) | Google 認証用 |
| `AUTH_GOOGLE_SECRET` | (Google の クライアント シークレット) | Google 認証用 |

5. **全部追加したら、画面上部の「保存 (Save)」ボタンを必ずクリック** してください。

> ⚠️ 「保存」を忘れると設定が反映されません！

### 4.2 ローカル開発用 `.env.local` ファイルを作る

自分のパソコンで開発・テストするときに使うファイルです。

1. ターミナルで以下を実行します:
```bash
cd apps/web
cp .env.template .env.local
```

2. `apps/web/.env.local` ファイルを開いて、各値を実際のものに書き換えます:

```dotenv
NEXTAUTH_SECRET="aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AB="

NEXTAUTH_URL="http://localhost:3000"

AUTH_GITHUB_ID="ここにGitHubのClient IDを貼る"
AUTH_GITHUB_SECRET="ここにGitHubのClient Secretを貼る"
AUTH_GOOGLE_ID="123456789-xxxxx.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx"
```

> ⚠️ `.env.local` は **Git にコミットしないでください**（`.gitignore` に入っていれば自動で除外されます）。

---

## 5. 動作確認

### 5.1 ローカルで確認

1. `npm run dev` でアプリを起動します。
2. ブラウザで `http://localhost:3000` を開きます。
3. 「ログイン」をクリックします。
4. 「Google で続ける」ボタンを押します。
5. Google のアカウント選択画面が表示されたら成功です 🎉
6. アカウントを選ぶとダッシュボードにリダイレクトされます。

### 5.2 本番で確認

1. Azure にデプロイ後、`https://shikaku-no.com` にアクセスします。
2. 同様に「Google で続ける」でログインできるか確認します。

---

## トラブルシューティング

### Q1. 「Google で続ける」を押しても何も起きない / エラーになる

**チェックリスト:**
- [ ] `.env.local` に `AUTH_GOOGLE_ID` と `AUTH_GOOGLE_SECRET` が正しく設定されているか？
- [ ] `NEXTAUTH_SECRET` が設定されているか？
- [ ] `NEXTAUTH_URL` がローカルなら `http://localhost:3000`、本番なら `https://shikaku-no.com` になっているか？

### Q2. 「redirect_uri_mismatch」エラーが表示される

**原因**: Google Cloud Console で設定したリダイレクト URI と、実際のアプリの URL が一致していません。

**確認手順:**
1. Google Cloud Console → 「認証情報」 → 作成したOAuthクライアントの ✏️ をクリック
2. 「承認済みのリダイレクト URI」に以下のURLが **正確に** 登録されているか確認:
   - 本番: `https://shikaku-no.com/api/auth/callback/google`
   - ローカル: `http://localhost:3000/api/auth/callback/google`
3. URL の末尾に余分な `/` が入っていないか確認（`/google/` ← これはNG）

### Q3. 「Configuration」エラーが表示される（`/login?error=Configuration`）

**原因**: 環境変数不足、または CosmosDB が初期化されていません。

**対策1: 環境変数を全部チェック**
- `NEXTAUTH_SECRET` → 設定されているか？
- `AUTH_TRUST_HOST` → `true` になっているか？（Azure の場合）
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` → 空でないか？

**対策2: CosmosDB の確認**
- `Users` と `Accounts` コンテナが作成されているか確認してください。

### Q4. 「403 access_denied」エラーが Google で表示される

**原因**: OAuth 同意画面のアプリが「テスト中」で、テストユーザーに登録されていないアカウントでログインしようとしています。

**対策（どちらか）:**
1. Google Cloud Console → 「OAuth 同意画面」→ 「テストユーザー」にメールアドレスを追加
2. 「OAuth 同意画面」→ **「アプリを公開」** で本番ステータスに変更（テスト完了後）

### Q5. 「OAuthAccountNotLinked」エラーが表示される

**原因**: 同じメールアドレスが GitHub など別のプロバイダーで既に登録済みです。
**対策**: 最初にアカウントを作成したプロバイダー（GitHub）でログインしてください。

### Q6. ログインできたが名前やアイコンが表示されない

**確認:**
- `next.config.js` の `images.remotePatterns` に `lh3.googleusercontent.com` が含まれているか確認
  （Google プロフィール画像のホスト名です。現在のコードでは設定済みです。）

---

## 設定値チェックシート

設定漏れがないか、以下のチェックシートで確認してください:

### Google Cloud Console 側
- [ ] プロジェクトが作成されている
- [ ] OAuth 同意画面が設定されている
- [ ] スコープに `email`, `profile`, `openid` が追加されている
- [ ] テストユーザーが追加されている（テスト中の場合）
- [ ] OAuth クライアント ID が作成されている
- [ ] 承認済みの JavaScript 生成元に URL が追加されている
- [ ] 承認済みのリダイレクト URI に `/api/auth/callback/google` が追加されている

### Azure Portal 側
- [ ] `NEXTAUTH_SECRET` が設定されている
- [ ] `NEXTAUTH_URL` が `https://shikaku-no.com` になっている
- [ ] `AUTH_TRUST_HOST` が `true` になっている
- [ ] `AUTH_GOOGLE_ID` が設定されている
- [ ] `AUTH_GOOGLE_SECRET` が設定されている
- [ ] 設定後に「保存」をクリックした
