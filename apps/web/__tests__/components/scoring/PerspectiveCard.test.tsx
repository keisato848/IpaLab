import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerspectiveCard } from '@/components/features/scoring/PerspectiveCard';

describe('PerspectiveCard', () => {
  it('短答式: スコアと観点名を描画', () => {
    render(
      <PerspectiveCard
        variant="short_answer"
        data={{
          id: 'keyword_coverage',
          name: 'キーワード網羅',
          score: 78,
          weight: 0.3,
          rationale: 'T1 が 1 件不足',
          matchedKeywords: ['多要素認証'],
          missingKeywords: ['権限昇格'],
        }}
      />,
    );
    expect(screen.getByText('キーワード網羅')).toBeTruthy();
    expect(screen.getByText('78')).toBeTruthy();
    expect(screen.getByText('多要素認証')).toBeTruthy();
    expect(screen.getByText('権限昇格')).toBeTruthy();
  });

  it('論述式: subQuestion と evidence を表示', () => {
    render(
      <PerspectiveCard
        variant="essay"
        data={{
          id: 'concreteness_experience',
          name: '具体性・実体験性',
          score: 65,
          rationale: 'OK',
          subQuestion: 'イ',
          evidenceQuotes: ['当社A事業部のPMとして'],
        }}
      />,
    );
    expect(screen.getByText(/設問イ/)).toBeTruthy();
    expect(screen.getByText(/当社A事業部のPMとして/)).toBeTruthy();
  });

  it('error 表示', () => {
    render(
      <PerspectiveCard
        data={{ id: 'x', name: 'X', score: 0 }}
        error="LLM timeout"
      />,
    );
    expect(screen.getByText(/採点エラー: LLM timeout/)).toBeTruthy();
  });
});
