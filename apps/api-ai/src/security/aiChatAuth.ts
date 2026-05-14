import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createHmac, timingSafeEqual } from "node:crypto";

export const AI_CHAT_TIMESTAMP_HEADER = "x-ai-chat-timestamp";
export const AI_CHAT_SIGNATURE_HEADER = "x-ai-chat-signature";

const SIGNATURE_PREFIX = "sha256=";
const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

type AuthResult =
    | { ok: true; rawBody: string }
    | { ok: false; response: HttpResponseInit };

function isAzureHostedRuntime(): boolean {
    return Boolean(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_INSTANCE_ID);
}

function getAiChatFunctionSecret(): string {
    return process.env.AI_CHAT_FUNCTION_SECRET?.trim() || "";
}

function createExpectedSignature(secret: string, timestamp: string, rawBody: string): string {
    const digest = createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");
    return `${SIGNATURE_PREFIX}${digest}`;
}

function safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "utf8");
    const rightBuffer = Buffer.from(right, "utf8");
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function authFailure(
    context: InvocationContext,
    status: 401 | 403 | 500,
    reason: string,
): AuthResult {
    const logMessage = `AI chat authorization failed: ${reason}`;
    if (status === 500) {
        context.error(logMessage);
    } else {
        context.warn(logMessage);
    }

    return {
        ok: false,
        response: {
            status,
            jsonBody: {
                error: status === 500 ? "AI chat authentication is not configured" : "Unauthorized",
            },
        },
    };
}

export async function verifyAiChatRequest(
    request: HttpRequest,
    context: InvocationContext,
): Promise<AuthResult> {
    const rawBody = await request.text();
    const secret = getAiChatFunctionSecret();

    if (!secret) {
        if (isAzureHostedRuntime()) {
            return authFailure(context, 500, "AI_CHAT_FUNCTION_SECRET is missing in Azure runtime");
        }

        context.warn("AI_CHAT_FUNCTION_SECRET is not configured; allowing unsigned local aiChat request");
        return { ok: true, rawBody };
    }

    const timestamp = request.headers.get(AI_CHAT_TIMESTAMP_HEADER);
    const signature = request.headers.get(AI_CHAT_SIGNATURE_HEADER);

    if (!timestamp || !signature) {
        return authFailure(context, 401, "missing signature headers");
    }

    if (!signature.startsWith(SIGNATURE_PREFIX)) {
        return authFailure(context, 403, "invalid signature format");
    }

    const timestampNumber = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > MAX_TIMESTAMP_SKEW_SECONDS) {
        return authFailure(context, 403, "stale or invalid timestamp");
    }

    const expected = createExpectedSignature(secret, timestamp, rawBody);
    if (!safeEqual(signature, expected)) {
        return authFailure(context, 403, "signature mismatch");
    }

    return { ok: true, rawBody };
}