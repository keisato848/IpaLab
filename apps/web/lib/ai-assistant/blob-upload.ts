import {
    BlobServiceClient,
    BlobSASPermissions,
    SASProtocol,
    generateBlobSASQueryParameters,
    StorageSharedKeyCredential,
} from '@azure/storage-blob';

/**
 * バグ報告用スクリーンショットを Azure Blob Storage にアップロードし、
 * 読み取り用 SAS トークン付きの URL を返す。
 *
 * ストレージアカウントは public access 禁止のため、SAS で時間制限付きの
 * 匿名読み取りリンクを発行する（GitHub Issue 本文に img 埋め込み可能）。
 */
export async function uploadScreenshot(buffer: Buffer, userId: string): Promise<string> {
    const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
    const containerName = process.env.AZURE_BLOB_CONTAINER_NAME || 'ai-assistant-screenshots';

    if (!connectionString) {
        throw new Error('AZURE_BLOB_CONNECTION_STRING is not configured');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // コンテナが存在しない場合はプライベートアクセスで作成
    await containerClient.createIfNotExists();

    const blobName = `screenshots/${userId}/${Date.now()}.png`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: 'image/png' },
    });

    // 接続文字列から AccountName / AccountKey を抽出して SAS を発行
    const sasUrl = buildReadOnlySasUrl(connectionString, containerName, blobName, blockBlobClient.url);
    return sasUrl;
}

function buildReadOnlySasUrl(
    connectionString: string,
    containerName: string,
    blobName: string,
    fallbackUrl: string,
): string {
    const accountName = extractFromConnectionString(connectionString, 'AccountName');
    const accountKey = extractFromConnectionString(connectionString, 'AccountKey');

    if (!accountName || !accountKey) {
        // SAS 発行できない場合は直 URL を返す（ローカル開発時など）
        return fallbackUrl;
    }

    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const startsOn = new Date(Date.now() - 5 * 60 * 1000); // 5 分前から有効
    const expiresOn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 年有効

    const sas = generateBlobSASQueryParameters(
        {
            containerName,
            blobName,
            permissions: BlobSASPermissions.parse('r'),
            startsOn,
            expiresOn,
            protocol: SASProtocol.Https,
            contentType: 'image/png',
        },
        credential,
    ).toString();

    return `${fallbackUrl}?${sas}`;
}

function extractFromConnectionString(connectionString: string, key: string): string | undefined {
    const match = connectionString
        .split(';')
        .map(part => part.trim())
        .find(part => part.toLowerCase().startsWith(`${key.toLowerCase()}=`));
    if (!match) return undefined;
    return match.slice(key.length + 1);
}
