# 詳細設計書: データ管理・入稿フロー (Data Management)

管理者による問題・解説データの登録・更新方法について定義します。
初期フェーズ（MVP）では、専用の管理画面（Admin UI）を作成するコストを抑え、かつデータの品質管理（レビュビリティ）を高めるため、**ファイルベースのデータ管理 (GitOps)** を採用します。

## 1. データ管理方針

**「Gitリポジトリを正として管理し、DBへ同期する」**

- **Master Data:** Gitリポジトリ内の `data/` ディレクトリに JSON/Markdown 形式で保存。
- **Database (Cosmos DB):** アプリケーションからの参照用キャッシュとして機能。
- **Sync Tool:** 管理者用コマンドラインツール (`npm run db:sync`) で同期。

### メリット
1.  **バージョン管理:** 問題文の修正履歴がGitに残る。
2.  **レビュー体制:** Pull Request ベースで解説の内容をレビューできる（誤字脱字、解説の質向上）。
3.  **開発効率:** Admin画面のUI実装工数を削減できる。Markdownエディタ(VS Code等)で快適に執筆できる。

## 2. ディレクトリ構造 (`packages/data`)

データ管理用のパッケージを新設します。

```text
packages/data/
├── src/
│   ├── seeds/              # シードデータ
│   │   ├── AP-2023-Spring/
│   │   │   ├── am1.json    # 午前I
│   │   │   ├── am2.json    # 午前II
│   │   │   └── pm1/        # 午後I (記述式は長文のため分割検討)
│   │   │       ├── q1.md
│   │   │       └── q2.md
│   └── scripts/            # 同期用スクリプト (TypeScript)
│       └── sync-db.ts
├── package.json
└── tsconfig.json
```

## 3. データフォーマット例 (`am1.json`)

```json
[
  {
    "id": "AP-2023-Spring-AM1-01",
    "examId": "AP-2023-Spring",
    "type": "AM1",
    "catetory": "Technology",
    "subCategory": "Security",
    "text": "情報セキュリティマネジメントシステムにおける...",
    "options": [
      { "id": "a", "text": "..." },
      { "id": "b", "text": "..." }
    ],
    "correctOption": "a",
    "explanation": "## 解説\n\nこの問題は..."
  }
]
```

## 4. 運用フロー

1.  **データ追加:** 開発者/管理者が `packages/data` にJSON/MDファイルを追加・修正。
2.  **レビュー:** GitHub上でPR作成 -> レビュー -> マージ。
3.  **同期:**
    - **Local:** `npm run db:sync` を実行してローカルDBに反映。
    - **Production:** CDパイプライン (GitHub Actions) で自動同期、または管理者が手動でスクリプト実行。

## 5. 将来的な拡張 (Future)

運用が定着し、非エンジニアがコンテンツ制作に関わるようになった段階で、以下のいずれかを検討します。
- **Admin UI:** `apps/web/admin` ルートを作成し、API経由で更新（NextAuth.jsで管理者権限制御）。
- **Headless CMS:** データソースをCMSに移行。
