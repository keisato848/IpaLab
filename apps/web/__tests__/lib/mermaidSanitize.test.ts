import { describe, it, expect } from 'vitest';
import { sanitizeMermaid } from '@/lib/mermaid/sanitize';

describe('sanitizeMermaid', () => {
    it('returns empty for empty input', () => {
        expect(sanitizeMermaid('')).toBe('');
    });

    it('comments out invalid "note:" lines', () => {
        const input = 'graph TD\n  note: this is invalid';
        expect(sanitizeMermaid(input)).toBe('graph TD\n  %% note: this is invalid');
    });

    it('quotes node label containing <- (assignment arrow)', () => {
        const input = 'graph TD\nB[x <- 1]';
        expect(sanitizeMermaid(input)).toContain('B["x <- 1"]');
    });

    it('quotes node label containing -> ', () => {
        const input = 'graph TD\nA[x -> y]';
        expect(sanitizeMermaid(input)).toContain('A["x -> y"]');
    });

    it('quotes node label containing both <- and parens (real AP-2024-Spring/AM1/5 case)', () => {
        const input = 'graph TD\nD[x <- (x x n)]';
        expect(sanitizeMermaid(input)).toContain('D["x <- (x x n)"]');
    });

    it('quotes node label containing colon and commas', () => {
        const input = 'graph TD\nC[演算 n: M, -1, 1]';
        expect(sanitizeMermaid(input)).toContain('C["演算 n: M, -1, 1"]');
    });

    it('does not quote simple labels', () => {
        const input = 'graph TD\nA[開始]\nF[終了]';
        const out = sanitizeMermaid(input);
        expect(out).toContain('A[開始]');
        expect(out).toContain('F[終了]');
        expect(out).not.toContain('"開始"');
    });

    it('does not double-quote already quoted labels', () => {
        const input = 'graph TD\nB["x <- 1"]';
        expect(sanitizeMermaid(input)).toBe(input);
    });

    it('preserves edge syntax with arrows', () => {
        const input = 'graph TD\nA --> B --> C\nD -- No --> X2';
        expect(sanitizeMermaid(input)).toBe(input);
    });

    it('handles decision nodes {a} (curly braces)', () => {
        const input = 'graph TD\nD{a}';
        expect(sanitizeMermaid(input)).toBe(input);
    });

    it('quotes decision node containing special chars', () => {
        const input = 'graph TD\nD{n > M}';
        expect(sanitizeMermaid(input)).toContain('D{"n > M"}');
    });

    it('quotes parenthesized node when it contains comma', () => {
        const input = 'graph TD\nA(x, y)';
        expect(sanitizeMermaid(input)).toContain('A("x, y")');
    });

    it('does not match unbalanced bracket pairs', () => {
        // [...) shouldn't be rewritten
        const input = 'A[x <- 1)';
        expect(sanitizeMermaid(input)).toBe(input);
    });

    it('handles full AP-2024-Spring/AM1/5 flowchart', () => {
        const input = [
            'graph TD',
            '    A[開始]',
            '    B[x <- 1]',
            '    C[演算 n: M, -1, 1]',
            '    D[x <- (x x n)]',
            '    E[演算]',
            '    F[終了]',
            '    A --> B --> C',
            '    C --> D',
            '    D --> C',
            '    C --> E --> F',
        ].join('\n');
        const out = sanitizeMermaid(input);
        expect(out).toContain('A[開始]');
        expect(out).toContain('B["x <- 1"]');
        expect(out).toContain('C["演算 n: M, -1, 1"]');
        expect(out).toContain('D["x <- (x x n)"]');
        expect(out).toContain('E[演算]');
        expect(out).toContain('A --> B --> C');
    });
});
