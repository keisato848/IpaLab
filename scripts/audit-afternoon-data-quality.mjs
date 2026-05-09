#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const questionsRoot = path.join(repoRoot, 'packages', 'data', 'data', 'questions');
const defaultTargetCategories = ['AP', 'SA', 'PM', 'SC', 'ST', 'NW', 'FE', 'DB', 'AU', 'SM', 'ES'];
const afternoonSuffixPattern = /-(PM|PM1|PM2)$/;
const limitPattern = /(\d{1,4})\s*(?:字|文字)\s*(?:以内|以下|まで)/g;
const symbolAnswerPattern = /(記号で答えよ|解答群の中から|選び、?記号|全て選び、?記号|二つ選び、?記号)/;
const inlineChoiceBodyPattern = /(解答群\s*[：:]|[ア-ン]\s*[\.．、:：])/;
const broadPromptPattern = /について[，、]?\s*答えよ[。.]?$/;
const shortAnswerNoLimitPattern = /(表\d|図\d|属性|四則演算|計算|式|数値|整数|名称|機能名|ファイル|項目|アルファベット\s*\d*\s*字|用いて答えよ|求めよ|答えよ[。.]?$)/;
const englishTextFragmentPattern = /\b(?:The function|Fill the blank|Which of the following|Determine the correct|This corresponds|Current Configuration|Planned Configuration|Risk Mitigation|Unauthorized|Private PC|Internal PC|By allowing|Therefore, Option|Diagram content for|Security Measures Review|Risk Assessment concerning|Web Application Program Development)\b/i;
const underlineRefPattern = /下線\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|\d{1,2})/g;
const underlineEvidencePattern = /<u\b|underline|text-decoration/i;
const choiceKeys = ['choices', 'options', 'answerChoices'];

const args = new Map(
    process.argv.slice(2).map((arg) => {
        const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
        return match ? [match[1], match[2] ?? 'true'] : [arg, 'true'];
    }),
);
function argValue(name, envName = name.replaceAll('-', '_')) {
    return args.get(name) ?? process.env[`npm_config_${envName}`];
}

const jsonOutput = argValue('json') === 'true';
const failOnFindings = argValue('fail-on-findings') === 'true';
const categoriesArg = argValue('categories');
const excludeArg = argValue('exclude');
const includeCategories = categoriesArg
    ? new Set(categoriesArg.split(',').map((value) => value.trim()).filter(Boolean))
    : null;
const excludeCategories = new Set((excludeArg || '').split(',').map((value) => value.trim()).filter(Boolean));

function normalizePath(filePath) {
    return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getExamFile(examId) {
    for (const name of ['questions_transformed.json', 'questions_raw.json']) {
        const filePath = path.join(questionsRoot, examId, name);
        if (fs.existsSync(filePath)) return filePath;
    }
    return null;
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

function sections(question) {
    if (Array.isArray(question?.questions) && question.questions.length > 0) return question.questions;
    if (Array.isArray(question?.subQuestions) && question.subQuestions.length > 0) return question.subQuestions;
    return [];
}

function answerItems(section) {
    const children = childItems(section);
    const items = [];
    if (directAnswer(section)) {
        items.push({ source: 'parentDirect', holder: section, promptText: text(section.text), label: section.subQNo || section.label || '解答' });
    }
    for (const child of children) {
        items.push({ source: 'child', holder: child, promptText: text(child.text), label: child.label || child.subQNo || '' });
    }
    if (items.length > 0) return items;
    if (hasText(section?.text)) {
        items.push({ source: 'parentFallback', holder: section, promptText: text(section.text), label: section.subQNo || section.label || '解答' });
    }
    return items;
}

function uniqueLimits(value) {
    const limits = new Set();
    for (const match of text(value).matchAll(limitPattern)) {
        const limit = Number(match[1]);
        if (Number.isFinite(limit) && limit > 0) limits.add(limit);
    }
    return [...limits];
}

function getChoiceValues(...objects) {
    const values = [];
    for (const object of objects) {
        for (const key of choiceKeys) {
            const raw = object?.[key];
            if (Array.isArray(raw)) {
                for (const value of raw) {
                    values.push(typeof value === 'string' ? value : text(value?.id || value?.label || value?.key || value?.text));
                }
            } else if (raw && typeof raw === 'object') {
                values.push(...Object.keys(raw));
            }
        }
    }
    return values.map((value) => text(value).trim()).filter(Boolean);
}

function getUnderlineRefs(value) {
    const refs = [];
    for (const match of text(value).matchAll(underlineRefPattern)) refs.push(match[1]);
    return refs;
}

function refVariants(ref) {
    const circled = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
    const index = circled.indexOf(ref);
    if (index >= 0) return [ref, String(index + 1)];
    const numeric = Number(ref);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= circled.length) return [ref, circled[numeric - 1]];
    return [ref];
}

function findLine(filePath, needle) {
    const normalizedNeedle = text(needle).replace(/\s+/g, ' ').slice(0, 72);
    if (!normalizedNeedle) return null;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].replace(/\s+/g, ' ').includes(normalizedNeedle)) return i + 1;
    }
    return null;
}

