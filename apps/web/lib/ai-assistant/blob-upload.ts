import { BlobServiceClient } from '@azure/storage-blob';

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

    return blockBlobClient.url;
}
