'use client';

import { SessionProvider } from 'next-auth/react';
import { useGuestSync } from '@/hooks/useGuestSync';

function GuestSyncHandler() {
    useGuestSync();
    return null;
}

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <GuestSyncHandler />
            {children}
        </SessionProvider>
    );
}