function makeStats() {
    return {
        files: 0,
        mainQuestions: 0,
        answerFields: 0,
        underlineRefs: 0,
        underlineNoEvidence: 0,
        underlineRefMissing: 0,
        parentDirectWithChildren: 0,
        explanationOnlyParentWithChildren: 0,
        multipleLimits: 0,
        symbolAnswers: 0,
        symbolNoStructuralChoices: 0,
        symbolNoInlineChoiceBody: 0,
        sharedBroadChoiceGroup: 0,
        broadPromptNoLimit: 0,
        shortAnswerNoLimit: 0,
        englishTextFragments: 0,
    };
}

function addExample(examples, key, value) {
    if (!examples[key]) examples[key] = [];
    if (examples[key].length < 8) examples[key].push(value);
}

function textFragments(question) {
    const fragments = [
        ['theme', question?.theme],
        ['description', question?.description],
        ['context.title', question?.context?.title],
        ['context.background', question?.context?.background],
    ];
    for (const diagram of question?.context?.diagrams || []) {
        const diagramName = diagram.id || diagram.label || 'unknown';
        fragments.push([`diagram.${diagramName}.label`, diagram.label]);
        fragments.push([`diagram.${diagramName}.content`, diagram.content]);
    }
    for (const section of sections(question)) {
        fragments.push([`section.${section.subQNo || section.label || 'unknown'}.text`, section.text]);
        fragments.push([`section.${section.subQNo || section.label || 'unknown'}.explanation`, section.explanation]);
        for (const child of childItems(section)) {
            fragments.push([`child.${child.label || child.subQNo || 'unknown'}.text`, child.text]);
            fragments.push([`child.${child.label || child.subQNo || 'unknown'}.explanation`, child.explanation]);
        }
    }
    return fragments;
}

if (!fs.existsSync(questionsRoot)) {
    console.error(`questions root not found: ${questionsRoot}`);
    process.exit(1);
}

const byCategory = new Map();
const bySuffix = new Map();
const examples = {};
const categoryExamCounts = new Map();
let total = makeStats();

function addStats(target, delta) {
    for (const key of Object.keys(delta)) target[key] += delta[key];
}

