# Azure App Service 設定設計書

## 注意

本設計書は移行計画の一部として作成されています。
詳細は [03_migration/01_Azure_AppService_Design.md](../../03_migration/01_Azure_AppService_Design.md) を参照してください。

## 基本情報

- **設定項目 ID:** APPSVC-001
- **リソース種別:** Azure App Service (Web App)
- **名称:** `app-pm-exam-dx-prod`
- **ステータス:** 移行計画中

## 関連ドキュメント

- [移行概要](../../03_migration/00_Migration_Overview.md)
- [App Service 詳細設計](../../03_migration/01_Azure_AppService_Design.md)
- [ソースコード変更点](../../03_migration/02_Source_Code_Changes.md)
- [CI/CD 設計](../../03_migration/03_CICD_Workflow_Design.md)
- [テスト・検証計画](../../03_migration/04_Test_Verification_Plan.md)
- [ロールバック計画](../../03_migration/05_Rollback_Plan.md)

## 移行前後の比較

| 項目 | 移行前 (SWA) | 移行後 (App Service) |
|------|-------------|---------------------|
| リソース名 | `swa-pm-exam-dx-prod` | `app-pm-exam-dx-prod` |
| SKU | Standard | B1 (Basic) |
| 月額コスト | ~$9 | ~$13 |
| Application Insights | 手動 SDK 統合 | コードレス監視 |
| Node.js 制御 | 制限あり | 完全制御 |
