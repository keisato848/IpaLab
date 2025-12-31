'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type SettingsContextType = {
    darkMode: boolean;
    toggleDarkMode: () => void;
    showExamStats: boolean;
    toggleShowExamStats: () => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [darkMode, setDarkMode] = useState(false);
    const [showExamStats, setShowExamStats] = useState(true);

    // Initialize from localStorage
    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark') {
            setDarkMode(true);
            document.documentElement.classList.add('dark');
        }

        const storedStats = localStorage.getItem('showExamStats');
        if (storedStats !== null) {
            setShowExamStats(storedStats === 'true');
        }
    }, []);

    const toggleDarkMode = () => {
        setDarkMode((prev) => {
            const newVal = !prev;
            if (newVal) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
            return newVal;
        });
    };

    const toggleShowExamStats = () => {
        setShowExamStats((prev) => {
            const newVal = !prev;
            localStorage.setItem('showExamStats', String(newVal));
            return newVal;
        });
    };

    return (
        <SettingsContext.Provider value={{ darkMode, toggleDarkMode, showExamStats, toggleShowExamStats }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
