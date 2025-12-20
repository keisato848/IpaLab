# ディレクトリ構成 (Directory Structure)

本プロジェクトは Monorepo 構成を採用しています。

```text
IpaLab/
├── apps/               # アプリケーション
│   ├── web/            # Next.js Frontend
│   ├── mobile/         # React Native (Expo) Mobile App
│   └── api/            # Azure Functions Backend
├── packages/           # 共通ライブラリ
│   ├── shared/         # 共通ロジック
│   └── ui/             # 共通UIコンポーネント
├── infra/              # インフラコード
│   └── azure/          # Bicep/Terraform
└── docs/               # プロジェクトドキュメント
    ├── 01_planning/    # 要件定義、基本設計、構成設計
    └── agent_logs/     # AIエージェント対話ログ
```

## 注意事項
- フォルダ名は全て英数小文字 (kebab-case) を推奨します。
- `Active Document` のパスが以前と異なるためご注意ください。
