'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import type { AdConsent } from './types';

interface AdContextValue {
    /** 広告が有効かどうか（フィーチャーフラグ + 同意 + パス制限） */
    isAdEnabled: boolean;
    /** リワード広告を表示すべきかどうか */
    isRewardedAdEnabled: boolean;
    /** 同意状態 */
    consent: AdConsent | null;
    /** 同意を更新する */
    updateConsent: (consent: AdConsent) => void;
    /** 認証済みユーザーかどうか */
    isAuthenticated: boolean;
}

const AdContext = createContext<AdContextValue>({
    isAdEnabled: false,
    isRewardedAdEnabled: false,
    consent: null,
    updateConsent: () => { },
    isAuthenticated: false,
});

/** 広告を一切表示しないパス */
const BLOCKED_PATHS = ['/settings', '/privacy', '/terms'];

/** フィーチャーフラグ: 環境変数で広告を有効化 */
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

/**
 * 広告コンテキストプロバイダー
 * 
 * 広告の表示/非表示を一元管理する。
 * - フィーチャーフラグ (`NEXT_PUBLIC_ADS_ENABLED`) で全体制御
 * - Cookie 同意状態による制御
 * - パスベースの表示制限
 * - 認証状態による制御
 */
export function AdProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [consent, setConsent] = useState<AdConsent | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('ad-consent');
            if (stored) {
                setConsent(JSON.parse(stored));
            }
        } catch {
            // localStorage が利用できない環境では無視
        }
    }, []);

    const isAuthenticated = !!session?.user?.id;
    const isBlockedPath = BLOCKED_PATHS.some((p) => pathname.startsWith(p));

    // 広告有効条件: フィーチャーフラグ ON + 禁止パスでない
    // 同意がまだない場合もデフォルトで有効（日本の法規制は opt-out ベース）
    const isAdEnabled = ADS_ENABLED && !isBlockedPath;

    // リワード広告はゲストユーザーのみに表示（認証済みユーザーは免除）
    const isRewardedAdEnabled = isAdEnabled && !isAuthenticated;

    const updateConsent = useCallback((newConsent: AdConsent) => {
        setConsent(newConsent);
        try {
            localStorage.setItem('ad-consent', JSON.stringify(newConsent));
        } catch {
            // localStorage が利用できない環境では無視
        }
    }, []);

    return (
        <AdContext.Provider value={{ isAdEnabled, isRewardedAdEnabled, consent, updateConsent, isAuthenticated }}>
            {children}
        </AdContext.Provider>
    );
}

/** 広告コンテキストを使用するフック */
export const useAdContext = () => useContext(AdContext);
