/**
 * 採点API v2 用 LLM クライアント
 *
 * - 本番: US リージョンの aiChat Azure Function を経由 (AI_CHAT_FUNCTION_URL)
 * - ローカル開発: 直接 Gemini API を呼び出し
 *
 * 単一観点プロンプトを投げて JSON レスポンスをパースして返す。
 * オーケストレータはこの関数を観点数ぶん並列起動する。
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAiChatAuthHeaders } from '@/lib/ai-chat-auth';

const AI_CHAT_FUNCTION_URL = process.env.AI_CHAT_FUNCTION_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT_DEFAULT =
  'あなたは情報処理試験の午後試験採点官です。JSONフォーマットで結果を出力してください。余計な前置きや説明は不要です。';

export interface PerspectiveLlmRawResult {
  score: number;
  matched_keywords?: string[];
  missing_keywords?: string[];
  rationale: string;
  evidence_quotes?: string[];
}

/** デフォルトの LLM 呼び出し（本番実装） */
export async function callPerspectiveLlmDefault(prompt: string): Promise<PerspectiveLlmRawResult> {
  let text: string;
  if (AI_CHAT_FUNCTION_URL) {
    const requestBody = JSON.stringify({ systemPrompt: SYSTEM_PROMPT_DEFAULT, userMessage: prompt });
    const res = await fetch(AI_CHAT_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...createAiChatAuthHeaders(requestBody) },
      body: requestBody,
    });
    if (!res.ok) throw new Error(`LLM proxy failed: ${res.status} ${await res.text().catch(() => '')}`);
    const data = (await res.json()) as { text?: string; error?: string };
    if (data.error) throw new Error(data.error);
    text = data.text ?? '';
  } else {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT_DEFAULT,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const r = await model.generateContent(prompt);
    text = r.response.text();
  }

  return parsePerspectiveResponse(text);
}

/** LLM応答テキスト → PerspectiveLlmRawResult。コードブロック除去とバリデーションを含む */
export function parsePerspectiveResponse(text: string): PerspectiveLlmRawResult {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM response is not valid JSON: ${cleaned.slice(0, 200)}`);
  }
  const o = parsed as Record<string, unknown>;
  const score = typeof o.score === 'number' ? o.score : Number(o.score);
  if (!Number.isFinite(score)) throw new Error('LLM response missing numeric `score`');
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    matched_keywords: Array.isArray(o.matched_keywords) ? (o.matched_keywords as string[]) : [],
    missing_keywords: Array.isArray(o.missing_keywords) ? (o.missing_keywords as string[]) : [],
    rationale: typeof o.rationale === 'string' ? o.rationale : '',
    evidence_quotes: Array.isArray(o.evidence_quotes) ? (o.evidence_quotes as string[]) : [],
  };
}

/** DI 用型: テストではこの型のスタブを差し替える */
export type CallPerspectiveLlm = (prompt: string) => Promise<PerspectiveLlmRawResult>;