for (const dirent of fs.readdirSync(questionsRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const examId = dirent.name;
    if (!afternoonSuffixPattern.test(examId)) continue;

    const category = examId.split('-')[0];
    const suffix = examId.match(afternoonSuffixPattern)?.[1] || 'PM';
    if (includeCategories && !includeCategories.has(category)) continue;
    if (excludeCategories.has(category)) continue;

    const filePath = getExamFile(examId);
    if (!filePath) continue;

    if (!byCategory.has(category)) byCategory.set(category, makeStats());
    if (!bySuffix.has(`${category}-${suffix}`)) bySuffix.set(`${category}-${suffix}`, makeStats());
    categoryExamCounts.set(category, (categoryExamCounts.get(category) || 0) + 1);

    const data = readJson(filePath);
    const questions = normalizeQuestions(data);
    const fileStats = makeStats();
    fileStats.files = 1;
    fileStats.mainQuestions = questions.length;

    for (const question of questions) {
        const contextText = JSON.stringify(question?.context || question?.description || question?.background || '');
        const questionChoiceSignatures = new Map();

        for (const [location, value] of textFragments(question)) {
            const fragment = text(value).trim();
            if (!fragment || !englishTextFragmentPattern.test(fragment)) continue;
            fileStats.englishTextFragments++;
            addExample(examples, 'englishTextFragments', {
                examId,
                file: normalizePath(filePath),
                qNo: question.qNo,
                location,
                line: findLine(filePath, fragment),
                text: fragment.replace(/\s+/g, ' ').slice(0, 120),
            });
        }

        for (const section of sections(question)) {
            const children = childItems(section);
            if (children.length > 0 && directAnswer(section)) {
                fileStats.parentDirectWithChildren++;
                addExample(examples, 'parentDirectWithChildren', {
                    examId,
                    file: normalizePath(filePath),
                    qNo: question.qNo,
                    subQNo: section.subQNo || section.label || '',
                    line: findLine(filePath, section.text),
                    text: text(section.text).replace(/\s+/g, ' ').slice(0, 120),
                });
                if (!hasText(section.answer) && !hasText(section.modelAnswer)) {
                    fileStats.explanationOnlyParentWithChildren++;
                }
            }

            for (const item of answerItems(section)) {
                const promptText = item.promptText;
                const limits = uniqueLimits(promptText);
                const choices = getChoiceValues(item.holder, section, question);
                const refs = getUnderlineRefs(promptText);
                const symbolAnswer = symbolAnswerPattern.test(promptText);
                fileStats.answerFields++;

                if (refs.length > 0) {
                    fileStats.underlineRefs++;
                    if (!underlineEvidencePattern.test(contextText)) {
                        fileStats.underlineNoEvidence++;
                        addExample(examples, 'underlineNoEvidence', {
                            examId,
                            file: normalizePath(filePath),
                            qNo: question.qNo,
                            subQNo: item.label,
                            line: findLine(filePath, promptText),
                            refs,
                            text: promptText.replace(/\s+/g, ' ').slice(0, 120),
                        });
                    }
                    const missingRefs = refs.filter((ref) => !refVariants(ref).some((variant) => contextText.includes(variant)));
                    if (missingRefs.length > 0) {
                        fileStats.underlineRefMissing++;
                        addExample(examples, 'underlineRefMissing', {
                            examId,
                            file: normalizePath(filePath),
                            qNo: question.qNo,
                            subQNo: item.label,
                            line: findLine(filePath, promptText),
                            refs: missingRefs,
                            text: promptText.replace(/\s+/g, ' ').slice(0, 120),
                        });
                    }
                }

                if (limits.length > 1) {
                    fileStats.multipleLimits++;
                    addExample(examples, 'multipleLimits', {
                        examId,
                        file: normalizePath(filePath),
                        qNo: question.qNo,
                        subQNo: item.label,
                        line: findLine(filePath, promptText),
                        limits,
                        text: promptText.replace(/\s+/g, ' ').slice(0, 120),
                    });
                }

                if (symbolAnswer) {
                    fileStats.symbolAnswers++;
                    if (choices.length === 0) {
                        fileStats.symbolNoStructuralChoices++;
                        addExample(examples, 'symbolNoStructuralChoices', {
                            examId,
                            file: normalizePath(filePath),
                            qNo: question.qNo,
                            subQNo: item.label,
                            line: findLine(filePath, promptText),
                            text: promptText.replace(/\s+/g, ' ').slice(0, 120),
                        });
                    }
                    if (!inlineChoiceBodyPattern.test(promptText)) {
                        fileStats.symbolNoInlineChoiceBody++;
                    }
                }

                if (choices.length >= 10) {
                    const signature = choices.join('|');
                    questionChoiceSignatures.set(signature, (questionChoiceSignatures.get(signature) || 0) + 1);
                }

                if (broadPromptPattern.test(promptText.trim()) && limits.length === 0) {
                    fileStats.broadPromptNoLimit++;
                    addExample(examples, 'broadPromptNoLimit', {
                        examId,
                        file: normalizePath(filePath),
                        qNo: question.qNo,
                        subQNo: item.label,
                        source: item.source,
                        line: findLine(filePath, promptText),
                        text: promptText.replace(/\s+/g, ' ').slice(0, 120),
                    });
                }

                if (
                    suffix !== 'PM2'
                    && !symbolAnswer
                    && choices.length === 0
                    && limits.length === 0
                    && shortAnswerNoLimitPattern.test(promptText.trim())
                ) {
                    fileStats.shortAnswerNoLimit++;
                    addExample(examples, 'shortAnswerNoLimit', {
                        examId,
                        file: normalizePath(filePath),
                        qNo: question.qNo,
                        subQNo: item.label,
                        source: item.source,
                        line: findLine(filePath, promptText),
                        text: promptText.replace(/\s+/g, ' ').slice(0, 120),
                    });
                }
            }
        }

        for (const count of questionChoiceSignatures.values()) {
            if (count > 1) fileStats.sharedBroadChoiceGroup++;
        }
    }

    addStats(total, fileStats);
    addStats(byCategory.get(category), fileStats);
    addStats(bySuffix.get(`${category}-${suffix}`), fileStats);
}

const missingTargetCategories = defaultTargetCategories.filter((category) => !categoryExamCounts.has(category));
const result = {
    status: 'AFTERNOON_DATA_QUALITY_AUDIT_COMPLETE',
    scope: {
        questionsRoot: normalizePath(questionsRoot),
        includedCategories: includeCategories ? [...includeCategories] : 'all',
        excludedCategories: [...excludeCategories],
        missingTargetCategories,
    },
    total,
    byCategory: Object.fromEntries([...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))),
    bySuffix: Object.fromEntries([...bySuffix.entries()].sort(([a], [b]) => a.localeCompare(b))),
    examples,
};

