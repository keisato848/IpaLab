import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_CHAT_SIGNATURE_HEADER,
  AI_CHAT_TIMESTAMP_HEADER,
  createAiChatAuthHeaders,
  createAiChatSignature,
} from '@/lib/ai-chat-auth';

describe('ai-chat-auth', () => {
  const originalSecret = process.env.AI_CHAT_FUNCTION_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.AI_CHAT_FUNCTION_SECRET;
    } else {
      process.env.AI_CHAT_FUNCTION_SECRET = originalSecret;
    }
  });

  it('リクエスト本文とタイムスタンプからHMAC署名を生成する', () => {
    process.env.AI_CHAT_FUNCTION_SECRET = 'unit-test-secret';
    const rawBody = JSON.stringify({ systemPrompt: 's', userMessage: 'u' });
    const timestamp = '1789200000';

    const result = createAiChatSignature(rawBody, timestamp);
    const expectedDigest = createHmac('sha256', 'unit-test-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    expect(result).toEqual({
      timestamp,
      signature: `sha256=${expectedDigest}`,
    });
  });

  it('署名ヘッダーを生成する', () => {
    process.env.AI_CHAT_FUNCTION_SECRET = 'unit-test-secret';
    const headers = createAiChatAuthHeaders('{"ok":true}');

    expect(headers[AI_CHAT_TIMESTAMP_HEADER]).toEqual(expect.any(String));
    expect(headers[AI_CHAT_SIGNATURE_HEADER]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('シークレット未設定時は例外を投げる', () => {
    delete process.env.AI_CHAT_FUNCTION_SECRET;

    expect(() => createAiChatSignature('{}', '1789200000')).toThrow(
      'AI_CHAT_FUNCTION_SECRET is not configured',
    );
  });
});