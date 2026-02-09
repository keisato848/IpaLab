# NextAuth.js 認証設定設計書 (旧: Entra ID B2C)

## 基本情報
- **設定項目 ID:** AUTH-001 (Modified)
- **ライブラリ:** NextAuth.js v4.24.13
- **実行環境:** Azure Static Web Apps (Next.js App Router)
- **データストア:** Azure Cosmos DB (`Users`, `Accounts`)

## 認証プロバイダ構成
| プロバイダ           | 環境変数 (Key)                              | 取得元                                              | 状態     |
| :------------------- | :------------------------------------------ | :-------------------------------------------------- | :------- |
| **GitHub**           | `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`     | GitHub Developer Settings (OAuth Apps)              | ✅ 有効  |
| **Google**           | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`     | Google Cloud Console (APIs & Services)              | ✅ 有効  |
| **Email (Optional)** | `EMAIL_SERVER` / `EMAIL_FROM`               | SendGrid or SMTP (今回はゲストモード優先のため任意) | ⏸️ 未使用 |

## Google OAuth 設定詳細
- **authorization パラメータ**:
  - `prompt: "consent"` — 毎回同意画面を表示（アカウント選択を促す）
  - `access_type: "offline"` — リフレッシュトークンを取得
  - `response_type: "code"` — 認証コードフロー
- **必要なスコープ**: `email`, `profile`, `openid` (NextAuth が自動設定)
- **OAuth 同意画面**: 「外部」ユーザータイプで本番公開ステータス

## セッション設定
- **Strategy:** `jwt` (JWT ベース)
  - 理由: Azure SWA のサーバーレス環境でのパフォーマンスを優先。
  - アダプターは ユーザー/アカウント作成・リンクに使用。
- **JWT 暗号化**: `NEXTAUTH_SECRET` 環境変数で署名

## 必須環境変数 (Environment Variables)
以下の変数は、Static Web Apps の「アプリケーション設定」およびローカルの `.env.local` に設定します。

| キー                          | 必須 | 説明                                                     |
| :---------------------------- | :--- | :------------------------------------------------------- |
| `NEXTAUTH_SECRET`             | ✅   | JWT 署名・暗号化用のシークレットキー (`openssl rand -base64 32`) |
| `NEXTAUTH_URL`                | ✅   | アプリケーションのベースURL (本番: `https://shikaku-no.com`) |
| `AUTH_TRUST_HOST`             | ✅   | Azure SWA では `true` を設定                             |
| `AUTH_GITHUB_ID`              | ✅   | GitHub OAuth Client ID                                   |
| `AUTH_GITHUB_SECRET`          | ✅   | GitHub OAuth Client Secret                               |
| `AUTH_GOOGLE_ID`              | ✅   | Google OAuth Client ID                                   |
| `AUTH_GOOGLE_SECRET`          | ✅   | Google OAuth Client Secret                               |
| `COSMOS_DB_CONNECTION`        | ✅   | CosmosDB 接続文字列 (Adapter が使用)                     |

## コールバック URL
| プロバイダ | ローカル開発                                    | 本番                                              |
| :--------- | :---------------------------------------------- | :------------------------------------------------ |
| GitHub     | `http://localhost:3000/api/auth/callback/github` | `https://shikaku-no.com/api/auth/callback/github` |
| Google     | `http://localhost:3000/api/auth/callback/google` | `https://shikaku-no.com/api/auth/callback/google` |

## API連携 (Azure Functions)
- Webアプリ (Next.js) から API (Functions) を呼び出す際、CookieまたはAccessTokenをヘッダーに付与します。
- Functions側では、`NEXTAUTH_SECRET` を共有し、トークンの検証を行います（JWTモードのためSecret検証のみで可）。
