import { describe, it, expect } from 'vitest';
import { isLikelyMermaid, normalizeMermaidCodeBlocks, sanitizeMermaid } from '@/lib/mermaid/sanitize';

describe('sanitizeMermaid', () => {
    it('returns empty for empty input', () => {
        expect(sanitizeMermaid('')).toBe('');
    });

    it('comments out invalid "note:" lines', () => {
        const input = 'graph TD\n  note: this is invalid';
        expect(sanitizeMermaid(input)).toBe('graph TD\n  %% note: this is invalid');
    });

    it('unwraps static data CODE_BLOCK mermaid markers', () => {
        const input = '[CODE_BLOCK:mermaid]\ngraph TD\nA --> B\n[/CODE_BLOCK]';
        expect(sanitizeMermaid(input)).toBe('graph TD\nA --> B');
    });

    it('unwraps full mermaid code fences before rendering', () => {
        const input = '```mermaid\ngraph TD\nA --> B\n```';
        expect(sanitizeMermaid(input)).toBe('graph TD\nA --> B');
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

    it('quotes non-ASCII labels so Mermaid 10 can parse them consistently', () => {
        const input = 'graph TD\nA[開始]\nF[終了]';
        const out = sanitizeMermaid(input);
        expect(out).toContain('A["開始"]');
        expect(out).toContain('F["終了"]');
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
        expect(out).toContain('A["開始"]');
        expect(out).toContain('B["x <- 1"]');
        expect(out).toContain('C["演算 n: M, -1, 1"]');
        expect(out).toContain('D["x <- (x x n)"]');
        expect(out).toContain('E["演算"]');
        expect(out).toContain('A --> B --> C');
    });

    it('quotes subgraph labels containing Japanese text or spaces', () => {
        const input = ['graph LR', '  subgraph 本プロジェクト (AI活用)', '    A[開始]', '  end'].join('\n');
        const out = sanitizeMermaid(input);
        expect(out).toContain('subgraph sanitized_subgraph_1["本プロジェクト (AI活用)"]');
        expect(out).toContain('A["開始"]');
    });

    it('preserves subgraph identifiers when quoting bracket labels', () => {
        const input = ['graph LR', '  subgraph Start [開始時点の盤面]', '    S1[8 6 7]', '  end', '  Start --> Goal'].join('\n');
        const out = sanitizeMermaid(input);
        expect(out).toContain('subgraph Start["開始時点の盤面"]');
        expect(out).toContain('Start --> Goal');
        expect(out).not.toContain('sanitized_subgraph_1["Start');
    });

    it('quotes non-ASCII double-circle node labels without changing the shape', () => {
        const input = 'graph TD\nA((インターネット)) --> B[FW]';
        const out = sanitizeMermaid(input);
        expect(out).toContain('A(("インターネット"))');
        expect(out).toContain('A(("インターネット")) --> B[FW]');
    });

    it('preserves empty double-circle nodes', () => {
        const input = 'graph LR\nStart --> Arrow(( ))\nArrow --> Goal';
        const out = sanitizeMermaid(input);
        expect(out).toContain('Arrow(( ))');
    });

    it('converts Japanese erDiagram entities to a flowchart representation', () => {
        const input = [
            'erDiagram',
            '    % 利用者マスター',
            '    利用者マスター {',
            '        string 利用者ID PK',
            '    }',
            '    得意先マスター {',
            '        string 得意先コード PK',
            '    }',
            '    得意先マスター ||--o{ 利用者マスター : 所属',
        ].join('\n');
        const out = sanitizeMermaid(input);
        expect(out).toContain('flowchart LR');
        expect(out).toContain('ER1["利用者マスター<br/>string 利用者ID PK"]');
        expect(out).toContain('ER2["得意先マスター<br/>string 得意先コード PK"]');
        expect(out).toContain('ER2 -->|"所属 1:N"| ER1');
        expect(out).not.toContain('erDiagram');
    });

    it('fixes spaced arrow "-- >" to "-->" (SC-2022-Fall-PM2 fig2/fig6 pattern)', () => {
        const input = 'graph TD\nInternet -- > Firewall(ファイアウォール)\nFirewall -- > VPN_G(VPN-G)';
        const out = sanitizeMermaid(input);
        expect(out).toContain('Internet --> Firewall');
        expect(out).toContain('Firewall --> VPN_G');
        expect(out).not.toContain('-- >');
    });

    it('preserves labeled arrows "-- text -->" without modification', () => {
        const input = 'graph LR\nA -- 接続 --> B\nC -- No --> D';
        const out = sanitizeMermaid(input);
        expect(out).toContain('A -- 接続 --> B');
        expect(out).toContain('C -- No --> D');
    });

    it('comments out invalid "A & B & C: label" lines (SC-2022-Spring-PM2 fig7 pattern)', () => {
        const input = 'graph LR\n    subgraph フェーズ\n        D1 & I1 & T1 & D2 & I2 & T2: 開発フェーズ\n    end';
        const out = sanitizeMermaid(input);
        expect(out).toContain('%% D1 & I1 & T1 & D2 & I2 & T2: 開発フェーズ');
        expect(out).not.toMatch(/^    D1 & I1/m);
    });

    it('does not touch valid parallel-edge syntax "A & B --> C"', () => {
        const input = 'graph TD\nA & B --> C';
        const out = sanitizeMermaid(input);
        expect(out).toContain('A & B --> C');
    });

    it('closes unclosed subgraph blocks (SC-2022-Fall-PM2 fig2 pattern)', () => {
        const input = [
            'graph TD',
            '    subgraph Outer',
            '        subgraph Inner',
            '        end',
            '        A --> B',
        ].join('\n');
        const out = sanitizeMermaid(input);
        // Outer subgraph has no end → one `end` appended
        const endCount = (out.match(/^\s*end\s*$/gm) ?? []).length;
        expect(endCount).toBe(2);
    });

    it('does not add extra end when all subgraphs are already closed', () => {
        const input = [
            'graph TD',
            '    subgraph A',
            '        X --> Y',
            '    end',
        ].join('\n');
        const out = sanitizeMermaid(input);
        const endCount = (out.match(/^\s*end\s*$/gm) ?? []).length;
        expect(endCount).toBe(1);
    });
});

describe('normalizeMermaidCodeBlocks', () => {
    it('adds mermaid language tag to unlabeled Mermaid code block', () => {
        const input = ['説明文', '```', 'graph TD', 'A --> B', '```'].join('\n');
        expect(normalizeMermaidCodeBlocks(input)).toBe(['説明文', '```mermaid', 'graph TD', 'A --> B', '```'].join('\n'));
    });

    it('preserves non-Mermaid unlabeled code block', () => {
        const input = ['```', 'const a = 1;', '```'].join('\n');
        expect(normalizeMermaidCodeBlocks(input)).toBe(input);
    });

    it('does not treat graph variable assignment as Mermaid', () => {
        const input = ['```', 'graph = { nodes: [] };', '```'].join('\n');
        expect(normalizeMermaidCodeBlocks(input)).toBe(input);
    });

    it('preserves already labeled Mermaid code block', () => {
        const input = ['```mermaid', 'sequenceDiagram', 'A->>B: hello', '```'].join('\n');
        expect(normalizeMermaidCodeBlocks(input)).toBe(input);
    });
});

describe('isLikelyMermaid', () => {
    it('detects common Mermaid diagram declarations', () => {
        expect(isLikelyMermaid('graph TD\nA --> B')).toBe(true);
        expect(isLikelyMermaid('flowchart LR\nA --> B')).toBe(true);
        expect(isLikelyMermaid('sequenceDiagram\nA->>B: hello')).toBe(true);
    });

    it('rejects graph without Mermaid direction', () => {
        expect(isLikelyMermaid('graph = { nodes: [] };')).toBe(false);
        expect(isLikelyMermaid('graph.forEach(node => visit(node));')).toBe(false);
    });
});
