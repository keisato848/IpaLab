#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const questionsRoot = path.join(repoRoot, 'packages', 'data', 'data', 'questions');
const examListPath = path.join(repoRoot, 'packages', 'data', 'src', 'scraper', 'exam-list.ts');
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const jsonOutput = args.has('--json');
const targetCategories = getArgValue('--categories', '')
  .split(',')
  .map((category) => category.trim().toUpperCase())
  .filter(Boolean);
const fromYear = Number.parseInt(getArgValue('--from-year', '0'), 10);
const toYear = Number.parseInt(getArgValue('--to-year', '9999'), 10);

function getArgValue(name, defaultValue) {
  const prefix = `${name}=`;
  const inline = rawArgs.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = rawArgs.indexOf(name);
  if (index >= 0 && rawArgs[index + 1]) return rawArgs[index + 1];
  return defaultValue;
}

function parseExamId(examId) {
  const match = examId.match(/^(?<category>[A-Z]{2})-(?<year>\d{4})-(Spring|Fall|Public|Sample|Oct)-(AM|AM1|AM2|PM|PM1|PM2)$/);
  if (!match?.groups) return null;
  return {
    category: match.groups.category,
    year: Number.parseInt(match.groups.year, 10),
  };
}

function isInScope(examId) {
  const parsed = parseExamId(examId);
  if (!parsed) return true;
  if (targetCategories.length > 0 && !targetCategories.includes(parsed.category)) return false;
  return parsed.year >= fromYear && parsed.year <= toYear;
}

function resolveQNo(value) {
  if (Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number.parseInt(value, 10);
  return null;
}

function selectQuestionFile(examDir) {
  const transformed = path.join(examDir, 'questions_transformed.json');
  const raw = path.join(examDir, 'questions_raw.json');
  if (fs.existsSync(transformed)) return transformed;
  if (fs.existsSync(raw)) return raw;
  return null;
}

function normalizeQuestions(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && resolveQNo(data.qNo)) return [data];
  if (data && typeof data === 'object' && Array.isArray(data.questions)) return data.questions;
  return [];
}

function listLocalExamIds() {
  if (!fs.existsSync(questionsRoot)) return [];
  return fs.readdirSync(questionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function loadPublishedExamIds() {
  if (!fs.existsSync(examListPath)) return [];
  const source = fs.readFileSync(examListPath, 'utf8');
  const ids = [];
  const objectPattern = /\{[^{}]*category:\s*["'](?<category>[A-Z]{2})["'][^{}]*year:\s*["'](?<year>\d{4})["'][^{}]*term:\s*["'](?<term>[A-Za-z]+)["'][^{}]*type:\s*["'](?<type>AM1?|AM2|PM|PM1|PM2)["'][^{}]*url:\s*["']https?:\/\/[^"']+["'][^{}]*\}/g;
  for (const match of source.matchAll(objectPattern)) {
    const { category, year, term, type } = match.groups;
    ids.push(`${category}-${year}-${term}-${type}`);
  }
  return [...new Set(ids)].sort();
}

const allLocalExamIds = listLocalExamIds();
const localExamIds = allLocalExamIds.filter(isInScope);
const publishedExamIds = loadPublishedExamIds().filter(isInScope);
const issues = [];
const stats = {
  examDirCount: localExamIds.length,
  publishedExamCount: publishedExamIds.length,
  parsedQuestionCount: 0,
  missingPublishedExamCount: 0,
  localOnlyExamCount: 0,
  blockingIssueCount: 0,
};

for (const examId of localExamIds) {
  const examDir = path.join(questionsRoot, examId);
  const selectedFile = selectQuestionFile(examDir);
  if (!/^[A-Z]{2}-\d{4}-(Spring|Fall|Public|Sample|Oct)-(AM|AM1|AM2|PM|PM1|PM2)$/.test(examId)) {
    issues.push({ severity: 'warn', rule: 'EXAM_ID_FORMAT', examId, detail: 'examId が標準形式ではありません' });
  }
  if (!selectedFile) {
    issues.push({ severity: 'error', rule: 'QUESTION_FILE_MISSING', examId, detail: 'questions_transformed.json / questions_raw.json がありません' });
    continue;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(selectedFile, 'utf8'));
  } catch (error) {
    issues.push({ severity: 'error', rule: 'JSON_PARSE_ERROR', examId, detail: error.message });
    continue;
  }

  const questions = normalizeQuestions(data);
  stats.parsedQuestionCount += questions.length;
  if (questions.length === 0) {
    issues.push({ severity: 'error', rule: 'QUESTION_EMPTY', examId, detail: '同期対象の問題が 0 件です' });
    continue;
  }

  const seen = new Set();
  const qNos = [];
  for (const question of questions) {
    const qNo = resolveQNo(question?.qNo);
    if (!qNo) {
      issues.push({ severity: 'error', rule: 'QNO_INVALID', examId, detail: 'qNo が欠損または正の整数ではありません' });
      continue;
    }
    if (seen.has(qNo)) {
      issues.push({ severity: 'error', rule: 'QNO_DUPLICATE', examId, detail: `Q${qNo} が重複しています` });
    }
    seen.add(qNo);
    qNos.push(qNo);
  }

  if (/-(PM|PM1|PM2)$/.test(examId)) {
    const hasQ99 = qNos.includes(99);
    const hasAfternoonQNo = qNos.some((qNo) => qNo >= 1 && qNo <= 20);
    if (hasQ99 && !hasAfternoonQNo) {
      issues.push({ severity: 'error', rule: 'PM_QNO99_PLACEHOLDER_ONLY', examId, detail: '午後問題が Q99 のみで構成されています' });
    }
  }
}

const localSet = new Set(localExamIds);
const publishedSet = new Set(publishedExamIds);
const missingPublished = publishedExamIds.filter((examId) => !localSet.has(examId));
const localOnly = localExamIds.filter((examId) => isInScope(examId) && publishedSet.size > 0 && !publishedSet.has(examId));

stats.missingPublishedExamCount = missingPublished.length;
stats.localOnlyExamCount = localOnly.length;
for (const examId of missingPublished) {
  issues.push({ severity: 'error', rule: 'PUBLISHED_EXAM_MISSING_LOCAL', examId, detail: 'exam-list.ts にある IPA 公開データがローカルにありません' });
}
for (const examId of localOnly) {
  issues.push({ severity: 'info', rule: 'LOCAL_EXAM_NOT_IN_EXAM_LIST', examId, detail: 'ローカルに存在しますが exam-list.ts にはありません' });
}

stats.blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;

const result = {
  status: stats.blockingIssueCount === 0 ? 'LOCAL_EXAM_DATA_AUDIT_OK' : 'LOCAL_EXAM_DATA_AUDIT_FAILED',
  ...stats,
  issues: issues.slice(0, 200),
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`status=${result.status}`);
  console.log(`examDirCount=${stats.examDirCount}`);
  console.log(`publishedExamCount=${stats.publishedExamCount}`);
  console.log(`parsedQuestionCount=${stats.parsedQuestionCount}`);
  console.log(`blockingIssueCount=${stats.blockingIssueCount}`);
  console.log(`missingPublishedExamCount=${stats.missingPublishedExamCount}`);
  for (const issue of issues.slice(0, 50)) {
    console.log(`${issue.severity}\t${issue.rule}\t${issue.examId}\t${issue.detail}`);
  }
}

process.exit(stats.blockingIssueCount === 0 ? 0 : 1);