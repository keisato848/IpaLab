#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { CosmosClient } from '@azure/cosmos';

const repoRoot = process.cwd();
const questionsRoot = path.join(repoRoot, 'packages', 'data', 'data', 'questions');
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const confirm = args.has('--confirm-production-write');
const jsonOutput = args.has('--json');
const databaseName = process.env.COSMOS_DB_NAME || 'pm-exam-dx-db';
const containerName = process.env.COSMOS_CONTAINER_NAME || 'Questions';
const connectionString = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
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

function loadLocalQuestions() {
  const byExam = new Map();
  const docs = [];
  const localIssues = [];
  const examIds = fs.readdirSync(questionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const examId of examIds) {
    const selectedFile = selectQuestionFile(path.join(questionsRoot, examId));
    if (!selectedFile) {
      localIssues.push(`${examId}: question file missing`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(selectedFile, 'utf8'));
    const questions = normalizeQuestions(data);
    const qNos = new Set();
    for (const question of questions) {
      const qNo = resolveQNo(question?.qNo);
      if (!qNo) {
        localIssues.push(`${examId}: invalid qNo`);
        continue;
      }
      qNos.add(qNo);
      docs.push({ ...question, id: question.id || `${examId}-${qNo}`, examId, qNo });
    }
    byExam.set(examId, qNos);
  }
  return { byExam, docs, localIssues };
}

async function loadCosmosQuestions(container) {
  const resources = [];
  const iterator = container.items.query('SELECT c.id, c.examId, c.qNo FROM c');
  while (iterator.hasMoreResults()) {
    const response = await iterator.fetchNext();
    if (response.resources) resources.push(...response.resources);
  }
  return resources;
}

if (!connectionString) fail('COSMOS_DB_CONNECTION is not set. The value is required but is never printed.');
if (apply && !confirm) fail('--apply requires --confirm-production-write. Run dry-run first and obtain user approval.');

const { byExam: localByExam, docs: localDocs, localIssues } = loadLocalQuestions();
if (localIssues.length > 0) {
  console.log(JSON.stringify({ status: 'LOCAL_DATA_BLOCKED', localIssueCount: localIssues.length, localIssues: localIssues.slice(0, 50) }, null, 2));
  process.exit(1);
}

const client = new CosmosClient(connectionString);
const container = client.database(databaseName).container(containerName);
const cosmosDocs = await loadCosmosQuestions(container);
const cosmosByExam = new Map();
for (const doc of cosmosDocs) {
  const examId = doc.examId || '(missing)';
  if (!cosmosByExam.has(examId)) cosmosByExam.set(examId, []);
  cosmosByExam.get(examId).push(doc);
}

const placeholderDeletes = [];
const missingExpected = [];
const unexpected = [];
const duplicate = [];
for (const [examId, docs] of cosmosByExam.entries()) {
  const localQNos = localByExam.get(examId);
  const seen = new Set();
  for (const doc of docs) {
    const qNo = resolveQNo(doc.qNo);
    if (qNo && seen.has(qNo)) duplicate.push(`${examId}:Q${qNo}`);
    if (qNo) seen.add(qNo);
    if (localQNos && qNo === 99 && !localQNos.has(99)) {
      placeholderDeletes.push({ id: doc.id, examId, qNo: 99 });
    } else if (localQNos && qNo && !localQNos.has(qNo)) {
      unexpected.push(`${examId}:Q${qNo}`);
    }
  }
  if (localQNos) {
    for (const qNo of localQNos) {
      if (!seen.has(qNo)) missingExpected.push(`${examId}:Q${qNo}`);
    }
  }
}

const localExamIds = [...localByExam.keys()];
const missingExamIds = localExamIds.filter((examId) => !cosmosByExam.has(examId));
const upserts = localDocs;

let applied = { deleted: 0, upserted: 0 };
if (apply) {
  for (const doc of placeholderDeletes) {
    await container.item(doc.id, doc.examId).delete();
    applied.deleted += 1;
  }
  for (const doc of upserts) {
    await container.items.upsert(doc);
    applied.upserted += 1;
  }
}

const result = {
  status: apply ? 'COSMOS_QUESTIONS_SYNC_APPLIED' : 'COSMOS_QUESTIONS_SYNC_DRY_RUN',
  databaseName,
  containerName,
  localExamCount: localByExam.size,
  localQuestionCount: localDocs.length,
  cosmosExamCount: cosmosByExam.size,
  cosmosQuestionCount: cosmosDocs.length,
  placeholderDeleteCount: placeholderDeletes.length,
  upsertCount: upserts.length,
  missingExpectedCount: missingExpected.length,
  unexpectedQNoCount: unexpected.length,
  duplicateQNoCount: duplicate.length,
  missingExamIdCount: missingExamIds.length,
  applied,
  placeholderDeletes: placeholderDeletes.slice(0, 50),
  missingExpected: missingExpected.slice(0, 50),
  unexpected: unexpected.slice(0, 50),
  duplicate: duplicate.slice(0, 50),
  missingExamIds: missingExamIds.slice(0, 50),
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`status=${result.status}`);
  console.log(`localExamCount=${result.localExamCount}`);
  console.log(`localQuestionCount=${result.localQuestionCount}`);
  console.log(`cosmosExamCount=${result.cosmosExamCount}`);
  console.log(`cosmosQuestionCount=${result.cosmosQuestionCount}`);
  console.log(`placeholderDeleteCount=${result.placeholderDeleteCount}`);
  console.log(`upsertCount=${result.upsertCount}`);
  console.log(`missingExpectedCount=${result.missingExpectedCount}`);
  console.log(`unexpectedQNoCount=${result.unexpectedQNoCount}`);
  console.log(`duplicateQNoCount=${result.duplicateQNoCount}`);
  console.log(`missingExamIdCount=${result.missingExamIdCount}`);
}
process.exit(0);