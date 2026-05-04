import fs from 'fs';
import path from 'path';
import { EXAM_LIST } from '../scraper/exam-list';

const PDF_HEADER = Buffer.from('%PDF-');

type AuditIssue = {
    examId: string;
    kind: 'question' | 'answer';
    fileName: string;
    reason: string;
};

function getArgValue(name: string): string | undefined {
    const prefix = `--${name}=`;
    const arg = process.argv.find(value => value.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
}

function parseCategories() {
    const rawCategories = getArgValue('categories') ||
        process.env.DOWNLOAD_CATEGORIES ||
        process.env.npm_config_categories ||
        process.env.NPM_CONFIG_CATEGORIES ||
        '';
    const categories = rawCategories
        .split(/[\s,]+/)
        .map(category => category.trim())
        .filter(Boolean);

    return categories.length > 0 ? new Set(categories) : null;
}

function isJsonOutput() {
    return process.argv.includes('--json');
}

function validatePdf(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return 'missing';
    }

    const file = fs.openSync(filePath, 'r');

    try {
        const stat = fs.fstatSync(file);
        const buffer = Buffer.alloc(Math.min(stat.size, 512));
        fs.readSync(file, buffer, 0, buffer.length, 0);
        const probeText = buffer.toString('utf8').toLowerCase();

        if (stat.size === 0) {
            return 'empty file';
        }

        if (
            buffer.length < PDF_HEADER.length ||
            !buffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)
        ) {
            return 'missing PDF header';
        }

        if (
            probeText.includes('<html') ||
            probeText.includes('<!doctype html') ||
            probeText.includes('<?xml')
        ) {
            return 'html/xml content detected';
        }

        return null;
    } finally {
        fs.closeSync(file);
    }
}

function createIssue(examId: string, kind: 'question' | 'answer', fileName: string, reason: string): AuditIssue {
    return { examId, kind, fileName, reason };
}

function groupByCategory(issues: AuditIssue[]) {
    return issues.reduce<Record<string, number>>((accumulator, issue) => {
        const category = issue.examId.split('-')[0];
        accumulator[category] = (accumulator[category] || 0) + 1;
        return accumulator;
    }, {});
}

function main() {
    const categoryFilter = parseCategories();
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    const targetExams = categoryFilter
        ? EXAM_LIST.filter(exam => categoryFilter.has(exam.category))
        : EXAM_LIST;
    const issues: AuditIssue[] = [];

    for (const exam of targetExams) {
        const examId = `${exam.category}-${exam.year}-${exam.term}-${exam.type}`;
        const questionFileName = `${examId}.pdf`;
        const answerFileName = `${examId}-Ans.pdf`;
        const questionResult = validatePdf(path.join(rawDir, questionFileName));
        const answerResult = validatePdf(path.join(rawDir, answerFileName));

        if (questionResult) {
            issues.push(createIssue(examId, 'question', questionFileName, questionResult));
        }
        if (answerResult) {
            issues.push(createIssue(examId, 'answer', answerFileName, answerResult));
        }
    }

    const missingQuestions = issues.filter(issue => issue.kind === 'question' && issue.reason === 'missing');
    const missingAnswers = issues.filter(issue => issue.kind === 'answer' && issue.reason === 'missing');
    const invalidPdfs = issues.filter(issue => issue.reason !== 'missing');
    const result = {
        status: issues.length === 0 ? 'RAW_PDF_AUDIT_OK' : 'RAW_PDF_AUDIT_FAILED',
        categoryFilter: categoryFilter ? Array.from(categoryFilter) : null,
        targetExamCount: targetExams.length,
        missingQuestionCount: missingQuestions.length,
        missingAnswerCount: missingAnswers.length,
        invalidPdfCount: invalidPdfs.length,
        missingQuestionsByCategory: groupByCategory(missingQuestions),
        missingAnswersByCategory: groupByCategory(missingAnswers),
        invalidPdfsByCategory: groupByCategory(invalidPdfs),
        issues,
    };

    if (isJsonOutput()) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`status=${result.status}`);
        console.log(`targetExamCount=${result.targetExamCount}`);
        console.log(`missingQuestionCount=${result.missingQuestionCount}`);
        console.log(`missingAnswerCount=${result.missingAnswerCount}`);
        console.log(`invalidPdfCount=${result.invalidPdfCount}`);
        for (const issue of issues) {
            console.log(`${issue.reason}\t${issue.kind}\t${issue.examId}\t${issue.fileName}`);
        }
    }

    if (issues.length > 0) {
        process.exitCode = 1;
    }
}

main();
