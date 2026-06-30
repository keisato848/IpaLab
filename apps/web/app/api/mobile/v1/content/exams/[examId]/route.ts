/**
 * GET /api/mobile/v1/content/exams/{examId}（詳細設計§6）
 * 試験データ取得。0件は配信しない（0件防壁、詳細設計§8）。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { getExamContent } from '@/lib/mobile/content';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params;
        if (!examId) {
            return mobileErrorResponse(request, 400, 'EXAM_ID_REQUIRED', 'examIdが必要です', false);
        }

        const content = await getExamContent(examId);
        if (content === null) {
            return mobileErrorResponse(
                request,
                404,
                'EXAM_CONTENT_NOT_FOUND',
                '指定された試験のコンテンツが存在しません',
                false
            );
        }

        return NextResponse.json(content, {
            headers: {
                ETag: `"${content.contentHash}"`,
                [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request),
            },
        });
    } catch (error) {
        console.error('[mobile/content/exams] failed:', error);
        return mobileErrorResponse(request, 500, 'EXAM_CONTENT_FAILED', '試験コンテンツの取得に失敗しました', true);
    }
}
