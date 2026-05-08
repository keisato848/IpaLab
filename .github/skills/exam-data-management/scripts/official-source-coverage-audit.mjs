#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const ipaBaseUrl = 'https://www.ipa.go.jp';
const questionsRoot = path.join(repoRoot, 'packages', 'data', 'data', 'questions');
const examListPath = path.join(repoRoot, 'packages', 'data', 'src', 'scraper', 'exam-list.ts');
const defaultTargetCategories = ['AP', 'PM', 'SC', 'FE', 'NW', 'DB', 'AU', 'SM', 'SA', 'ES', 'ST'];
const supportedTypes = ['AM', 'AM1', 'AM2', 'PM', 'PM1', 'PM2'];

const args = process.argv.slice(2);
const jsonOutput = hasFlag('--json');
const fromYear = Number.parseInt(getArgValue('--from-year', '2016'), 10);
const toYear = Number.parseInt(getArgValue('--to-year', String(new Date().getFullYear())), 10);
const targetCategories = getArgValue('--categories', defaultTargetCategories.join(','))
  .split(',')
  .map((category) => category.trim().toUpperCase())
  .filter(Boolean);
const includeLocalOnly = !hasFlag('--no-local-only');

function hasFlag(name) {
  return args.includes(name);
}

function getArgValue(name, defaultValue) {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return defaultValue;
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

function parseExamId(examId) {
  const match = examId.match(/^(?<category>[A-Z]{2})-(?<year>\d{4})-(?<term>Spring|Fall|Public|Sample|Oct)-(?<type>AM|AM1|AM2|PM|PM1|PM2)$/);
  if (!match?.groups) return null;
  return {
    category: match.groups.category,
    year: Number.parseInt(match.groups.year, 10),
    term: match.groups.term,
    type: match.groups.type,
  };
}

function isTarget(category, year) {
  return targetCategories.includes(category) && year >= fromYear && year <= toYear;
}

function loadExamListRecords() {
  if (!fs.existsSync(examListPath)) return new Map();
  const source = fs.readFileSync(examListPath, 'utf8');
  const records = new Map();
  const objectPattern = /\{[^{}]*category:\s*["'](?<category>[A-Z]{2})["'][^{}]*year:\s*["'](?<year>\d{4})["'][^{}]*term:\s*["'](?<term>[A-Za-z]+)["'][^{}]*type:\s*["'](?<type>AM1?|AM2|PM|PM1|PM2)["'][^{}]*url:\s*["'](?<url>https?:\/\/[^"']+)["'][^{}]*\}/g;
  for (const match of source.matchAll(objectPattern)) {
    const { category, year, term, type, url } = match.groups;
    const answerMatch = match[0].match(/answerUrl:\s*["'](?<answerUrl>https?:\/\/[^"']+)["']/);
    const examId = `${category}-${year}-${term}-${type}`;
    records.set(examId, {
      examId,
      category,
      year: Number.parseInt(year, 10),
      term,
      type,
      url,
      answerUrl: answerMatch?.groups?.answerUrl ?? null,
    });
  }
  return records;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'IpaLab official source coverage audit',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  }
  return response.text();
}

function extractHrefValues(html) {
  const hrefs = [];
  const hrefPattern = /href\s*=\s*["'](?<href>[^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    if (match.groups?.href) hrefs.push(match.groups.href);
  }
  return hrefs;
}

function resolveHref(href, sourceUrl) {
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return null;
  }
}

function termFromCode(code) {
  if (code === 'h') return 'Spring';
  if (code === 'a' || code === 'o') return 'Fall';
  return null;
}

function parseOfficialPdf(url, sourcePageUrl) {
  const urlObject = new URL(url);
  const fileName = decodeURIComponent(path.posix.basename(urlObject.pathname)).toLowerCase();
  const standard = fileName.match(/^(?<year>\d{4})(?:r\d{2}|h\d{2})(?<termCode>[aho])_(?<category>[a-z]{2})_(?<type>am2|am1|am|pm1|pm2|pm)_(?<kind>qs|ans|cmnt)\.pdf$/);
  if (standard?.groups) {
    const year = Number.parseInt(standard.groups.year, 10);
    const category = standard.groups.category.toUpperCase();
    const term = termFromCode(standard.groups.termCode);
    const type = standard.groups.type.toUpperCase();
    if (!term || !supportedTypes.includes(type) || !isTarget(category, year)) return null;
    return {
      examId: `${category}-${year}-${term}-${type}`,
      category,
      year,
      term,
      type,
      kind: standard.groups.kind,
      url,
      sourcePageUrl,
    };
  }

  const fePublic = fileName.match(/^(?<year>\d{4})r\d{2}_fe_kamoku_(?<subject>a|b)_(?<kind>qs|ans)\.pdf$/);
  if (fePublic?.groups) {
    const year = Number.parseInt(fePublic.groups.year, 10);
    const category = 'FE';
    const type = fePublic.groups.subject === 'a' ? 'AM' : 'PM';
    if (!isTarget(category, year)) return null;
    return {
      examId: `${category}-${year}-Public-${type}`,
      category,
      year,
      term: 'Public',
      type,
      kind: fePublic.groups.kind,
      url,
      sourcePageUrl,
    };
  }

  return null;
}

function mergeOfficialRecord(records, parsed) {
  if (!records.has(parsed.examId)) {
    records.set(parsed.examId, {
      examId: parsed.examId,
      category: parsed.category,
      year: parsed.year,
      term: parsed.term,
      type: parsed.type,
      questionUrl: null,
      answerUrl: null,
      commentUrl: null,
      sourcePages: new Set(),
    });
  }
  const record = records.get(parsed.examId);
  if (parsed.kind === 'qs') record.questionUrl ??= parsed.url;
  if (parsed.kind === 'ans') record.answerUrl ??= parsed.url;
  if (parsed.kind === 'cmnt') record.commentUrl ??= parsed.url;
  record.sourcePages.add(parsed.sourcePageUrl);
}

async function collectOfficialRecords() {
  const indexUrl = `${ipaBaseUrl}/shiken/mondai-kaiotu/index.html`;
  const indexHtml = await fetchText(indexUrl);
  const indexHrefs = extractHrefValues(indexHtml);
  const yearPages = new Set();

  for (const href of indexHrefs) {
    const resolved = resolveHref(href, indexUrl);
    if (!resolved) continue;
    const pageName = path.posix.basename(new URL(resolved).pathname);
    const match = pageName.match(/^(?<year>\d{4})(?:r\d{2}|h\d{2})\.html$/);
    if (!match?.groups) continue;
    const year = Number.parseInt(match.groups.year, 10);
    if (year >= fromYear && year <= toYear) yearPages.add(resolved);
  }

  if (targetCategories.includes('FE')) {
    yearPages.add(`${ipaBaseUrl}/shiken/mondai-kaiotu/sg_fe/koukai/index.html`);
  }

  const records = new Map();
  const fetchIssues = [];
  for (const pageUrl of [...yearPages].sort()) {
    let html;
    try {
      html = await fetchText(pageUrl);
    } catch (error) {
      fetchIssues.push({ severity: 'error', rule: 'OFFICIAL_SOURCE_PAGE_FETCH_FAILED', sourcePageUrl: pageUrl, detail: error.message });
      continue;
    }
    for (const href of extractHrefValues(html)) {
      if (!/\.pdf(?:$|[?#])/i.test(href)) continue;
      const resolved = resolveHref(href, pageUrl);
      if (!resolved) continue;
      const parsed = parseOfficialPdf(resolved, pageUrl);
      if (parsed) mergeOfficialRecord(records, parsed);
    }
  }

  return { records, sourcePageCount: yearPages.size, fetchIssues };
}

function readQuestionStatus(examId) {
  const examDir = path.join(questionsRoot, examId);
  const selectedFile = selectQuestionFile(examDir);
  if (!selectedFile) {
    return { exists: false, questionCount: 0, detail: 'questions_transformed.json or questions_raw.json is missing' };
  }
  try {
    const data = JSON.parse(fs.readFileSync(selectedFile, 'utf8'));
    const questions = normalizeQuestions(data);
    return { exists: questions.length > 0, questionCount: questions.length, detail: questions.length > 0 ? null : 'question data is empty' };
  } catch (error) {
    return { exists: false, questionCount: 0, detail: `question JSON parse failed: ${error.message}` };
  }
}

function readAnswerStatus(examId) {
  const answerFile = path.join(questionsRoot, examId, 'answers_raw.json');
  if (!fs.existsSync(answerFile)) return { exists: false, answerCount: 0, detail: 'answers_raw.json is missing' };
  try {
    const data = JSON.parse(fs.readFileSync(answerFile, 'utf8'));
    if (Array.isArray(data)) return { exists: data.length > 0, answerCount: data.length, detail: data.length > 0 ? null : 'answer data is empty' };
    if (data && typeof data === 'object' && Array.isArray(data.answers)) {
      return { exists: data.answers.length > 0, answerCount: data.answers.length, detail: data.answers.length > 0 ? null : 'answer data is empty' };
    }
    if (data && typeof data === 'object') {
      const count = Object.keys(data).length;
      return { exists: count > 0, answerCount: count, detail: count > 0 ? null : 'answer data is empty' };
    }
    return { exists: false, answerCount: 0, detail: 'unsupported answer data shape' };
  } catch (error) {
    return { exists: false, answerCount: 0, detail: `answer JSON parse failed: ${error.message}` };
  }
}

function issueToGap(issue) {
  if (issue.rule === 'OFFICIAL_EXAM_NOT_IN_EXAM_LIST') {
    return {
      examId: issue.examId,
      rule: issue.rule,
      asIs: 'Official question PDF exists, but exam-list.ts has no matching record',
      toBe: 'Add the official questionUrl and answerUrl when available to exam-list.ts',
    };
  }
  if (issue.rule === 'OFFICIAL_ANSWER_URL_NOT_IN_EXAM_LIST') {
    return {
      examId: issue.examId,
      rule: issue.rule,
      asIs: 'Official answer PDF exists, but exam-list.ts answerUrl is missing',
      toBe: 'Sync answerUrl to the official answer PDF',
    };
  }
  if (issue.rule === 'OFFICIAL_EXAM_MISSING_LOCAL_QUESTIONS') {
    return {
      examId: issue.examId,
      rule: issue.rule,
      asIs: 'Official question PDF exists, but local question JSON is missing or empty',
      toBe: `Create normalized question JSON with valid qNo values under packages/data/data/questions/${issue.examId}/`,
    };
  }
  if (issue.rule === 'OFFICIAL_ANSWER_MISSING_LOCAL') {
    return {
      examId: issue.examId,
      rule: issue.rule,
      asIs: 'Official answer PDF exists, but local answers_raw.json is missing or empty',
      toBe: `Create packages/data/data/questions/${issue.examId}/answers_raw.json from the official answer PDF`,
    };
  }
  return {
    examId: issue.examId ?? null,
    rule: issue.rule,
    asIs: issue.detail,
    toBe: 'Fix according to the audit rule',
  };
}

const issues = [];
let officialCollection;
try {
  officialCollection = await collectOfficialRecords();
} catch (error) {
  officialCollection = { records: new Map(), sourcePageCount: 0, fetchIssues: [{ severity: 'error', rule: 'OFFICIAL_INDEX_FETCH_FAILED', detail: error.message }] };
}

issues.push(...officialCollection.fetchIssues);
const officialRecords = [...officialCollection.records.values()]
  .filter((record) => record.questionUrl)
  .sort((a, b) => a.examId.localeCompare(b.examId));
const examListRecords = loadExamListRecords();
const localExamIds = listLocalExamIds();
const localSet = new Set(localExamIds);

const stats = {
  fromYear,
  toYear,
  targetCategories,
  officialSourcePageCount: officialCollection.sourcePageCount,
  officialQuestionExamCount: officialRecords.length,
  officialAnswerExamCount: officialRecords.filter((record) => record.answerUrl).length,
  examListTargetCount: 0,
  localTargetCount: 0,
  missingExamListCount: 0,
  missingLocalQuestionCount: 0,
  missingExamListAnswerUrlCount: 0,
  missingLocalAnswerCount: 0,
  localOnlyTargetCount: 0,
  blockingIssueCount: 0,
};

for (const record of examListRecords.values()) {
  if (isTarget(record.category, record.year)) stats.examListTargetCount += 1;
}
for (const examId of localExamIds) {
  const parsed = parseExamId(examId);
  if (parsed && isTarget(parsed.category, parsed.year)) stats.localTargetCount += 1;
}

for (const record of officialRecords) {
  const examListRecord = examListRecords.get(record.examId);
  const questionStatus = readQuestionStatus(record.examId);
  const answerStatus = readAnswerStatus(record.examId);

  if (!examListRecord) {
    stats.missingExamListCount += 1;
    issues.push({ severity: 'error', rule: 'OFFICIAL_EXAM_NOT_IN_EXAM_LIST', examId: record.examId, detail: record.questionUrl, official: serializeOfficialRecord(record) });
  } else if (record.answerUrl && !examListRecord.answerUrl) {
    stats.missingExamListAnswerUrlCount += 1;
    issues.push({ severity: 'error', rule: 'OFFICIAL_ANSWER_URL_NOT_IN_EXAM_LIST', examId: record.examId, detail: record.answerUrl, official: serializeOfficialRecord(record) });
  }

  if (!questionStatus.exists) {
    stats.missingLocalQuestionCount += 1;
    issues.push({ severity: 'error', rule: 'OFFICIAL_EXAM_MISSING_LOCAL_QUESTIONS', examId: record.examId, detail: questionStatus.detail, official: serializeOfficialRecord(record) });
  }

  if (record.answerUrl && !answerStatus.exists) {
    stats.missingLocalAnswerCount += 1;
    issues.push({ severity: 'error', rule: 'OFFICIAL_ANSWER_MISSING_LOCAL', examId: record.examId, detail: answerStatus.detail, official: serializeOfficialRecord(record) });
  }
}

if (includeLocalOnly) {
  const officialSet = new Set(officialRecords.map((record) => record.examId));
  for (const examId of localExamIds) {
    const parsed = parseExamId(examId);
    if (!parsed || !isTarget(parsed.category, parsed.year) || officialSet.has(examId)) continue;
    stats.localOnlyTargetCount += 1;
    issues.push({ severity: 'info', rule: 'LOCAL_TARGET_NOT_IN_OFFICIAL_SOURCE', examId, detail: 'local target data was not detected by the official PDF audit' });
  }
}

stats.blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;

const representativeGaps = issues
  .filter((issue) => issue.severity === 'error')
  .slice(0, 20)
  .map(issueToGap);

const result = {
  status: stats.blockingIssueCount === 0 ? 'OFFICIAL_SOURCE_COVERAGE_AUDIT_OK' : 'OFFICIAL_SOURCE_COVERAGE_AUDIT_FAILED',
  ...stats,
  representativeGaps,
  issues: issues.slice(0, 500),
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`status=${result.status}`);
  console.log(`targetCategories=${targetCategories.join(',')}`);
  console.log(`yearRange=${fromYear}-${toYear}`);
  console.log(`officialSourcePageCount=${stats.officialSourcePageCount}`);
  console.log(`officialQuestionExamCount=${stats.officialQuestionExamCount}`);
  console.log(`officialAnswerExamCount=${stats.officialAnswerExamCount}`);
  console.log(`examListTargetCount=${stats.examListTargetCount}`);
  console.log(`localTargetCount=${stats.localTargetCount}`);
  console.log(`blockingIssueCount=${stats.blockingIssueCount}`);
  console.log(`missingExamListCount=${stats.missingExamListCount}`);
  console.log(`missingLocalQuestionCount=${stats.missingLocalQuestionCount}`);
  console.log(`missingExamListAnswerUrlCount=${stats.missingExamListAnswerUrlCount}`);
  console.log(`missingLocalAnswerCount=${stats.missingLocalAnswerCount}`);
  for (const issue of issues.slice(0, 80)) {
    console.log(`${issue.severity}\t${issue.rule}\t${issue.examId ?? '-'}\t${issue.detail}`);
  }
}

process.exit(stats.blockingIssueCount === 0 ? 0 : 1);

function serializeOfficialRecord(record) {
  return {
    examId: record.examId,
    questionUrl: record.questionUrl,
    answerUrl: record.answerUrl,
    commentUrl: record.commentUrl,
    sourcePages: [...record.sourcePages].sort(),
  };
}