# リバースエンジニアリング調査レポート

**調査対象**: IpaLab プロジェクト全体（モノレポ）  
**実行日**: 2026年4月7日  
**調査手法**: コードベース解析 + 実装との設計書乖離検証  

## エグゼクティブサマリー

IpaLab プロジェクトの実装状況を詳細調査し、`docs/02_design/` 配下の設計書と現状実装との乖離を検証。
**複数の重要な乖離を検出**し、実装に基づく設計書の更新を実施した。

| 項目 | 値 |
|------|-----|
| 調査対象ファイル数 | 200+ |
| 更新対象設計書 | 5ファイル |
| 検出された乖離項目 | 8件（高優先度: 1件、中優先度: 6件、低優先度: 1件） |
| 技術スタック変更 | Next.js 14.x → 16.2.1 |
| 新規サービス | apps/api-ai (AI専用サービス) |

## 調査したファイル一覧

### パッケージ構成
- `package.json` (ルート + 各パッケージ)
- `apps/web/`, `apps/api/`, `apps/api-ai/`
- `packages/data/`, `packages/shared/`, `packages/config/`, `packages/ui/`

### 実装解析対象
- `apps/web/app/` (全ページ・ルート)
- `apps/web/components/` (UIコンポーネント)
- `packages/shared/src/types/models.ts` (データモデル)
- Next.js API Routes (`apps/web/app/api/`)
- Azure Functions (`apps/api/src/`, `apps/api-ai/src/`)

### 設計書検証対象
- `docs/02_design/01_ConfigurationDesign.md`
- `docs/02_design/02_AppStructureDesign.md`
- `docs/02_design/03_DatabaseDesign.md`
- `docs/02_design/04_ScreenTransition.md`
- `docs/02_design/06_DeploymentDesign.md`

## 設計書と実装の乖離一覧

| 設計書 | 設計書記載 | 実装状況 | 重要度 | 乖離内容 |
|-------|-----------|---------|--------|---------|
| 02_AppStructureDesign.md | (auth), (dashboard) ルートグループ | (main) ルートグループ + 個別ページ | 🟡 Medium | ルート構造の設計変更 |
| 02_AppStructureDesign.md | packages/ui の活用 | packages/ui は空フォルダ | 🟡 Medium | UI共通化が未実装 |
| 01_ConfigurationDesign.md | packages/data の記載なし | packages/data が存在・重要な役割 | 🟡 Medium | データ管理パッケージの欠落 |
| 06_DeploymentDesign.md | "apps/api (未使用)" | apps/api, apps/api-ai 両方動作中 | 🔴 High | サービス構成の大幅な乖離 |
| 複数ファイル | Next.js 14.x | Next.js 16.2.1 | 🟡 Medium | フレームワークバージョン差異 |
| 04_ScreenTransition.md | 基本機能のみ記載 | plan/, admin/ 機能が実装済み | 🟡 Medium | 新機能の設計書未更新 |
| 03_DatabaseDesign.md | 基本的なモデル | LearningSession, 拡張フィールド追加 | 🟡 Medium | データモデルの進化 |
| 06_DeploymentDesign.md | apps/api-ai の記載なし | US Region AI専用サービス | 🟢 Low | AI構成の追加情報 |

## 重大な乖離・要注意点

### 1. 🔴 High: サービス構成の誤認（06_DeploymentDesign.md）
**影響**: インフラ運用・障害対応時の混乱を招く可能性  
設計書では "apps/api (未使用)" と記載されているが、実際は：
- **apps/api**: Azure Functions (East Asia, Port 7074) で稼働中
- **apps/api-ai**: Azure Functions (US East 2, Port 7075) で Gemini API プロキシとして稼働中

### 2. 🟡 Medium: データモデルの設計書遅れ
**影響**: 新機能開発時のデータ設計判断に影響  
**LearningSession モデル**等の新しいデータモデルが実装されているが設計書に反映されていない。

### 3. 🟡 Medium: Next.js バージョン差異
**影響**: デプロイ・互換性問題の可能性  
App Router の機能活用やビルド設定に差異が生じる可能性。

## 更新・作成したドキュメントの一覧

### 大幅更新済み
1. **[01_ConfigurationDesign.md](../02_design/01_ConfigurationDesign.md)**
   - packages/data セクション追加
   - apps/api-ai 構成追加
   - Next.js 16.2.1 対応
   - 環境設定詳細追加

2. **[02_AppStructureDesign.md](../02_design/02_AppStructureDesign.md)**
   - 実際の (main) ルートグループ構造に修正
   - apps/api-ai セクション追加
   - packages/data, packages/config の詳細追加
   - API プロキシ構成の明記

3. **[03_DatabaseDesign.md](../02_design/03_DatabaseDesign.md)**
   - LearningSession モデル追加
   - Question モデル拡張（PM试验对应、transcription等）
   - LearningRecord モデル拡張（sessionId, isFlagged等）
   - ER図更新（新しい関係性追加）

4. **[04_ScreenTransition.md](../02_design/04_ScreenTransition.md)**
   - サイトマップに plan/, admin/, privacy/, terms/ 追加
   - 画面遷移図の詳細化（新機能含む）
   - ワイヤーフレーム要件の拡充

5. **[06_DeploymentDesign.md](../02_design/06_DeploymentDesign.md)**
   - アーキテクチャ図の詳細化（マルチリージョン対応）
   - Next.js 16.2.1 対応記載
   - apps/api, apps/api-ai の正確な記載

### 新規作成
6. **[ReverseEngineering_Review_20260407.md](ReverseEngineering_Review_20260407.md)** (本ファイル)

## 技術スタック現状

### フロントエンド
- **Next.js**: 16.2.1 (App Router)
- **React**: 18.3.1
- **Node.js**: 20 (LTS)
- **TypeScript**: 5.4.5

### バックエンド
- **Azure Functions**: Node.js v4
- **CosmosDB**: Serverless（East Asia）
- **AI API**: Google Gemini（US East 2 経由）

### ツール・ライブラリ
- **monorepo**: npm workspaces + Turborepo
- **テスト**: Vitest (unit) + Playwright (E2E)
- **認証**: NextAuth.js v4
- **UI**: CSS Modules + React Icons
- **データ**: Zod (型安全性) + Azure Cosmos SDK

## 推奨事項

### 短期（1-2週間）
1. **設計書の定期メンテナンス体制構築**
   - コード変更時の設計書同期ルールの強化
   - PRレビュー時の設計書チェック項目追加

2. **packages/ui の活用検討**
   - 現在空フォルダの packages/ui の将来方針決定
   - 共有UI コンポーネントの分離検討

### 中期（1ヶ月）
3. **データモデル仕様の固定化**
   - LearningSession 等の新モデルの運用検証
   - DB パフォーマンス監視・最適化

4. **API 構成の文書化強化**
   - apps/api と apps/api-ai の責務分離明確化
   - 障害時対応手順書の整備

### 長期（3ヶ月）
5. **アーキテクチャ進化の計画**
   - マイクロサービス化の検討（必要に応じて）
   - パフォーマンス最適化ロードマップ

## 結論

IpaLab プロジェクトは**実装が設計書を上回るペースで進化**しており、特に AI 機能、データモデル、画面機能の拡張が顕著である。設計書の更新により現状実装との整合性は取れたが、今後は**継続的な設計書メンテナンス体制**の構築が重要である。

技術的負債は最小限に抑えられており、Next.js 16.2.1 + Azure Static Web Apps の構成は安定している。引き続き段階的な改善を進めることで、スケーラブルなシステムとして発展可能である。