'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const VISITOR_ID_KEY = 'ipalab_visitor_id';

/**
 * 訪問者IDを取得（なければ生成して localStorage に保存）
 */
function getVisitorId(): string {
    if (typeof window === 'undefined') return '';

    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
}

/**
 * ページビューをサーバーに送信するフック
 * レイアウトに配置して全ページの訪問を自動トラッキング
 */
export function usePageTracker() {
    const pathname = usePathname();
    const lastTrackedRef = useRef<string>('');

    useEffect(() => {
        // 同じパスの二重送信を防ぐ
        if (pathname === lastTrackedRef.current) return;
        lastTrackedRef.current = pathname;

        const visitorId = getVisitorId();
        if (!visitorId) return;

        // 非同期で送信（結果を待たない）
        fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId, path: pathname }),
        }).catch(() => {
            // トラッキングエラーは無視
        });
    }, [pathname]);
}
