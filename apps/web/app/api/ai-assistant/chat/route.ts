import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { checkRateLimit, recordUsage } from '@/lib/ai-assistant/rate-limiter';
import { buildPrompt } from '@/lib/ai-assistant/context-builder';
import { streamChatResponse } from '@/lib/ai-assistant/gemini-chat';
import type { Category, ExamContext } from '@/hooks/use-ai-assistant';

export const runtime = 'nodejs';

const VALID_CATEGORIES: Category[] = ['qa-explain', 'qa-related', 'qa-analysis', 'qa-afternoon', 'site-guide'];

export async function POST(req: NextRequest) {
    // 認証チェック
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    const userId = session.user.id;

    let body: {
        category: Category;
        message: string;
        context?: ExamContext;
    };

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 });
    }

    try {
        const { category, message, context } = body;

        // バリデーション
        if (!category || !VALID_CATEGORIES.includes(category)) {
            return NextResponse.json({ error: '無効なカテゴリです' }, { status: 400 });
        }
        // ユーザー入力を廃止したため message は任意。
        // 未指定や空文字列の場合は context-builder 側でデフォルトトリガーを適用する。
        if (typeof message !== 'undefined' && typeof message !== 'string') {
            return NextResponse.json({ error: 'メッセージ形式が不正です' }, { status: 400 });
        }
        if (typeof message === 'string' && message.length > 2000) {
            return NextResponse.json({ error: 'メッセージが長すぎます' }, { status: 400 });
        }

        // レート制限チェック
        const rateResult = await checkRateLimit(userId);
        if (!rateResult.allowed) {
            return NextResponse.json(
                { error: '本日の質問回数上限に達しました。明日またご利用ください。', remaining: 0 },
                { status: 429 },
            );
        }

        // プロンプト構築（message が空の場合は buildPrompt 内でデフォルトトリガーを適用）
        const { systemPrompt, userMessage } = buildPrompt(category, (message ?? '').trim(), context);

        // SSE ストリーミング
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const token of streamChatResponse(systemPrompt, userMessage)) {
                        const data = JSON.stringify({ token });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }

                    // 使用量記録
                    await recordUsage(userId, category, context?.questionId, context?.examId);

                    // 完了メッセージ（recordUsage後に再計算して整合性を保つ）
                    const updatedRateResult = await checkRateLimit(userId);
                    const remaining = updatedRateResult.allowed ? updatedRateResult.remaining : 0;
                    const doneData = JSON.stringify({ done: true, remaining });
                    controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
                } catch (error) {
                    console.error('Gemini streaming error:', error);
                    const errorData = JSON.stringify({ error: '回答の生成に失敗しました' });
                    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: '回答の生成に失敗しました。しばらく経ってからお試しください。' },
            { status: 500 },
        );
    }
}
