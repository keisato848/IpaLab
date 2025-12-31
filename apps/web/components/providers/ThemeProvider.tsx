'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    showExamStats: boolean;
    toggleShowExamStats: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light');
    const [showExamStats, setShowExamStats] = useState(true);

    useEffect(() => {
        // Init theme from localStorage or system preference
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        // Init stats visibility
        const savedStats = localStorage.getItem('showExamStats');
        if (savedStats !== null) {
            setShowExamStats(savedStats === 'true');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const toggleShowExamStats = () => {
        const newValue = !showExamStats;
        setShowExamStats(newValue);
        localStorage.setItem('showExamStats', String(newValue));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, showExamStats, toggleShowExamStats }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
