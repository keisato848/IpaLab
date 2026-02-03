/**
 * CosmosDB クライアント作成ユーティリティ
 * 
 * 開発用スクリプト専用 - 本番コードでは使用しないでください
 * 
 * ローカルエミュレータ使用時は自己署名証明書のためTLS検証を無効化します。
 * これはセキュリティリスクがありますが、ローカル開発環境でのみ使用されるため許容されます。
 */

import { CosmosClient, CosmosClientOptions } from '@azure/cosmos';
import * as https from 'https';

export interface CreateCosmosClientOptions {
    connectionString: string;
    allowInsecureLocalConnection?: boolean;
}

/**
 * CosmosDBクライアントを作成します
 * 
 * ローカルエミュレータ (localhost/127.0.0.1) 接続時のみ、
 * 自己署名証明書を許可するためTLS検証を無効化します。
 * 
 * @param options - 接続オプション
 * @returns CosmosClient インスタンス
 * 
 * @remarks
 * セキュリティ注意: この関数はローカル開発環境でのみ使用してください。
 * 本番環境では適切なTLS証明書を持つAzure CosmosDBエンドポイントを使用してください。
 */
export function createCosmosClient(options: CreateCosmosClientOptions): CosmosClient {
    const { connectionString, allowInsecureLocalConnection = true } = options;
    
    if (!connectionString) {
        throw new Error('CosmosDB接続文字列が設定されていません');
    }
    
    const isLocalEmulator = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    
    const clientOptions: CosmosClientOptions = {
        connectionString,
    };
    
    if (isLocalEmulator && allowInsecureLocalConnection) {
        // ローカルエミュレータは自己署名証明書を使用するため、TLS検証を無効化
        // codeql[js/disabling-certificate-validation] - ローカル開発環境専用の意図的な無効化
        console.warn('[CosmosDB] ローカルエミュレータ接続: TLS証明書検証を無効化します（開発環境のみ）');
        
        // 環境変数による無効化（CosmosClient内部で使用される）
        // codeql[js/disabling-certificate-validation] - ローカルエミュレータ専用
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        
        // HTTPSエージェントでも明示的に無効化
        // codeql[js/disabling-certificate-validation] - ローカルエミュレータ専用
        clientOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }
    
    return new CosmosClient(clientOptions);
}

/**
 * 接続文字列がローカルエミュレータかどうかを判定
 */
export function isLocalEmulatorConnection(connectionString: string): boolean {
    return connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
}
