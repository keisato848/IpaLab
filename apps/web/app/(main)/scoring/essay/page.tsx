import { Metadata } from 'next';
import { EssayScoringClient } from '@/components/features/scoring/EssayScoringClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '論述式 AI採点 | シカクノ',
  description: '設問ア・イ・ウの3部構成で論文を入力し、6観点 × 3小問で AI 採点を受けられます。',
};

const SAMPLES = [
  {
    questionId: 'PM-2024A-PM2-q1',
    label: 'PM 2024春 午後II 問1（利害関係者調整）',
    examType: 'PM' as const,
    theme: 'プロジェクト計画における利害関係者との調整',
    subQuestions: {
      A: { requirements: 'プロジェクトの概要、利害関係者の構成、調整背景を述べる', charMin: 0, charMax: 800 },
      I: { requirements: '発生した課題と PM として講じた調整施策・実施プロセス', charMin: 800, charMax: 1600 },
      U: { requirements: '施策の評価と改善点・次回への活かし方', charMin: 600, charMax: 1200 },
    },
  },
];

export default function EssayScoringPage() {
  return <EssayScoringClient samples={SAMPLES} />;
}