if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log(`# Afternoon data quality audit`);
    console.log(`status=${result.status}`);
    console.log(`files=${total.files} mainQuestions=${total.mainQuestions} answerFields=${total.answerFields}`);
    console.log(`missingTargetCategories=${missingTargetCategories.join(',') || 'none'}`);
    console.log('');
    console.log('| Category | Files | Main | Fields | Underline refs | No underline evidence | Ref missing | Parent+children | Explanation-only parent | Multiple limits | Symbol no choices | Broad no limit | Short no limit | English fragments |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [category, stats] of [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`| ${category} | ${stats.files} | ${stats.mainQuestions} | ${stats.answerFields} | ${stats.underlineRefs} | ${stats.underlineNoEvidence} | ${stats.underlineRefMissing} | ${stats.parentDirectWithChildren} | ${stats.explanationOnlyParentWithChildren} | ${stats.multipleLimits} | ${stats.symbolNoStructuralChoices} | ${stats.broadPromptNoLimit} | ${stats.shortAnswerNoLimit} | ${stats.englishTextFragments} |`);
    }
    console.log('');
    for (const [key, values] of Object.entries(examples)) {
        console.log(`## ${key}`);
        for (const example of values) {
            console.log(`- ${example.file}${example.line ? `:${example.line}` : ''} examId=${example.examId} qNo=${example.qNo} subQNo=${example.subQNo || ''} ${example.text || ''}`);
        }
        console.log('');
    }
}

const findingCount = total.underlineNoEvidence
    + total.underlineRefMissing
    + total.explanationOnlyParentWithChildren
    + total.multipleLimits
    + total.symbolNoStructuralChoices
    + total.sharedBroadChoiceGroup
    + total.broadPromptNoLimit
    + total.shortAnswerNoLimit
    + total.englishTextFragments
    + missingTargetCategories.length;

if (failOnFindings && findingCount > 0) {
    process.exit(1);
}
