# Shikakuno (シカクノ) - IPA 情報処理技術者試験 学習プラットフォーム

[![Azure App Service CI/CD](https://github.com/keisato848/IpaLab/actions/workflows/azure-app-service.yml/badge.svg)](https://github.com/keisato848/IpaLab/actions/workflows/azure-app-service.yml)

**Shikakuno (シカクノ)** は、IPA（情報処理推進機構）の試験対策に特化したインテリジェントな学習プラットフォームです。最先端の **AI 記述式採点システム** を搭載しており、独学では採点が難しい午後試験の記述式問題に対し、即座に分析的なフィードバックを提供します。

## 目次

- [主な機能](#-主な機能)
- [技術スタック](#-技術スタック)
- [システム構成](#-システム構成)
- [プロジェクト構造](#-プロジェクト構造)
- [セットアップ](#-セットアップ)
- [利用可能なスクリプト](#-利用可能なスクリプト)

## ✨ 主な機能

- **AI 自動採点**: Google Gemini Pro モデルを活用し、午後試験の記述式回答に対して多角的なフィードバックを即座に生成します。
- **CLKS 分析**: 回答を **C**ontext (文脈)、**L**ogic (論理)、**K**eyword (キーワード)、**S**pecificity (具体性) の4軸で評価し、レーダーチャートで可視化します。
- **インタラクティブ演習**: 午前試験の多肢選択問題に対応し、即座に正誤判定と解説を確認できます。
- **学習進捗管理**: 学習履歴、正答率、進捗状況を詳細な統計データとグラフで管理できます。
- **モダンな UI/UX**: デスクトップ・モバイルの両方に最適化されたレスポンシブデザインとダークモードを搭載しています。

## 🛠️ 技術スタック

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Monorepo**: Turborepo & npm Workspaces
- **Backend**: Azure Functions v4 (Node.js 20)
- **Database**: Azure Cosmos DB (NoSQL, Serverless)
- **AI**: Google Gemini (`@google/generative-ai`)
- **Authentication**: NextAuth.js v4 (Google, GitHub)
- **Hosting**: Azure App Service (Next.js Standalone mode)
- **AI API**: Azure Functions (US East 2) - Gemini API 地域制限対応
- **UI Libraries**: React 18, Recharts (グラフ), React Markdown, KaTeX (数式), Mermaid (図表)
- **Styling**: CSS Modules
- **Validation**: Zod
- **Monitoring**: Azure Application Insights
- **Testing**: Vitest (Unit), Playwright (E2E)
- **CI/CD**: GitHub Actions

## 🧩 システム構成

本システムは、Azure App Service 上で Next.js アプリケーションが動作し、AI 機能は US リージョンの Azure Functions で処理する構成となっています。

```mermaid
graph TD
    subgraph Client [クライアント]
        Browser[Web Browser]
    end

    subgraph Azure_EastAsia [Azure East Asia]
        AppService["App Service\n(Next.js Standalone)"]
        CosmosDB[(Azure Cosmos DB)]
        AppInsights[Application Insights]
    end

    subgraph Azure_USEast2 [Azure US East 2]
        FuncAI["Azure Functions\n(api-ai)"]
    end
    
    subgraph External [外部サービス]
        Gemini[Google Gemini API]
        Auth["OAuth Providers (GitHub/Google)"]
    end

    Browser -- "HTTPS" --> AppService
    AppService -- "Data Access" --> CosmosDB
    AppService -- "/api/ai/plan (Proxy)" --> FuncAI
    FuncAI -- "AI Analysis" --> Gemini
    AppService -- "Telemetry" --> AppInsights
    AppService -- "Auth Redirect" --> Auth
```

### AI API プロキシ構成

Gemini API は US リージョンからのみ呼び出し可能なため、以下のプロキシ構成を採用しています。

```
[ユーザー] → [shikaku-no.com (East Asia App Service)]
                    ↓
           [Next.js API Route: /api/ai/plan]
                    ↓ (プロキシ)
           [func-pm-exam-dx-ai-us.azurewebsites.net (US East 2)]
                    ↓
           [Gemini API]
```

### データフロー (AI採点)

```mermaid
sequenceDiagram
    autonumber
    participant User as ユーザー
    participant NextJS as "Next.js (App Service)"
    participant FuncAI as "Azure Functions (US)"
    participant Gemini as Google Gemini
    participant DB as Cosmos DB

    User->>NextJS: 回答を入力して「採点」をクリック
    NextJS->>NextJS: /api/ai/plan へリクエスト
    NextJS->>FuncAI: プロキシ転送
    FuncAI->>DB: 問題データを取得
    FuncAI->>Gemini: プロンプトを送信
    Gemini-->>FuncAI: 採点結果・CLKSスコア
    FuncAI->>DB: 学習履歴を保存
    FuncAI-->>NextJS: 採点結果 JSON
    NextJS-->>User: 結果とチャートを表示
```

## 📂 プロジェクト構造

Turborepo を使用したモノレポ構成です。

- `apps/web`: メインの Next.js アプリケーション。UI、APIルート、フロントエンドロジックを含みます。Azure App Service にデプロイされます。
- `apps/api-ai`: AI 採点用 Azure Functions。US East 2 リージョンにデプロイされ、Gemini API を呼び出します。
- `apps/api`: 汎用 Azure Functions API。East Asia リージョンで稼働し、CosmosDB へのデータアクセスを担います。
- `packages/data`: 過去問データのスクレイピング、加工、データベース同期用スクリプト。
- `packages/shared`: モノレポ全体で共有される TypeScript 型定義やユーティリティ関数。
- `packages/ui`: 共有 UI コンポーネントライブラリ（開発中）。
- `packages/config`: ESLint や TypeScript の共有設定。

## 🚀 セットアップ

### 1. 前提条件

- Node.js v20 以降
- npm v10 以降

### 2. インストール

リポジトリをクローンし、ルートディレクトリで依存関係をインストールします。

```bash
git clone https://github.com/keisato848/IpaLab.git
cd IpaLab
npm install
```

### 3. 環境変数

Web アプリケーションには API キーやデータベース接続情報が必要です。

1.  Web アプリディレクトリへ移動: `cd apps/web`
2.  テンプレートからローカル環境変数ファイルを作成:
    ```bash
    cp .env.template .env.local
    ```
3.  `.env.local` を編集し、以下の変数を設定してください。
    - **認証 (NextAuth.js)**: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` 等
    - **データベース (Azure Cosmos DB)**: `COSMOS_DB_ENDPOINT`, `COSMOS_DB_KEY`
    - **AI (Google Gemini)**: `GEMINI_API_KEY`

### 4. 開発サーバーの起動

プロジェクトルートに戻り、開発用スクリプトを実行します。

```bash
# プロジェクトルートで実行
npm run dev
```

Next.js 開発サーバーが起動し、通常は `http://localhost:3000` でアクセスできます。

## 📊 テストデータ管理

試験データ（過去問、解説など）の管理は `packages/data` パッケージで行います。

### 主なツールとコマンド

`packages/data` ディレクトリで以下のコマンドを実行することで、データの抽出、加工、データベースへの同期を行えます。

- **データ抽出**:
  ```bash
  npm run extract -w packages/data
  ```
  PDF等のソースからテキストデータを抽出します。

- **データベース同期**:
  ```bash
  npm run sync-db -w packages/data
  ```
  ローカルのJSONデータを Azure Cosmos DB に同期（Upsert）します。

- **整合性チェック**:
  ```bash
  npx ts-node src/scripts/check-duplicates.ts
  ```
  データの重複や欠損を確認します。

詳細な手順については、[DATA_IMPORT_SOP.md](packages/data/DATA_IMPORT_SOP.md) を参照してください。

### Webアプリでのデータ利用

`apps/web` のビルド時（`npm run build` または `npm run dev`）に、`packages/data/data/questions` 配下のデータが自動的に `apps/web/data/questions` にコピーされ、アプリケーションから利用可能になります。開発者が手動でファイルをコピーする必要はありません。

## 📜 利用可能なスクリプト

プロジェクトルートから以下のコマンドを実行できます。

- `npm run dev`: 全アプリケーションの開発サーバーを起動します。
- `npm run build`: 本番用に全アプリケーションをビルドします。
- `npm run test`: テストを実行します。
- `npm run test:unit`: Webアプリのユニットテスト（Vitest）を実行します。
- `npm run test:e2e`: E2Eテスト（Playwright）を実行します。
- `npm run lint`: コードの静的解析を実行します。
- `npm run format`: Prettier を使用してコードをフォーマットします。