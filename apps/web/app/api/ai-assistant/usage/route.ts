import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { checkRateLimit, getJSTResetTime } from '@/lib/ai-assistant/rate-limiter';

export const runtime = 'nodejs';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    try {
        const { used, remaining } = await checkRateLimit(session.user.id);
        return NextResponse.json({
            used,
            limit: 10,
            remaining,
            resetsAt: getJSTResetTime(),
        });
    } catch (error) {
        console.error('Usage API error:', error);
        return NextResponse.json(
            { error: '使用状況の取得に失敗しました' },
            { status: 500 },
        );
    }
}
