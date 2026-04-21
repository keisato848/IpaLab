import { Metadata } from 'next';
import { ShortAnswerScoringClient } from '@/components/features/scoring/ShortAnswerScoringClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '記述式 AI採点 | シカクノ',
  description: '原稿用紙形式で午後I記述式の解答を入力し、4観点で AI 採点を受けられます。',
};

const SAMPLES = [
  {
    questionId: 'AP-2023S-PM-01-q1',
    label: 'AP 2023春 午後 問1 設問1',
    charLimit: 50,
    questionText:
      '社内システムへの不正アクセスを防止するために、認証強化として最も有効な対策を 50 字以内で述べよ。',
  },
];

export default function ShortAnswerScoringPage() {
  return <ShortAnswerScoringClient samples={SAMPLES} />;
}
