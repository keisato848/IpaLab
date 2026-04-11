# 詳細設計書: アプリケーション内部構造 (App Structure Design)

`apps/web` (Next.js)、`apps/api` (Azure Functions)、および `apps/api-ai` (AI専用 Azure Functions) の内部ディレクトリ構造と責務分離について定義します。

## 1. Web (`apps/web`) - Next.js App Router

### 1.1 ディレクトリ構造
```text
apps/web/
├── app/                    # App Router Root
│   ├── (main)/             # メイン機能 (Route Group)
│   │   ├── layout.tsx      # Dashboard Layout (Sidebar etc)
│   │   ├── dashboard/      # ダッシュボード画面
│   │   ├── exam/           # 試験・演習画面
│   │   ├── history/        # 学習履歴画面
│   │   ├── plan/           # 学習計画画面
│   │   ├── settings/       # 設定画面
│   │   └── admin/          # 管理機能画面
│   ├── login/              # ログイン画面（認証関連）
│   ├── privacy/            # プライバシーポリシー
│   ├── terms/              # 利用規約
│   ├── api/                # Next.js Route Handlers (BFF + Azure Functions プロキシ)
│   ├── layout.tsx          # Root Layout
│   └── globals.css         # Global Styles (Reset & Variables)
├── components/             # コンポーネント
│   ├── ui/                 # 汎用 UI パーツ (Button, Card, Input) - 状態を持たない
│   ├── features/           # 機能単位コンポーネント (AuthForm, QuestionCard) - ドメイン知識を持つ
│   ├── common/             # 共通コンポーネント
│   └── providers/          # React Context Providers
├── lib/                    # ユーティリティ
│   ├── api-client.ts       # Backend API 呼び出しクライアント
│   └── utils.ts            # クラス名結合などの便利関数
├── hooks/                  # Custom Hooks
└── types/                  # Webアプリ固有の型定義
```

### 1.2 コンポーネント設計原則
- **Atomic Designは採用しない**: 機能単位 (`features`) と 汎用単位 (`ui`) の2層構造とする。
- **Server Components**: 可能な限り `app` ディレクトリ配下は Server Components とし、対話が必要な末端のみ `"use client"` を付与する。
- **Styling**: 各コンポーネントディレクトリに `ComponentName.module.css` を配置するか、`globals.css` の変数を利用する。

## 2. API (`apps/api`) - Azure Functions Node.js v4

### 2.1 ディレクトリ構造
```text
apps/api/
├── src/
│   ├── functions/          # Function Entry Points (Triggers)
│   ├── services/           # ビジネスロジック
│   └── repositories/       # データアクセス (Cosmos DB)
├── host.json               # Functions Host Config
├── local.settings.json     # ローカル環境変数 (gitignore)
└── package.json
```

### 2.2 責務分離
- **Functions**: HTTPリクエストの受付、バリデーション、Service呼び出し、レスポンス返却のみを行う。ロジックは書かない。
- **Services**: ビジネスロジックの実体。`packages/shared` のロジックを利用する場合もある。
- **Repositories**: DB操作を隠蔽する。

## 3. AI API (`apps/api-ai`) - Azure Functions Node.js v4 (US Region)

### 3.1 概要
Google Gemini API の地域制限（US リージョンのみ対応）により、AI 機能専用の Azure Functions を US East 2 リージョンに配置。

### 3.2 ディレクトリ構造
```text
apps/api-ai/
├── src/
│   ├── functions/          # AI 専用 Function Entry Points
│   └── utils/              # AI 処理用ユーティリティ
├── host.json               # Functions Host Config
├── local.settings.json     # ローカル環境変数 (gitignore)
└── package.json
```

### 3.3 責務
- **Gemini API プロキシ**: フロントエンドからの AI リクエストを Gemini API に転送
- **メトリクス記録**: AI 利用状況を CosmosDB に記録
- **エラーハンドリング**: Gemini API の制限・障害時のフォールバック処理

## 4. 共有パッケージ (`packages/`)

### 4.1 `packages/config`
**目的**: ESLint・TypeScript 設定の一元管理

```text
packages/config/
├── eslint-preset.js        # 共通 ESLint ルール
├── tsconfig.base.json      # 共通 TypeScript 設定
└── package.json
```

### 4.2 `packages/shared`
**目的**: 型定義と純粋関数の共有

```text
packages/shared/
├── src/
│   ├── types/
│   │   └── models.ts       # データモデル型定義（Zod スキーマ）
│   ├── utils/              # 純粋関数ユーティリティ
│   └── index.ts            # エクスポート集約
└── package.json
```

**依存関係**: zod（型安全性）、date-fns（日付操作）

### 4.3 `packages/data`
**目的**: データスクレイピング・DB 同期・問題管理

```text
packages/data/
├── src/
│   ├── scraper/           # IPA サイトスクレイピング
│   ├── syncer/            # CosmosDB 同期処理
│   ├── scripts/           # 各種データ処理スクリプト
│   └── utils/             # データ処理ユーティリティ
├── data/                  # ローカルデータファイル格納
│   ├── raw/               # スクレイピング生データ
│   └── verified/          # 検証済みデータ
└── package.json
```

**主要スクリプト**:
- `npm run scrape`: IPA サイトからの答案データスクレイピング
- `npm run sync-db`: CosmosDB への問題データ同期
- `npm run extract`: Gemini を使用した問題データ抽出
- `npm run test-gemini`: AI モデルテスト

### 4.4 `packages/ui`
**目的**: 共有UIコンポーネント（将来予約）

**現状**: 空フォルダ（未実装）
**将来構想**: React コンポーネントライブラリとしての活用を検討

## 5. コンポーネント設計原則

### 5.1 Web アプリケーション構成
- **Atomic Designは採用しない**: 機能単位 (`features`) と 汎用単位 (`ui`) の2層構造とする。
- **Server Components**: 可能な限り `app` ディレクトリ配下は Server Components とし、対話が必要な末端のみ `"use client"` を付与する。
- **Styling**: 各コンポーネントディレクトリに `ComponentName.module.css` を配置するか、`globals.css` の変数を利用する。
- **Providers**: React Context は `components/providers/` に集約し、必要最小限のスコープで提供する。

## 6. API プロキシ構成

### 6.1 プロキシフロー
```text
[フロントエンド] → [Next.js API Routes] → [Azure Functions]
                                     ↓
                               [外部API (Gemini)]
```

### 6.2 API Routes 構成
- **`/api/auth`**: NextAuth.js 認証処理
- **`/api/ai`**: AI 機能（api-ai へのプロキシ）
- **`/api/exam-progress`**: 学習進捗管理
- **`/api/exams`**: 試験・問題データアクセス
- **`/api/admin`**: 管理機能
- **`/api/track`**: アクセス分析・テレメトリ

## 変更履歴

- **2026-04-07**: リバースエンジニアリングによる大幅更新
  - 実装に合わせたルート構造の修正（(main) グループ構造）
  - apps/api-ai の追加（US Region AI サービス）
  - packages/data の詳細追加
  - 実装済み機能（plan/, admin/）の記載追加
  - API プロキシ構成の詳細化
