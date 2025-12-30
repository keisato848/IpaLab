# 認証機能 (Login) セットアップガイド

本アプリケーションでログイン機能（GitHub / Google 認証）を有効化するための手順です。
Azure Static Web Apps 環境変数に以下の値を設定する必要があります。

## 1. 共通設定 (必須)

### `AUTH_SECRET`
セッション情報の暗号化に使用される秘密鍵です。

**生成コマンド (ターミナルで実行):**
```bash
# Node.js があればどこでも実行可能
node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"

# または (apps/web ディレクトリに移動してから)
cd apps/web
npx auth secret
```
表示された文字列を `AUTH_SECRET` の値として使用します。

### `AUTH_URL` (Azureの場合不要な場合が多いが念のため)
Azure Static Web Apps では自動解決されることが多いですが、明示的に設定する場合はデプロイ先のURLを設定します。
- **Value**: `https://<your-app-name>.azurestaticapps.net` (末尾のスラッシュなし)

---

## 2. GitHub 認証設定 (推奨)

1. [GitHub Developer Settings](https://github.com/settings/developers) にアクセスし、「New OAuth App」を作成します。
2. 以下の情報を入力します:
   - **Application Name**: `IpaLab` (任意)
   - **Homepage URL**: `https://<your-app-name>.azurestaticapps.net`
   - **Authorization callback URL**: `https://<your-app-name>.azurestaticapps.net/api/auth/callback/github`
3. 作成後、以下の情報を取得します:
   - **Client ID**
   - **Client Secret** (Generate a new client secret)

**Azure 設定値:**
- `AUTH_GITHUB_ID`: (取得した Client ID)
- `AUTH_GITHUB_SECRET`: (取得した Client Secret)

---

## 3. Google 認証設定 (任意)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) にアクセスします。
2. 「認証情報を作成」>「OAuth クライアント ID」を選択します。
3. アプリケーションの種類: **ウェブ アプリケーション**
4. 以下のURIを設定します:
   - **承認済みの JavaScript 生成元**: `https://<your-app-name>.azurestaticapps.net`
   - **承認済みのリダイレクト URI**: `https://<your-app-name>.azurestaticapps.net/api/auth/callback/google`
5. 作成後、情報を取得します。

**Azure 設定値:**
- `AUTH_GOOGLE_ID`: (取得した Client ID)
- `AUTH_GOOGLE_SECRET`: (取得した Client Secret)

---

## 4. Azure Portal への反映

1. Azure Portal で Static Web App リソースを開きます。
2. **「構成 (Configuration)」** > **「アプリケーション設定 (Application settings)」** を開きます。
3. 上記で取得したキーと値を全て追加します。
4. **「保存 (Save)」** をクリックします。


設定反映後、ログイン機能が利用可能になります。

## トラブルシューティング

### Q. GitHub で "The redirect_uri is not associated with this application" と表示される
**原因**: Azure Portal の `AUTH_URL` の設定が誤っている可能性があります。
**確認**:
- 誤: `https://cosmos-pm-exam-...documents.azure.com` (Cosmos DBのアドレス)
- 正: `https://victorious-smoke-...?azurestaticapps.net` (Webアプリのアドレス)

`AUTH_URL` はアプリケーションのトップページのURLを設定してください。
