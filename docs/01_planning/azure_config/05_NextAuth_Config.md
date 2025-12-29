# NextAuth.js 認証設定設計書 (旧: Entra ID B2C)

## 基本情報
- **設定項目 ID:** AUTH-001 (Modified)
- **ライブラリ:** NextAuth.js (Auth.js) v4/v5
- **実行環境:** Azure Static Web Apps (Next.js App Router)
- **データストア:** Azure Cosmos DB (`Accounts`, `Sessions`, `Users`, `VerificationTokens`)

## 認証プロバイダ構成
| プロバイダ           | 環境変数 (Key)                              | 取得元                                              |
| :------------------- | :------------------------------------------ | :-------------------------------------------------- |
| **GitHub**           | `GITHUB_ID` / `GITHUB_SECRET`               | GitHub Developer Settings (OAuth Apps)              |
| **Google**           | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console (APIs & Services)              |
| **Email (Optional)** | `EMAIL_SERVER` / `EMAIL_FROM`               | SendGrid or SMTP (今回はゲストモード優先のため任意) |

## セッション設定
- **Strategy:** `database` (Database Adapterを使用)
  - 理由: ゲストユーザーのデータ保持やアカウントリンクを確実に行うため。
- **Seconds to expire:** 30 days (default)

## 必須環境変数 (Environment Variables)
以下の変数は、Static Web Apps の「アプリケーション設定」およびローカルの `.env` に設定します。

| キー                          | 説明                                                         |
| :---------------------------- | :----------------------------------------------------------- |
| `NEXTAUTH_URL`                | アプリケーションのベースURL (Local: `http://localhost:3000`) |
| `NEXTAUTH_SECRET`             | トークン署名・暗号化用のシークレットキー (openssl等で生成)   |
| `COSMOS_DB_CONNECTION_STRING` | DB接続用 (Adapterが使用)                                     |

## API連携 (Azure Functions)
- Webアプリ (Next.js) から API (Functions) を呼び出す際、CookieまたはAccessTokenをヘッダーに付与します。
- Functions側では、`NEXTAUTH_SECRET` を共有し、トークンの検証を行うか、または Cosmos DB の Session を参照して検証します（JWTモードの場合はSecret検証のみで可）。
