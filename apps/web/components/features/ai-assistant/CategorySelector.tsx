'use client';

import type { Category, ExamContext } from '@/hooks/use-ai-assistant';
import styles from './ai-assistant.module.css';

interface CategorySelectorProps {
    examContext: ExamContext | null;
    onSelect: (category: Category) => void;
}

interface CategoryOption {
    category: Category;
    icon: string;
    label: string;
    showCondition: (ctx: ExamContext | null) => boolean;
}

const CATEGORIES: CategoryOption[] = [
    {
        category: 'qa-explain',
        icon: '📖',
        label: '解説を深掘り',
        showCondition: () => true,
    },
    {
        category: 'qa-related',
        icon: '🔗',
        label: '関連知識を知る',
        showCondition: () => true,
    },
    {
        category: 'qa-analysis',
        icon: '❌',
        label: '誤答を分析する',
        showCondition: (ctx) => ctx !== null && !ctx.isCorrect,
    },
    {
        category: 'qa-afternoon',
        icon: '📝',
        label: '午後問題を解説',
        showCondition: (ctx) => ctx !== null && ctx.isDescriptive,
    },
];

export default function CategorySelector({ examContext, onSelect }: CategorySelectorProps) {
    const visibleCategories = CATEGORIES.filter((c) => c.showCondition(examContext));

    return (
        <div className={styles.categoryContainer}>
            {visibleCategories.map((cat) => (
                <button
                    key={cat.category}
                    className={styles.categoryCard}
                    onClick={() => onSelect(cat.category)}
                >
                    <span className={styles.categoryIcon}>{cat.icon}</span>
                    <span className={styles.categoryLabel}>{cat.label}</span>
                </button>
            ))}
        </div>
    );
}
