/**
 * Regression test for PR #173 / EXP03:
 *   remark-math 5 → 6 / rehype-katex 6 → 7 / rehypePlugins 順序 [rehypeRaw, rehypeKatex]
 *   への変更により、`$...$` を含む Markdown を ReactMarkdown でレンダリングしても
 *   `Cannot set properties of undefined (setting 'value')` を投げないことを保証する。
 *
 *   QuestionClient 全体を render するには Next/Auth/API モックが大量に必要なので、
 *   ここでは同じプラグイン構成での ReactMarkdown 単体レンダリングを検証する。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

const renderMath = (md: string) =>
    render(
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath] as any}
            rehypePlugins={[rehypeRaw, rehypeKatex] as any}
        >
            {md}
        </ReactMarkdown>
    );

describe('Markdown math rendering (remark-math + rehype-katex)', () => {
    it('インライン数式 $...$ を例外なくレンダリングできる', () => {
        expect(() => renderMath('条件付き確率は $P(A|B) = P(A \\cap B) / P(B)$ で表される。')).not.toThrow();
    });

    it('ブロック数式 $$...$$ を例外なくレンダリングできる', () => {
        expect(() =>
            renderMath('次のとおり:\n\n$$\nE = mc^2\n$$\n\n以上。')
        ).not.toThrow();
    });

    it('数式と通常 Markdown(リスト/コード) が混在しても例外を投げない', () => {
        const md = [
            '## 解説',
            '- 公式: $a^2 + b^2 = c^2$',
            '- コード: `let x = 1;`',
            '',
            '```ts',
            'const y = 2;',
            '```',
            '',
            '$$\\sum_{i=0}^{n} i$$',
        ].join('\n');
        expect(() => renderMath(md)).not.toThrow();
    });
});
