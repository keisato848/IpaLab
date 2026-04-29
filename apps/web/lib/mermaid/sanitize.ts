/**
 * Mermaid syntax sanitizer.
 *
 * IPA 試験問題のデータセットや AI Assistant の生成物に含まれる Mermaid 記法は、
 * Mermaid 10.x のパーサで素直に通らないケースが多い。共通サニタイザを Mermaid
 * コンポーネントの直前で適用することで、利用箇所（QuestionClient / SCPMExamView /
 * AIAnswerBox など）に依らず一貫して描画失敗を防ぐ。
 *
 * 関連 Issue: #203 (図の描画に失敗している)
 */

const NEEDS_QUOTING = /[<>():,]|x\s+x/;
const MERMAID_START = /^\s*(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|sankey-beta|xychart-beta|block-beta|packet-beta)\b/i;

export function isLikelyMermaid(chart: string): boolean {
    return MERMAID_START.test(chart);
}

export function normalizeMermaidCodeBlocks(markdown: string): string {
    if (!markdown) return markdown;

    return markdown.replace(/```[ \t]*\r?\n([\s\S]*?)```/g, (match, body: string) => {
        if (!isLikelyMermaid(body)) return match;
        return match.replace(/^```[ \t]*(\r?\n)/, '```mermaid$1');
    });
}

/**
 * Mermaid のノードラベル `Id[label]` / `Id(label)` / `Id{label}` のうち、
 * 未クォートかつ Mermaid パーサが嫌う特殊文字を含むものを `Id["label"]` 等にラップする。
 *
 * - 既にダブルクォートで囲まれているラベルは触らない（`[^\]\)\}"\n]*` で保証）
 * - エッジ構文 `A --> B` などはラベルが括弧内にないので対象外
 * - フローチャートの `subgraph` / `flowchart TD` 等の宣言行も対象外
 */
export function sanitizeMermaid(chart: string): string {
    if (!chart) return chart;

    // 1. Comment out invalid "note:" lines that are not valid Mermaid formatting
    let out = chart.replace(/(\n\s*)note:/gi, '$1%% note:');

    // 2. Quote node labels containing characters Mermaid 10.x cannot parse unquoted.
    //    Process each bracket pair separately so that `(` inside `[...]` etc. are tolerated.
    const quoteLabel = (open: string, close: string, charClass: string) => {
        const re = new RegExp(`(\\b\\w+)\\${open}([${charClass}]*)\\${close}`, 'g');
        out = out.replace(re, (match, id: string, label: string) => {
            if (!NEEDS_QUOTING.test(label)) return match;
            const inner = label.replace(/"/g, '#quot;');
            return `${id}${open}"${inner}"${close}`;
        });
    };
    quoteLabel('[', ']', '^\\]"\\n');
    quoteLabel('(', ')', '^)"\\n');
    quoteLabel('{', '}', '^}"\\n');

    return out;
}
