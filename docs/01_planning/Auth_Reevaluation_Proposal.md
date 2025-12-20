# 認証方針および基本設計の見直し案 (Re-evaluation of Auth Strategy)

ユーザー様のご指摘「一般公開アプリとしてEntra ID認証を全員に強いるのは現実的ではない」に基づき、認証戦略と基本設計の変更案を提示します。

## 課題分析
1.  **強制的なログイン:** 初回利用のハードルが高い。一般ユーザーは「まず使ってみたい」。
2.  **Entra IDの選定:** "Entra ID" という名称やUXが、B2B/Enterprise向けに見え、一般消費者 (B2C) にそぐわない懸念がある (実際にB2C版でもリダイレクト等が発生する)。

## 提案方針

### 方針A: ゲスト利用の解禁 (Guest Mode) **[推奨]**
認証なしで主要機能（問題演習）を利用可能にします。

- **未ログイン時:**
  - 学習履歴は `LocalStorage` または `Session` に一時保存。
  - 「履歴を保存する」タイミングでログインを促す。
- **ログイン時:**
  - サーバー側 (Cosmos DB) にデータを同期。
  - 複数デバイスでの学習が可能になる。

### 方針B: 認証プロバイダの変更 (Alternative Providers)
より一般コンシューマー向けな、開発者体験も良いプロバイダへ変更します。

| 候補                         | 特徴                      | メリット                                                                           | デメリット                                              |
| :--------------------------- | :------------------------ | :--------------------------------------------------------------------------------- | :------------------------------------------------------ |
| **1. NextAuth.js (Auth.js)** | Next.js標準的なライブラリ | DBで自前管理可能 (Cosmos DB Adapter)。完全なUIカスタマイズが可能。                 | 認証ロジックの自前実装が必要 (JWT管理など)。            |
| **2. Firebase Auth**         | Google提供のmBaas         | 無料枠が大きく、UIライブラリも豊富。匿名ログイン(Anonymous Auth)からの昇格が容易。 | Google Cloudへの依存が増える (Azure環境とのMixになる)。 |
| **3. Supabase Auth**         | OSS (PostgreSQLベース)    | RDBが使えるためリレーションが組みやすい。                                          | Cosmos DB (NoSQL) とのアーキテクチャ不整合。            |

## 推奨構成 (Revised Architecture)

**「NextAuth.js + ゲストモード」** を提案します。
Azure環境で完結させつつ、UIの自由度を最大化し、ゲスト利用を実現します。

1.  **ゲスト体験:**
    - トップページ -> 即演習スタート (Login不要)。
    - 結果画面 -> 「この結果を保存しますか？」 -> ログインモーダル表示。
2.  **認証基盤:**
    - **NextAuth.js** を採用。
    - **Provider:** GitHub, Google, Email (Magic Link)。
    - **Adapter:** ユーザー情報は Cosmos DB (`Users` コンテナ) に直接保存（Entra ID B2Cを経由しない）。

## 修正が必要なドキュメント
1.  `docs/01_planning/基本設計書.md` (機能要件: ゲスト利用の追加)
2.  `docs/01_planning/環境設計書.md` (構成: Entra ID B2C 削除 -> NextAuth.js 追加)
3.  `docs/02_design/03_DatabaseDesign.md` (Usersテーブル: NextAuth用フィールド追加)
4.  `docs/02_design/04_ScreenTransition.md` (LP -> 即Dashboard/Exam への遷移変更)

この方針で基本設計を更新してもよろしいでしょうか？
