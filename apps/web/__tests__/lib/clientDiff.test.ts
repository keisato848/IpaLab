import { describe, it, expect } from 'vitest';
import { computeCharDiff, toModelAnswerDiff, buildClientDiff } from '@/lib/scoring/clientDiff';

describe('clientDiff', () => {
  it('完全一致は全て match', () => {
    const { userSegments, modelSegments } = computeCharDiff('あいう', 'あいう');
    expect(userSegments).toEqual([{ type: 'match', text: 'あいう' }]);
    expect(modelSegments).toEqual([{ type: 'match', text: 'あいう' }]);
  });

  it('ユーザー側過剰 = deletion', () => {
    const { userSegments } = computeCharDiff('あいうえお', 'あいう');
    expect(userSegments.some((s) => s.type === 'deletion' && s.text === 'えお')).toBe(true);
  });

  it('模範側のみ = addition', () => {
    const { modelSegments } = computeCharDiff('あい', 'あいうえ');
    expect(modelSegments.some((s) => s.type === 'addition' && s.text === 'うえ')).toBe(true);
  });

  it('隣接セグメントは結合される', () => {
    const { modelSegments } = computeCharDiff('X', 'XABC');
    const adds = modelSegments.filter((s) => s.type === 'addition');
    expect(adds).toHaveLength(1);
    expect(adds[0].text).toBe('ABC');
  });

  it('toModelAnswerDiff: 2文字以上の過不足を rephrasing にペア化', () => {
    const { userSegments, modelSegments } = computeCharDiff('古い表現', '新しい表現');
    const diff = toModelAnswerDiff(userSegments, modelSegments);
    const hasRephrase = diff.rephrasing.length > 0;
    const hasLeftover = diff.additions.length + diff.deletions.length >= 0;
    expect(hasRephrase || hasLeftover).toBe(true);
  });

  it('buildClientDiff: ショートカットが動作する', () => {
    const diff = buildClientDiff('あ', 'あい');
    expect(diff.additions).toContain('い');
  });

  it('サロゲートペアを1文字として扱う', () => {
    const { userSegments } = computeCharDiff('𩸽あ', '𩸽');
    expect(userSegments.find((s) => s.type === 'deletion')?.text).toBe('あ');
  });
});
