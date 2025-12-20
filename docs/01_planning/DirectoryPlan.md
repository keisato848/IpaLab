# ディレクトリ構成見直し計画 (Directory Restructuring Plan)

「基本設計書」で策定したMonorepo構成に基づき、現状のフラットな構造からスケーラブルな構成へ移行します。
フォルダ名は全て**英数字のみ (Alphanumeric)** とします。

## 1. 変更方針
- **`Agents` フォルダの廃止と `docs` への統合:**
  - AIとの対話ログや要件定義書はプロジェクトの重要なドキュメント資産として `docs` 配下で一元管理します。
- **Monorepo基本階層の作成:**
  - `apps`, `packages`, `infra` を新規作成し、今後の開発の受け皿とします。

## 2. 新ディレクトリ構成案

```text
IpaLab/
├── apps/                   # [NEW] アプリケーションコード
│   ├── web/                # (Next.js)
│   ├── mobile/             # (Expo)
│   └── api/                # (Azure Functions)
├── packages/               # [NEW] 共通ライブラリ
│   ├── shared/             # (Shared Logic)
│   ├── ui/                 # (Shared UI)
│   └── config/             # (Shared Config)
├── infra/                  # [NEW] インフラ構成
│   └── azure/              # (Bicep/Terraform)
├── docs/                   # [NEW] ドキュメント
│   ├── 01_planning/        # (Old: Agents/010_Plan) - 要件定義, 設計書
│   │   └── azure_config/   # (Old: Agents/010_Plan/AzureConfig)
│   └── agent_logs/         # (Old: Agents/*.md) - 対話ログ
└── .gitignore              # (Existing)
```

## 3. 実行手順
1. **新規ディレクトリ作成:** `apps/web`, `apps/mobile`, `apps/api`, `packages/shared` etc.
2. **ドキュメント移動:**
   - `Agents/010_Plan/*` -> `docs/01_planning/*`
   - `Agents/log_*.md` -> `docs/agent_logs/*`
   - `Agents/rules.md` -> `docs/rules.md`
3. **`Agents` フォルダ削除:** (空になった後)
4. **リンク修正:** 設計書内の相対パス参照があれば修正（今回はなさそうだが確認）。

## 4. ユーザーへの影響
- 現在の `Active Document` のパスが変更されるため、VSCode上で再オープンが必要になる場合があります。
