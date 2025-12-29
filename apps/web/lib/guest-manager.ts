'use client';

import { v4 as uuidv4 } from 'uuid';

const GUEST_ID_KEY = 'ipalab_guest_id';
const GUEST_HISTORY_KEY = 'ipalab_guest_history';

export const guestManager = {
    getGuestId: (): string => {
        if (typeof window === 'undefined') return '';

        let id = localStorage.getItem(GUEST_ID_KEY);
        if (!id) {
            id = uuidv4();
            localStorage.setItem(GUEST_ID_KEY, id);
        }
        return id;
    },

    isGuest: (): boolean => {
        // Needs session context to be accurate, but this handles "no persisted auth" check
        return true; // Simple stub, logic is mostly "if !session"
    },

    saveHistory: (history: any) => {
        if (typeof window === 'undefined') return;
        const current = guestManager.getHistory();
        current.push(history);
        localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(current));
    },

    getHistory: (): any[] => {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(GUEST_HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    },

    clear: () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(GUEST_ID_KEY);
        localStorage.removeItem(GUEST_HISTORY_KEY);
    },

    clearHistory: () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(GUEST_HISTORY_KEY);
    }
};
