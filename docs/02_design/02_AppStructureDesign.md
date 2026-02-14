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

## 3. 広告機能 (AdSense Integration)

### 3.1 概要
アプリケーションにGoogle AdSenseを統合し、適切な位置に広告を表示します。

### 3.2 実装コンポーネント
```text
apps/web/components/common/
├── AdBanner.tsx           # Google AdSense広告バナーコンポーネント
└── AdBanner.module.css    # 広告バナーのスタイル
```

### 3.3 AdBanner コンポーネント仕様
- **Props**:
  - `dataAdSlot`: Google AdSenseのデータ広告スロットID
  - `dataAdFormat`: 広告の形式 ('auto' | 'horizontal' | 'vertical' | 'rectangle')
  - `dataFullWidthResponsive`: レスポンシブ広告の有効化 (boolean)
  - `className`: カスタムクラス名（オプション）

- **動作**:
  - 環境変数 `NEXT_PUBLIC_ADSENSE_CLIENT_ID` が設定されている場合のみ表示
  - クライアントサイドレンダリングのみ（SSRでは表示されない）
  - 広告のロード失敗時はエラーをコンソールに出力

### 3.4 広告配置箇所
1. **トップページ (`app/page.tsx`)**
   - ヒーローセクションと機能紹介セクションの間
   - フォーマット: `auto` (レスポンシブ)

2. **ダッシュボードレイアウト (`app/(main)/layout.tsx`)**
   - メインコンテンツの下部
   - フォーマット: `horizontal` (横長バナー)

### 3.5 環境変数
```env
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
```
- **本番環境**: 実際のGoogle AdSenseクライアントIDを設定
- **開発環境**: 設定しない場合は広告が表示されない（エラーなし）

### 3.6 スタイリング
- レスポンシブ対応：モバイルとデスクトップで適切な余白を設定
- ダークモード対応：広告は通常独自の背景を持つため、特別な調整は不要
- 広告コンテナには適度な `margin` と `padding` を設定し、コンテンツとの視覚的分離を確保
