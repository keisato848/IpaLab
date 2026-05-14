import { createHmac } from 'node:crypto';

export const AI_CHAT_TIMESTAMP_HEADER = 'x-ai-chat-timestamp';
export const AI_CHAT_SIGNATURE_HEADER = 'x-ai-chat-signature';

function getAiChatFunctionSecret(): string {
  return process.env.AI_CHAT_FUNCTION_SECRET?.trim() || '';
}

export function createAiChatSignature(
  rawBody: string,
  timestampSeconds = Math.floor(Date.now() / 1000).toString(),
): { timestamp: string; signature: string } {
  const secret = getAiChatFunctionSecret();
  if (!secret) {
    throw new Error('AI_CHAT_FUNCTION_SECRET is not configured');
  }

  const digest = createHmac('sha256', secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest('hex');

  return {
    timestamp: timestampSeconds,
    signature: `sha256=${digest}`,
  };
}

export function createAiChatAuthHeaders(rawBody: string): Record<string, string> {
  const { timestamp, signature } = createAiChatSignature(rawBody);
  return {
    [AI_CHAT_TIMESTAMP_HEADER]: timestamp,
    [AI_CHAT_SIGNATURE_HEADER]: signature,
  };
}