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

const NEEDS_QUOTING = /[^\x00-\x7F]|[<>():,]|x\s+x/;
const MERMAID_START = /^\s*(?:(?:graph|flowchart)\s+(?:TD|TB|BT|RL|LR)\b|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|sankey-beta|xychart-beta|block-beta|packet-beta)\b/i;

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

function unwrapMermaidChart(chart: string): string {
    let out = chart.trim();

    out = out
        .replace(/^\[CODE_BLOCK:mermaid\]\s*/i, '')
        .replace(/\s*\[\/CODE_BLOCK\]$/i, '')
        .trim();

    const fenced = out.match(/^```(?:mermaid)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/i);
    if (fenced && isLikelyMermaid(fenced[1])) {
        return fenced[1].trim();
    }

    return out;
}

function escapeMermaidText(label: string): string {
    return label
        .replace(/"/g, '#quot;')
        .replace(/\r?\n/g, '<br/>')
        .trim();
}

function sanitizeSubgraphLabels(chart: string): string {
    let index = 0;
    return chart.split(/\r?\n/).map((line) => {
        const match = line.match(/^(\s*)subgraph\s+(.+?)\s*$/);
        if (!match) return line;

        const [, indent, rawLabel] = match;
        const label = rawLabel.trim();
        const namedBracketLabel = label.match(/^([A-Za-z_][\w-]*)\s+\[(.+)\]$/);
        if (namedBracketLabel) {
            const [, id, subgraphLabel] = namedBracketLabel;
            return `${indent}subgraph ${id}["${escapeMermaidText(subgraphLabel)}"]`;
        }

        const alreadyHasMermaidLabel = /^[A-Za-z_][\w-]*\[".+"\]$/.test(label);
        const simpleAsciiIdentifier = /^[A-Za-z_][\w-]*$/.test(label);
        if (alreadyHasMermaidLabel || simpleAsciiIdentifier) return line;

        index += 1;
        return `${indent}subgraph sanitized_subgraph_${index}["${escapeMermaidText(label)}"]`;
    }).join('\n');
}

function relationCardinality(operator: string): string {
    if (operator === '||--o{') return '1:N';
    if (operator === '||--||') return '1:1';
    if (operator === '}o--||') return 'N:1';
    if (operator === '}o--o{') return 'N:N';
    return operator.replace(/[|{}]/g, '');
}

function convertErDiagramToFlowchart(chart: string): string {
    if (!/^\s*erDiagram\b/i.test(chart)) return chart;

    const entities = new Map<string, { id: string; attributes: string[] }>();
    const relations: { from: string; to: string; operator: string; label: string }[] = [];
    let currentEntity: string | null = null;

    const ensureEntity = (name: string) => {
        const trimmedName = name.trim();
        if (!entities.has(trimmedName)) {
            entities.set(trimmedName, {
                id: `ER${entities.size + 1}`,
                attributes: [],
            });
        }
        return entities.get(trimmedName)!;
    };

    for (const rawLine of chart.split(/\r?\n/).slice(1)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('%') || line.startsWith('%%')) continue;

        if (currentEntity) {
            if (line === '}') {
                currentEntity = null;
                continue;
            }
            ensureEntity(currentEntity).attributes.push(line);
            continue;
        }

        const entityMatch = line.match(/^(.+?)\s*\{\s*$/);
        if (entityMatch) {
            currentEntity = entityMatch[1].trim();
            ensureEntity(currentEntity);
            continue;
        }

        const relationMatch = line.match(/^(.+?)\s+([|o}{.-]+)\s+(.+?)\s*:\s*(.+)$/);
        if (relationMatch) {
            const [, from, operator, to, label] = relationMatch;
            ensureEntity(from);
            ensureEntity(to);
            relations.push({
                from: from.trim(),
                to: to.trim(),
                operator,
                label: label.trim(),
            });
        }
    }

    if (entities.size === 0) return chart;

    const lines = ['flowchart LR'];
    for (const [name, entity] of entities) {
        const details = [name, ...entity.attributes].map(escapeMermaidText).join('<br/>');
        lines.push(`    ${entity.id}["${details}"]`);
    }

    for (const relation of relations) {
        const from = entities.get(relation.from);
        const to = entities.get(relation.to);
        if (!from || !to) continue;
        const label = `${relation.label} ${relationCardinality(relation.operator)}`.trim();
        lines.push(`    ${from.id} -->|"${escapeMermaidText(label)}"| ${to.id}`);
    }

    return lines.join('\n');
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

    chart = unwrapMermaidChart(chart);
    chart = convertErDiagramToFlowchart(chart);

    // 1. Comment out invalid "note:" lines that are not valid Mermaid formatting
    let out = chart.replace(/(\n\s*)note:/gi, '$1%% note:');
    out = sanitizeSubgraphLabels(out);

    // 1a. Fix spaced arrow syntax "-- >" → "-->" (common OCR/extraction artifact)
    out = out.replace(/--\s+>/g, '-->');

    // 1b. Comment out invalid multi-node label lines: "A & B & C: text"
    //     (3+ nodes joined by & with colon-label but no arrow — not valid Mermaid)
    out = out.replace(/^(\s*)((?:[\w-]+\s*&\s*){2,}[\w-]+)\s*:\s*(\S.*)$/gm, '$1%% $2: $3');

    // 1c. Close any unclosed subgraph blocks (missing `end` due to truncated/malformed data)
    const subgraphOpens = (out.match(/^\s*subgraph\b/gm) ?? []).length;
    const subgraphEnds = (out.match(/^\s*end\s*$/gm) ?? []).length;
    if (subgraphOpens > subgraphEnds) {
        out = out.trimEnd() + '\n' + 'end\n'.repeat(subgraphOpens - subgraphEnds);
    }

    // 2. Quote node labels containing characters Mermaid 10.x cannot parse unquoted.
    //    Process each bracket pair separately so that `(` inside `[...]` etc. are tolerated.
    out = out.replace(/(\b\w+)\(\(([^)"\n]*)\)\)/g, (match, id: string, label: string) => {
        if (!NEEDS_QUOTING.test(label)) return match;
        return `${id}(("${label.replace(/"/g, '#quot;')}"))`;
    });

    const quoteLabel = (open: string, close: string, charClass: string) => {
        const re = new RegExp(`(\\b\\w+)\\${open}([${charClass}]*)\\${close}`, 'g');
        out = out.replace(re, (match, id: string, label: string) => {
            if (open === '(' && match.startsWith(`${id}((`)) return match;
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
