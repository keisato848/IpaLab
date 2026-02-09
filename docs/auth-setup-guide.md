# 認証機能 (Login) セットアップガイド

本アプリケーションでログイン機能（GitHub / Google 認証）を有効化するための手順です。
Azure Static Web Apps 環境変数に以下の値を設定する必要があります。

## 1. 共通設定 (必須)

### `NEXTAUTH_SECRET`
JWT トークンの暗号化・CSRF 保護に使用される秘密鍵です。

**生成コマンド (ターミナルで実行):**
```bash
openssl rand -base64 32
```
表示された文字列を `NEXTAUTH_SECRET` の値として使用します。

### `NEXTAUTH_URL`
OAuth コールバック URL の解決に必要です。

- **ローカル開発**: `http://localhost:3000`
- **本番 (Azure SWA)**: `https://shikaku-no.com`

### `AUTH_TRUST_HOST`
Azure Static Web Apps 環境では `true` を設定してください。

---

## 2. GitHub 認証設定

1. [GitHub Developer Settings](https://github.com/settings/developers) にアクセスし、「New OAuth App」を作成します。
2. 以下の情報を入力します:
   - **Application Name**: `シカクノ` (任意)
   - **Homepage URL**: `https://shikaku-no.com`
   - **Authorization callback URL**: `https://shikaku-no.com/api/auth/callback/github`
3. **ローカル開発用**: 別の OAuth App を作成するか、callback URL に `http://localhost:3000/api/auth/callback/github` も追加します。
4. 作成後、以下の情報を取得します:
   - **Client ID**
   - **Client Secret** (Generate a new client secret)

**環境変数:**
| キー | 値 |
|------|-----|
| `AUTH_GITHUB_ID` | 取得した Client ID |
| `AUTH_GITHUB_SECRET` | 取得した Client Secret |

---

## 3. Google 認証設定

### 3.1 Google Cloud プロジェクトの準備

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスします。
2. プロジェクトを選択（または新規作成）します。

### 3.2 OAuth 同意画面の設定

1. 左メニューから **「API とサービス」→「OAuth 同意画面」** を選択します。
2. **User Type**: 「外部」を選択して作成します。
3. 以下の情報を入力します:
   - **アプリ名**: `シカクノ`
   - **ユーザー サポート メール**: 管理者のメールアドレス
   - **承認済みドメイン**: `shikaku-no.com`
   - **デベロッパーの連絡先情報**: 管理者のメールアドレス
4. **スコープ**: 以下を追加します:
   - `email`
   - `profile`
   - `openid`
5. **テストユーザー**: 本番公開前はテストユーザーを追加（アプリが「テスト」ステータスの間のみ必要）。
6. **本番公開**: テスト完了後、「アプリを公開」ボタンで本番ステータスにします。

> **重要**: 「テスト」ステータスのままだと、テストユーザー以外は `403 access_denied` エラーになります。

### 3.3 OAuth クライアント ID の作成

1. **「API とサービス」→「認証情報」** に移動します。
2. **「認証情報を作成」→「OAuth クライアント ID」** を選択します。
3. アプリケーションの種類: **ウェブ アプリケーション**
4. 名前: `シカクノ Web` (任意)
5. **承認済みの JavaScript 生成元** (Authorized JavaScript origins):
   - `https://shikaku-no.com`
   - `http://localhost:3000` (ローカル開発用)
6. **承認済みのリダイレクト URI** (Authorized redirect URIs):
   - `https://shikaku-no.com/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (ローカル開発用)
7. 作成後、**Client ID** と **Client Secret** を取得します。

**環境変数:**
| キー | 値 |
|------|-----|
| `AUTH_GOOGLE_ID` | 取得した Client ID (例: `xxx.apps.googleusercontent.com`) |
| `AUTH_GOOGLE_SECRET` | 取得した Client Secret |

---

## 4. Azure Portal への反映

### 4.1 Azure Static Web Apps に環境変数を追加

1. Azure Portal で Static Web App リソースを開きます。
2. **「構成 (Configuration)」→「アプリケーション設定 (Application settings)」** を開きます。
3. 以下のすべてのキーと値を追加します:

| キー | 必須 | 説明 |
|------|------|------|
| `NEXTAUTH_SECRET` | ✅ | JWT 暗号化キー |
| `NEXTAUTH_URL` | ✅ | `https://shikaku-no.com` |
| `AUTH_TRUST_HOST` | ✅ | `true` |
| `AUTH_GITHUB_ID` | ✅ | GitHub Client ID |
| `AUTH_GITHUB_SECRET` | ✅ | GitHub Client Secret |
| `AUTH_GOOGLE_ID` | ✅ | Google Client ID |
| `AUTH_GOOGLE_SECRET` | ✅ | Google Client Secret |

4. **「保存 (Save)」** をクリックします。

### 4.2 ローカル開発用 `.env.local` ファイルの作成

```bash
cd apps/web
cp .env.template .env.local
# 各環境変数の値を実際のクレデンシャルに書き換える
```

---

## トラブルシューティング

### Q. "The redirect_uri is not associated with this application" と表示される
**原因**: OAuth プロバイダー側に登録したリダイレクト URI が `NEXTAUTH_URL` と一致していません。
**確認**: Google Cloud Console / GitHub Developer Settings で、リダイレクト URI が正しいか確認してください。

### Q. "Configuration" エラーが表示される (`/login?error=Configuration`)
**原因**: 環境変数不足、またはデータベース初期化未完了の可能性があります。

**対策1: 環境変数の確認**
- `NEXTAUTH_SECRET` が設定されているか確認
- `AUTH_TRUST_HOST=true` が設定されているか確認

**対策2: データベースの初期化 (コンテナ作成)**
CosmosDB に `Users`, `Accounts` コンテナが存在するか確認してください。

### Q. Google で "403 access_denied" が表示される
**原因**: OAuth 同意画面のアプリステータスが「テスト」のままで、テストユーザーに追加されていないアカウントでログインしようとしています。
**対策**:
1. Google Cloud Console →「OAuth 同意画面」→ テストユーザーにメールアドレスを追加
2. または「アプリを公開」で本番ステータスに変更

### Q. Google で "OAuthAccountNotLinked" エラーが表示される
**原因**: 同じメールアドレスが GitHub など別のプロバイダーで既に登録されています。
**対策**: 最初にアカウントを作成したプロバイダーでログインしてください。
