#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const questionsRoot = path.join(repoRoot, 'packages', 'data', 'data', 'questions');
const afternoonSuffixPattern = /-(PM|PM1|PM2)$/;
const answerKeys = ['answer', 'modelAnswer', 'correctOption', 'correctAnswer', 'correct', 'expectedAnswer', 'answerExample', 'sampleAnswer'];
const explanationKeys = ['explanation', 'commentary', '解説'];

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const jsonOutput = args.has('--json');
const extractFromExplanation = args.has('--extract-from-explanation');

function normalizePath(filePath) {
    return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeQuestions(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.questions)) return data.questions;
    if (data && typeof data === 'object') return [data];
    return [];
}

function text(value) {
    return typeof value === 'string' ? value : '';
}

function hasText(value) {
    return text(value).trim().length > 0;
}

function childItems(section) {
    if (Array.isArray(section?.subQuestions) && section.subQuestions.length > 0) return section.subQuestions;
    if (Array.isArray(section?.questions) && section.questions.length > 0) return section.questions;
    return [];
}

function directAnswer(section) {
    return hasText(section?.answer) || hasText(section?.explanation) || hasText(section?.modelAnswer);
}

function shouldRenderSectionAnswerItem(section, children = childItems(section)) {
    if (!directAnswer(section)) return false;
    if (children.length === 0) return true;
    return hasText(section?.answer) || hasText(section?.modelAnswer);
}

function sections(question) {
    if (Array.isArray(question?.questions) && question.questions.length > 0) return question.questions;
    if (Array.isArray(question?.subQuestions) && question.subQuestions.length > 0) return question.subQuestions;
    return [];
}

function answerItems(section) {
    const children = childItems(section);
    const items = [];

    if (shouldRenderSectionAnswerItem(section, children)) {
        items.push({ holder: section, parent: section, label: section.subQNo || section.label || '解答' });
    }

    if (children.length > 0) {
        return [
            ...items,
            ...children.map((child) => ({ holder: child, parent: section, label: child.label || child.subQNo || '' })),
        ];
    }

    if (items.length > 0) return items;
    return hasText(section?.text) ? [{ holder: section, parent: section, label: section.subQNo || section.label || '解答' }] : [];
}

function hasAnyText(object, keys) {
    return keys.some((key) => hasText(object?.[key]));
}

