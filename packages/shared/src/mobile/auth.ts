import { z } from 'zod';

/** OAuth プロバイダー（要件F-01） */
export const oauthProviderSchema = z.enum(['google', 'github']);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

/** POST /api/mobile/v1/auth/authorize 要求（詳細設計§5.1） */
export const authorizeRequestSchema = z.object({
    provider: oauthProviderSchema,
    codeChallenge: z.string().min(43).max(128),
    codeChallengeMethod: z.literal('S256'),
    state: z.string().min(16),
});
export type AuthorizeRequest = z.infer<typeof authorizeRequestSchema>;

export const authorizeResponseSchema = z.object({
    authorizationUrl: z.string().url(),
    transactionId: z.string().min(1),
    expiresAt: z.string().datetime(),
});
export type AuthorizeResponse = z.infer<typeof authorizeResponseSchema>;

/** POST /api/mobile/v1/auth/exchange 要求（bridge code交換、詳細設計§5.1） */
export const exchangeRequestSchema = z.object({
    bridgeCode: z.string().min(1),
    codeVerifier: z.string().min(43).max(128),
});
export type ExchangeRequest = z.infer<typeof exchangeRequestSchema>;

/** トークン応答（詳細設計§5.2: AT 15分・RT 絶対30日/無操作14日） */
export const tokenPairSchema = z.object({
    accessToken: z.string().min(1),
    /** `{sessionId}.{secret}` の自己完結形式（詳細設計§5.2） */
    refreshToken: z.string().min(1),
    accessTokenExpiresAt: z.string().datetime(),
    refreshTokenExpiresAt: z.string().datetime(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

/** POST /api/mobile/v1/auth/refresh 要求 */
export const refreshRequestSchema = z.object({
    refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

/** POST /api/mobile/v1/auth/guest 応答（詳細設計§5.3） */
export const guestCredentialResponseSchema = z.object({
    guestId: z.string().uuid(),
    guestSecret: z.string().min(1),
    issuedAt: z.string().datetime(),
    /** ゲストもAPI呼出にはBearerを用いる（role=guest） */
    tokens: tokenPairSchema,
});
export type GuestCredentialResponse = z.infer<typeof guestCredentialResponseSchema>;

/** GET /api/mobile/v1/auth/me 応答 */
export const sessionInfoSchema = z.object({
    userId: z.string().min(1),
    authType: z.enum(['oauth', 'guest']),
    provider: oauthProviderSchema.optional(),
    displayName: z.string().optional(),
    sessionId: z.string().min(1),
});
export type SessionInfo = z.infer<typeof sessionInfoSchema>;

/** POST /api/mobile/v1/guest/merge 要求（詳細設計§5.3: 固定mergeIdで冪等） */
export const guestMergeRequestSchema = z.object({
    mergeId: z.string().uuid(),
    guestId: z.string().uuid(),
    guestSecret: z.string().min(1),
});
export type GuestMergeRequest = z.infer<typeof guestMergeRequestSchema>;

export const guestMergeResponseSchema = z.object({
    mergeId: z.string().uuid(),
    status: z.enum(['completed', 'already_merged', 'rejected']),
    mergedEventCount: z.number().int().nonnegative(),
});
export type GuestMergeResponse = z.infer<typeof guestMergeResponseSchema>;
