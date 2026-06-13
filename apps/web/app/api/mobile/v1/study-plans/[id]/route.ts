/**
 * GET  /api/mobile/v1/study-plans/:id  — 1件取得
 * PUT  /api/mobile/v1/study-plans/:id  — 楽観ロック付き更新
 *
 * version 不一致時: 409 + { code: "VERSION_CONFLICT", current, message, retryable, correlationId }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireMobileSession } from '@/lib/mobile/auth-guard';
import { mobileErrorResponse, getCorrelationId } from '@/lib/mobile/error';
import { mobilePlanStore } from '@/lib/mobile/study-plans';
import { Mobile } from '@ipa-lab/shared';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    const claims = await requireMobileSession(request);
    if (!claims) {
        return mobileErrorResponse(request, 401, 'UNAUTHORIZED', 'Authentication required', false);
    }

    try {
        const { id } = await params;
        const plan = await mobilePlanStore.findById(claims.sub, id);
        if (!plan) {
            return mobileErrorResponse(request, 404, 'NOT_FOUND', 'Study plan not found', false);
        }
        return NextResponse.json(plan, {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (err) {
        console.error('[mobile/study-plans/:id GET]', err);
        return mobileErrorResponse(request, 500, 'INTERNAL_ERROR', 'Internal server error', true);
    }
}

export async function PUT(request: NextRequest, { params }: Params) {
    const claims = await requireMobileSession(request);
    if (!claims) {
        return mobileErrorResponse(request, 401, 'UNAUTHORIZED', 'Authentication required', false);
    }

    try {
        const { id } = await params;
        const body = await request.json();

        const parsed = Mobile.studyPlanUpdateRequestSchema.safeParse(body);
        if (!parsed.success) {
            return mobileErrorResponse(request, 400, 'INVALID_REQUEST', 'Invalid request body', false);
        }

        if (parsed.data.id !== id) {
            return mobileErrorResponse(request, 400, 'INVALID_REQUEST', 'id mismatch between body and path', false);
        }

        const result = await mobilePlanStore.upsertWithVersion(claims.sub, parsed.data);

        if (result.conflict !== null) {
            const correlationId = getCorrelationId(request);
            return NextResponse.json(
                {
                    code: 'VERSION_CONFLICT',
                    current: result.conflict,
                    message: 'Study plan was modified by another client. Fetch the latest version and retry.',
                    retryable: false,
                    correlationId,
                },
                {
                    status: 409,
                    headers: { [Mobile.MOBILE_HEADERS.correlationId]: correlationId },
                },
            );
        }

        return NextResponse.json(result.saved, {
            status: 200,
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (err) {
        console.error('[mobile/study-plans/:id PUT]', err);
        return mobileErrorResponse(request, 500, 'INTERNAL_ERROR', 'Internal server error', true);
    }
}
