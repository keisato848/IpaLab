/**
 * Mobile API 共通エラー応答（詳細設計 26_AndroidPlayDetailedDesign.md §6）
 * すべてのエラーは { code, message, retryable, correlationId } を返す。
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Mobile } from '@ipa-lab/shared';

export function getCorrelationId(request: NextRequest): string {
    return request.headers.get(Mobile.MOBILE_HEADERS.correlationId) ?? randomUUID();
}

export function mobileErrorResponse(
    request: NextRequest,
    status: number,
    code: string,
    message: string,
    retryable: boolean
): NextResponse {
    const body: Mobile.MobileApiError = {
        code,
        message,
        retryable,
        correlationId: getCorrelationId(request),
    };
    return NextResponse.json(body, {
        status,
        headers: { [Mobile.MOBILE_HEADERS.correlationId]: body.correlationId },
    });
}
