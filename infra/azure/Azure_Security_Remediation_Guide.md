# Azure インフラストラクチャ セキュリティ修正手順書

本ドキュメントでは、Cosmos DBのパブリックアクセス遮断およびKey Vault導入によるシークレット管理強化を行うための手順を記載します。

## 前提条件
- Azure CLI がインストールされ、ログイン済みであること (`az login`)。
- 対象のサブスクリプションにおいて `Owner` または `Contributor` 権限を有していること（Role Assignmentの作成に必要なため）。

## 1. 修正内容の概要 (Changes)
新たに作成された `infra/azure/secure-resources.bicep` には以下の変更が含まれています。

1.  **Azure Key Vault の追加**:
    - `COSMOS-DB-CONNECTION` および `AzureWebJobsStorage` をKey Vault Secretとして格納。
    - Managed Identity (System Assigned) を Function App に付与し、Key Vaultへのアクセス権 (Key Vault Secrets User) を設定。
2.  **ネットワーク閉域化 (VNet Integration)**:
    - **Virtual Network (VNet)**: `snet-function` (アプリ用) と `snet-private-endpoints` (DB用) を作成。
    - **Private Endpoint**: Cosmos DBへの接続をVNet経由のみに限定。
    - **Public Network Access Disabled**: Cosmos DBのパブリックアクセスを無効化。
3.  **App Service Plan のアップグレード**:
    - VNet統合をサポートするため、Planを `Available Dynamic` (Y1) から `Basic` (B1) へ変更しています。
    - **注意**: これにより月額コストが発生します（B1は約$13/月〜）。

## 2. デプロイ手順 (Deployment)

### 手順 1: Bicepファイルの切り替え
`infra/azure/main.bicep` ファイルを開き、モジュールの参照先を変更します。

```diff
module resources './resources.bicep' = {
-  name: 'resourcesDeployment'
+  name: 'secureResourcesDeployment'
+  params: {
+    // ... existing params
+    myIpAddress: 'YOUR_IP_ADDRESS' // (Optional) デプロイ中のアクセス確保用
+  }
}
```

※ 今回作成した `secure-resources.bicep` は `param myIpAddress string` を受け取るように設計されていますが、現状の `main.bicep` には渡すパラメータがありません。
**簡易的な適用方法**:
既存の `resources.bicep` をバックアップし、`secure-resources.bicep` の内容を `resources.bicep` に上書きコピーしてデプロイするのが最も確実です。

### 手順 2: デプロイの実行
PowerShell または Bash で以下を実行します。

```bash
# リソースグループ名や環境名は適切に変更してください
az deployment sub create \
  --location japaneast \
  --template-file ./infra/azure/main.bicep \
  --parameters rgName=rg-pm-exam-dx-prod envName=prod
```

### 手順 3: 動作確認
1.  **Azure Portal で確認**:
    - **Key Vault**: Secret に接続文字列が格納されているか確認。
    - **Cosmos DB**: [Networking] タブで "Public network access" が "Disabled" になっているか確認。
    - **Function App**: [Configuration] で `COSMOS_DB_CONNECTION` の値が `@Microsoft.KeyVault(...)` になっていることを確認し、Sourceカラムが緑色のチェックマーク（解決済み）になっているか確認。

2.  **アプリケーション動作確認**:
    - サイトにアクセスし、試験データが表示されるか確認（DB接続確認）。

## 3. 手動での設定変更 (Manual Configuration)
IaCを使用せず、Azure Portalから手動で設定する場合のガイドラインです。

### Key Vault 導入
1.  **Key Vault 作成**: "Key Vault" リソースを新規作成。
2.  **Secret 追加**: `COSMOS-DB-CONNECTION` という名前で接続文字列を登録。
3.  **ID付与**: Function App の [Identity] ブレードで "System assigned" を "On" にする。
4.  **アクセス許可**: Key Vault の [Access control (IAM)] で "Add role assignment" > "Key Vault Secrets User" を選択し、Function AppのManaged Identityを選択。
5.  **参照設定**: Function App の [Configuration] で値を `@Microsoft.KeyVault(VaultName=KV_NAME;SecretName=SECRET_NAME)` に変更。

### Network 閉域化 (Private Endpoint)
1.  **VNet 作成**: アドレス空間 (例: 10.0.0.0/16) を持つVNetを作成。
2.  **Private Endpoint 作成**: Cosmos DBの [Networking] タブから "Private Endpoint" を追加。Target sub-resourceは `Sql` を選択。
3.  **VNet 統合**: Function App の [Networking] ブレードから "VNet Integration" を設定し、VNet内の専用サブネットに参加させる。
4.  **パブリック無効化**: Cosmos DBの [Networking] で "Selected Networks" または "Disabled" を選択し、Firewallルールを削除。

---
> [!WARNING]
> Cost Impact: The proposed change upgrades the App Service Plan from Consumption (Y1) to Basic (B1) to support VNET Integration. Please review the pricing implications before applying.
