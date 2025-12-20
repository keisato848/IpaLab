# Microsoft Entra ID B2C 設定設計書

## 基本情報
- **設定項目 ID:** AUTH-001
- **リソース種別:** Azure Active Directory B2C
- **名称 (初期ドメイン):** `pmexamdx.onmicrosoft.com`
- **組織名:** `PM Exam DX`

## 詳細設定
| 項目                 | 設定値                          | 備考                                                           |
| :------------------- | :------------------------------ | :------------------------------------------------------------- |
| **リソースグループ** | `rg-pm-exam-dx-prod`            | ※B2Cテナントリソースへのリンク                                 |
| **価格レベル**       | External Identities (MAUベース) | 月間アクティブユーザー数50,000人まで無料 (P1/P2機能なしの場合) |
| **ロケーション**     | Japan (日本)                    | データレジデンシー                                             |

## ユーザーフロー (User Flows)
| フロー名              | タイプ                   | 構成                                      |
| :-------------------- | :----------------------- | :---------------------------------------- |
| `B2C_1_SignUpIn`      | サインアップとサインイン | ローカルアカウント(Email), Google, GitHub |
| `B2C_1_PasswordReset` | パスワードリセット       | Email検証                                 |
| `B2C_1_ProfileEdit`   | プロファイル編集         | 表示名などの変更                          |

## アプリの登録 (App Registrations)
- **名前:** `PM Exam DX App`
- **リダイレクトURI:**
  - Web: `https://pm-exam-dx.com/api/auth/callback` (NextAuth.js等)
  - Mobile: `exp://...` (Expo Go / Build URL)
