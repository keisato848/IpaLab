import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { guestManager } from '@/lib/guest-manager';
import { syncLearningRecords } from '@/lib/api';

export function useGuestSync() {
    const { data: session, status } = useSession();
    const syncedRef = useRef(false);

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id && !syncedRef.current) {
            const guestHistory = guestManager.getHistory();
            if (guestHistory.length === 0) return;

            const sync = async () => {
                try {
                    const user = session?.user;
                    if (!user || !user.id) return;

                    const currentUserId = user.id;
                    console.log(`Syncing ${guestHistory.length} guest records to user ${currentUserId}...`);

                    // Update user ID in records to current user
                    const recordsToSync = guestHistory.map(r => ({
                        ...r,
                        userId: currentUserId
                    }));

                    await syncLearningRecords(recordsToSync);

                    console.log('Sync successful, clearing guest storage.');
                    guestManager.clearHistory();
                    syncedRef.current = true;

                    // Optional: Show toast or notify user
                    alert("ゲスト時の学習履歴を統合しました。");

                } catch (error) {
                    console.error("Failed to sync guest history:", error);
                }
            };

            sync();
        }
    }, [status, session]);
}
