/**
 * 認証状態管理（Zustand v5、詳細設計§10）
 * AT はここに保存しない（api-client.ts のモジュール変数で管理）。
 */
import { create } from 'zustand';

export type AuthType = 'oauth' | 'guest';

export interface AuthSession {
    userId: string;
    authType: AuthType;
}

export type AuthStatus = 'initializing' | 'unauthenticated' | 'authenticated';

interface AuthState {
    status: AuthStatus;
    session: AuthSession | null;
    setAuthenticated: (session: AuthSession) => void;
    setUnauthenticated: () => void;
    setInitializing: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
    status: 'initializing',
    session: null,
    setAuthenticated: (session: AuthSession) => set({ status: 'authenticated', session }),
    setUnauthenticated: () => set({ status: 'unauthenticated', session: null }),
    setInitializing: () => set({ status: 'initializing', session: null }),
}));
