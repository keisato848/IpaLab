# 詳細設計書: プロジェクト構成・設定 (Configuration Design)

本ドキュメントは、Monorepo全体の構成、共通ツール、各パッケージの設定詳細を定義します。

## 1. Monorepo 構成 (Turborepo)

### 1.1 ルート `package.json`
- **Workspaces**:
  - `apps/*`: アプリケーション (Web, API, Mobile)
  - `packages/*`: 共通ライブラリ
- **Scripts**:
  - `dev`: `turbo run dev`
  - `build`: `turbo run build`
  - `lint`: `turbo run lint`
  - `test`: `turbo run test`
  - `clean`: `turbo run clean` (各パッケージの `dist`, `.turbo`, `node_modules` 削除)
- **PackageManager**: `npm` (または `pnpm` 推奨だが、環境設計書に準拠) -> *環境設計書に記載ないため `npm` をデフォルトとする。*

### 1.2 `turbo.json` パイプライン
- **build**:
  - DependsOn: `^build`
  - Outputs: `.next/**`, `dist/**`, `build/**`
- **dev**:
  - Cache: `false`
  - Persistent: `true`
- **lint**:
  - Outputs: []

## 2. 共通パッケージ (`packages/`)

### 2.1 `packages/config`
設定ファイルを一元管理し、各アプリから `extends` して利用します。

- **`tsconfig.base.json`**:
  - `target`: `es2022`
  - `module`: `esnext`
  - `moduleResolution`: `bundler`
  - `strict`: `true`
  - `skipLibCheck`: `true`
  - `isolatedModules`: `true`

- **`eslint-preset.js`**:
  - `extends`: `["next/core-web-vitals", "prettier"]` (Web用)
  - ルール: `console.log` 警告, `unused-vars` エラー等。

### 2.2 `packages/shared`
型定義と純粋関数ロジック。UIには依存しない。
- **Entry**: `src/index.ts`
- **Exports**: `package.json` で `exports` フィールドを定義。
- **Dependencies**: 外部依存は最小限に抑える (`zod`, `date-fns` 等は可)。

## 3. アプリケーション設定

### 3.1 Web (`apps/web`)
- **Framework**: Next.js 14+ (App Router)
- **Styling**: CSS Modules (`*.module.css`)
- **Lint**: `packages/config/eslint-preset` を使用。
- **TSConfig**: `packages/config/tsconfig.base.json` を extends。

### 3.2 API (`apps/api`)
- **Runtime**: Node.js v20
- **Structure**: Azure Functions Node.js Model v4
- **TSConfig**: `packages/config/tsconfig.base.json` を extends。