function cleanOneLine(value) {
    return text(value)
        .replace(/^\s*(?:[-*]\s*)?/, '')
        .replace(/^[:：\s]+/, '')
        .replace(/\*\*/g, '')
        .replace(/^[「『](.*)[」』]$/, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function nextMeaningfulLines(lines, startIndex) {
    const collected = [];
    for (let i = startIndex + 1; i < lines.length && collected.length < 4; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;
        if (/^#{1,6}\s/.test(raw) && collected.length > 0) break;
        if (/^(?:解説|ポイント|理由|これら|したがって|以上|###)/.test(raw) && collected.length > 0) break;
        collected.push(raw.replace(/^[-*]\s*/, ''));
        if (/[。.]$/.test(raw) || collected.join('').length > 140) break;
    }
    return cleanOneLine(collected.join(' '));
}

function extractAnswerCandidate(explanation) {
    if (!hasText(explanation)) return '';
    const lines = text(explanation).replace(/\r\n/g, '\n').split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!/解答(?:例)?/.test(line)) continue;
        if (/解答\s*の\s*ポイント|解答ポイント|解答群/.test(line)) continue;

        const sameLine = cleanOneLine(line.replace(/^.*?解答(?:例)?\s*[:：]?\s*/, ''));
        if (isUsableAnswerCandidate(sameLine)) return sameLine.slice(0, 500);

        const nextLines = nextMeaningfulLines(lines, i);
        if (isUsableAnswerCandidate(nextLines)) return nextLines.slice(0, 500);
    }

    return '';
}

function isUsableAnswerCandidate(value) {
    const candidate = cleanOneLine(value);
    if (!candidate || candidate.length < 2) return false;
    if (/ポイント|解答群/.test(candidate)) return false;
    if (/^(?:例|解説|理由|本文中|関連記述|計算式|与えられた値)/.test(candidate)) return false;
    if (/^(?:これら|したがって|以上|つまり)/.test(candidate)) return false;
    return true;
}

function isEssayQuestion(examId, question, item) {
    if (!examId.endsWith('-PM2')) return false;
    const combined = [question?.context?.background, question?.description, item?.holder?.text, item?.parent?.text]
        .map(text)
        .join('\n');
    return /論述せよ|経験と考え|400\s*字以上|700\s*字以上|1,400\s*字以内|設問ア|設問イ|設問ウ/.test(combined);
}

function buildEssayAnswer() {
    return '（論述式・固定解答なし）この設問は受験者の経験に基づいて論述する形式のため、単一の固定模範解答はありません。設問で指定された概要、理由、評価、対応、監査手続などの観点を満たし、字数条件に沿って具体的に論述してください。';
}

function buildUnsyncedAnswer() {
    return '（自動補完・公式解答未同期）この設問の公式解答例はローカルデータへ未同期です。問題文、本文、図表、表、解答群を確認し、設問で指定された条件に沿って回答してください。';
}

function buildGenericExplanation(holder, parent, answer) {
    const prompt = cleanOneLine(holder?.text || parent?.text || '');
    if (answer.startsWith('（論述式・固定解答なし）')) {
        return '（自動補完）論述式問題のため、固定の模範解答ではなく設問要求への充足が評価の中心です。問題文の前提、設問で求められている観点、字数条件を確認し、経験した事例と判断根拠を具体的に記述してください。';
    }

    if (answer.startsWith('（自動補完・公式解答未同期）')) {
        return '（自動補完）公式解答例がローカルデータに未同期のため、本文・図表・表・解答群を根拠に確認する必要があります。設問で求められている対象、理由、条件、字数制限を整理して回答してください。';
    }

    const clippedAnswer = cleanOneLine(answer).slice(0, 120);
    const clippedPrompt = prompt ? `設問「${prompt.slice(0, 120)}」について、` : '';
    return `（自動補完）${clippedPrompt}問題文の条件に照らして「${clippedAnswer}」が解答例となります。本文中の根拠箇所、関連する図表・表、指定字数や選択条件を確認し、同じ趣旨になるように回答してください。`;
}

function buildInheritedExplanation(parent) {
    const parentLabel = parent?.subQNo || parent?.label || '親設問';
    const inherited = text(parent?.explanation).trim();
    if (!inherited) return '';
    if (inherited.length > 6000) {
        return `（自動補完）この小問の解説は${parentLabel}の総合解説に含まれています。親設問の解説を参照し、該当する小問ラベルと設問文に対応する根拠を確認してください。`;
    }
    return `（自動補完）この小問は${parentLabel}の一部です。以下の親設問解説を参照し、該当する小問ラベルと設問文に対応する根拠を確認してください。\n\n${inherited}`;
}

function completeFile(examId, filePath, data) {
    const report = {
        examId,
        file: normalizePath(filePath),
        answerFilledFromExplanation: 0,
        answerFilledEssay: 0,
        answerFilledUnsynced: 0,
        explanationInherited: 0,
        explanationGenerated: 0,
    };

    for (const question of normalizeQuestions(data)) {
        for (const section of sections(question)) {
            for (const item of answerItems(section)) {
                const { holder, parent } = item;

                if (!hasAnyText(holder, answerKeys)) {
                    const extracted = extractFromExplanation
                        ? extractAnswerCandidate(holder?.explanation) || extractAnswerCandidate(parent?.explanation)
                        : '';
                    if (extracted) {
                        holder.answer = extracted;
                        report.answerFilledFromExplanation++;
                    } else if (isEssayQuestion(examId, question, item)) {
                        holder.answer = buildEssayAnswer();
                        report.answerFilledEssay++;
                    } else {
                        holder.answer = buildUnsyncedAnswer();
                        report.answerFilledUnsynced++;
                    }
                }

                if (!hasAnyText(holder, explanationKeys)) {
                    const inherited = parent !== holder ? buildInheritedExplanation(parent) : '';
                    if (inherited) {
                        holder.explanation = inherited;
                        report.explanationInherited++;
                    } else {
                        const answer = answerKeys.map((key) => text(holder?.[key]).trim()).find(Boolean) || '';
                        holder.explanation = buildGenericExplanation(holder, parent, answer);
                        report.explanationGenerated++;
                    }
                }
            }
        }
    }

    return report;
}

function hasChanges(report) {
    return Object.entries(report).some(([key, value]) => key !== 'examId' && key !== 'file' && Number(value) > 0);
}

if (!fs.existsSync(questionsRoot)) {
    console.error(`questions root not found: ${questionsRoot}`);
    process.exit(1);
}

const reports = [];

for (const dirent of fs.readdirSync(questionsRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const examId = dirent.name;
    if (!afternoonSuffixPattern.test(examId)) continue;

    const examDir = path.join(questionsRoot, examId);
    const filePath = ['questions_transformed.json', 'questions_raw.json']
        .map((name) => path.join(examDir, name))
        .find((candidate) => fs.existsSync(candidate));

    if (!filePath) continue;

    const data = readJson(filePath);
    const report = completeFile(examId, filePath, data);
    if (!hasChanges(report)) continue;

    reports.push(report);
    if (apply) writeJson(filePath, data);
}

const totals = reports.reduce(
    (acc, report) => {
        for (const key of Object.keys(acc)) acc[key] += report[key] || 0;
        return acc;
    },
    {
        answerFilledFromExplanation: 0,
        answerFilledEssay: 0,
        answerFilledUnsynced: 0,
        explanationInherited: 0,
        explanationGenerated: 0,
    },
);

const result = {
    status: apply ? 'APPLIED' : 'DRY_RUN',
    changedFiles: reports.length,
    totals,
    files: reports,
};

if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log(`午後問題欠落補完: ${result.status}`);
    console.log(`変更対象ファイル: ${result.changedFiles}`);
    console.log(`answer: explanation抽出=${totals.answerFilledFromExplanation}, 論述式固定解答なし=${totals.answerFilledEssay}, 公式解答未同期=${totals.answerFilledUnsynced}`);
    console.log(`explanation: 親解説継承=${totals.explanationInherited}, 自動補完=${totals.explanationGenerated}`);
    if (!apply) console.log('実際に書き込むには --apply を指定してください。');
}