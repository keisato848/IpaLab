# 詳細設計書: アプリケーション内部構造 (App Structure Design)

`apps/web` (Next.js) および `apps/api` (Azure Functions) の内部ディレクトリ構造と責務分離について定義します。

## 1. Web (`apps/web`) - Next.js App Router

### 1.1 ディレクトリ構造
```text
apps/web/
├── app/                    # App Router Root
│   ├── (auth)/             # 認証関連 (Route Group)
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/        # メイン機能 (認証必須)
│   │   ├── layout.tsx      # Dashboard Layout (Sidebar etc)
│   │   ├── page.tsx        # Dashboard Top
│   │   └── practice/       # 演習画面
│   ├── api/                # Next.js Route Handlers (BFFとして利用する場合のみ)
│   ├── layout.tsx          # Root Layout
│   └── globals.css         # Global Styles (Reset & Variables)
├── components/             # コンポーネント
│   ├── ui/                 # 汎用 UI パーツ (Button, Card, Input) - 状態を持たない
│   ├── features/           # 機能単位コンポーネント (AuthForm, QuestionCard) - ドメイン知識を持つ
│   └── layouts/            # レイアウト用 (Header, Sidebar)
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
│   │   ├── httpStartExam.ts
│   │   └── httpSubmitAnswer.ts
│   ├── services/           # ビジネスロジック
│   │   ├── examService.ts
│   │   └── spacedRepetitionService.ts
│   ├── models/             # DBモデル / DTO
│   ├── repositories/       # データアクセス (Cosmos DB)
│   └── utils/              # 共通ユーティリティ
├── host.json               # Functions Host Config
├── local.settings.json     # ローカル環境変数 (gitignore)
└── package.json
```

### 2.2 責務分離
- **Functions**: HTTPリクエストの受付、バリデーション、Service呼び出し、レスポンス返却のみを行う。ロジックは書かない。
- **Services**: ビジネスロジックの実体。`packages/shared` のロジックを利用する場合もある。
- **Repositories**: DB操作を隠蔽する。
