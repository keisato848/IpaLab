import axios from 'axios';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

type CliOptions = {
    baseUrl: string;
    model: string;
    categories: Set<string>;
    examIds: Set<string>;
    limit?: number;
    overwrite: boolean;
    checkOnly: boolean;
    dryRun: boolean;
    help: boolean;
};



type AnswerTarget = {
    examId: string;
    category: string;
    pdfPath: string;
    outputPath: string;
};

const DEFAULT_CATEGORIES = ['AP', 'PM', 'SC', 'FE', 'NW', 'DB', 'AU', 'SM', 'SA', 'ES', 'ST'];
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'gemma4:31b';
const DEFAULT_DPI = 180;
const DEFAULT_MAX_PAGES = 8;
const DEFAULT_TIMEOUT_MS = 600000;

const OPTION_MAP: Record<string, string> = {
    'ア': 'a',
    'イ': 'b',
    'ウ': 'c',
    'エ': 'd',
    a: 'a',
    b: 'b',
    c: 'c',
    d: 'd',
    A: 'a',
    B: 'b',
    C: 'c',
    D: 'd',
};

async function loadPdfJs() {
    // pdfjs-dist v5 のメインビルドは DOM API (DOMMatrix 等) を要求するため
    // Node.js ポリフィル込みの legacy build を使用する
    // ts-ignore: .mjs サブパスの型解決は TypeScript が未対応
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const pdfjsLib = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as typeof import('pdfjs-dist');
    // Node.js 環境では fake worker を使用するためワーカーパスを動的解決して指定する
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsDistDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
    const workerPath = path.join(pdfjsDistDir, 'legacy', 'build', 'pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file:///${workerPath.replace(/\\/g, '/')}`;
    return pdfjsLib;
}

function splitList(value?: string): string[] {
    if (!value) return [];
    return value
        .split(/[\s,]+/)
        .map(item => item.trim())
        .filter(Boolean);
}

function parseNumber(value: string | undefined, fallback?: number): number | undefined {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid positive number: ${value}`);
    }
    return Math.floor(parsed);
}

function getArgValue(arg: string, name: string): string | undefined {
    const prefix = `--${name}=`;
    return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
}

function getEnvValue(primaryName: string, npmName: string, fallback?: string): string | undefined {
    return process.env[primaryName] ?? process.env[npmName] ?? fallback;
}

function isEnabled(value?: string): boolean {
    return value === '1' || value === 'true';
}

function parseArgs(argv: string[]): CliOptions {
    const envCategories = splitList(getEnvValue('OLLAMA_CATEGORIES', 'npm_config_categories'));
    const envExamIds = splitList(getEnvValue('OLLAMA_EXAM_IDS', 'npm_config_exam_ids'));
    const singleEnvExamId = getEnvValue('', 'npm_config_exam_id');
    if (singleEnvExamId) envExamIds.push(singleEnvExamId);

    const options: CliOptions = {
        baseUrl: getEnvValue('OLLAMA_BASE_URL', 'npm_config_base_url', DEFAULT_BASE_URL)!,
        model: getEnvValue('OLLAMA_MODEL', 'npm_config_model', DEFAULT_MODEL)!,
        categories: new Set((envCategories.length > 0 ? envCategories : DEFAULT_CATEGORIES).map(item => item.toUpperCase())),
        examIds: new Set(envExamIds),
        limit: parseNumber(getEnvValue('OLLAMA_EXTRACT_LIMIT', 'npm_config_limit')),
        overwrite: isEnabled(getEnvValue('OLLAMA_OVERWRITE', 'npm_config_overwrite')),
        checkOnly: isEnabled(process.env.npm_config_check),
        dryRun: isEnabled(process.env.npm_config_dry_run),
        help: false,
    };

    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--check') options.checkOnly = true;
        else if (arg === '--dry-run') options.dryRun = true;
        else if (arg === '--overwrite') options.overwrite = true;
        else if (getArgValue(arg, 'base-url')) options.baseUrl = getArgValue(arg, 'base-url')!;
        else if (getArgValue(arg, 'model')) options.model = getArgValue(arg, 'model')!;
        else if (getArgValue(arg, 'categories')) options.categories = new Set(splitList(getArgValue(arg, 'categories')).map(item => item.toUpperCase()));
        else if (getArgValue(arg, 'exam-id')) options.examIds.add(getArgValue(arg, 'exam-id')!);
        else if (getArgValue(arg, 'exam-ids')) splitList(getArgValue(arg, 'exam-ids')).forEach(item => options.examIds.add(item));
        else if (getArgValue(arg, 'limit')) options.limit = parseNumber(getArgValue(arg, 'limit'));
        else throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

function printHelp() {
    console.log(`Usage: npm run extract:answers:ollama -- [options]

Options:
  --check                  Check Ollama and PDF renderer availability.
  --dry-run                List target answer PDFs without running extraction.
  --exam-id=<examId>       Process a single exam, for example AP-2024-Spring-AM.
  --exam-ids=<list>        Process comma or space separated exam IDs.
  --categories=<list>      Process target categories. Default: ${DEFAULT_CATEGORIES.join(',')}.
  --limit=<n>              Process at most n missing answer files.
  --overwrite              Recreate answers_raw.json when it already exists.
  --model=<name>           Ollama model. Default: ${DEFAULT_MODEL}.
  --base-url=<url>         Ollama base URL. Default: ${DEFAULT_BASE_URL}.

Environment variables mirror the main options: OLLAMA_MODEL, OLLAMA_BASE_URL,
OLLAMA_CATEGORIES, OLLAMA_EXAM_IDS, OLLAMA_EXTRACT_LIMIT, OLLAMA_OVERWRITE,
OLLAMA_RENDER_DPI, OLLAMA_MAX_PAGES, OLLAMA_TIMEOUT_MS.`);
}

async function renderPdfPages(pdfPath: string, dpi: number, maxPages: number): Promise<Buffer[]> {
    const pdfjsLib = await loadPdfJs();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require('@napi-rs/canvas') as typeof import('@napi-rs/canvas');

    const data = await fs.readFile(pdfPath);
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const numPages = Math.min(pdf.numPages, maxPages);
    const scale = dpi / 72;
    const buffers: Buffer[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            canvas: canvas as unknown as HTMLCanvasElement,
            viewport,
        }).promise;

        buffers.push(canvas.toBuffer('image/png'));
    }

    return buffers;
}

async function extractPdfText(pdfPath: string, maxPages: number): Promise<string> {
    const pdfjsLib = await loadPdfJs();
    const data = await fs.readFile(pdfPath);
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const numPages = Math.min(pdf.numPages, maxPages);
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items
            .map((item: any) => String(item.str ?? '').trim())
            .filter(Boolean)
            .join(' ');
        pages.push(text);
    }

    return pages.join(' ');
}

async function ensureOllamaModel(baseUrl: string, model: string) {
    const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/tags`, { timeout: 10000 });
    const models = Array.isArray(response.data?.models) ? response.data.models : [];
    const modelNames = models.map((item: any) => String(item.name));

    if (!modelNames.includes(model)) {
        throw new Error(`Ollama model not found: ${model}. Available models: ${modelNames.join(', ') || '(none)'}`);
    }
}

async function collectTargets(rawDir: string, outDir: string, options: CliOptions): Promise<AnswerTarget[]> {
    const files = await fs.readdir(rawDir);
    const targets: AnswerTarget[] = [];

    for (const file of files) {
        if (!file.endsWith('-Ans.pdf')) continue;
        const examId = file.replace(/-Ans\.pdf$/, '');
        const category = examId.split('-')[0]?.toUpperCase() ?? '';

        if (!options.categories.has(category)) continue;
        if (options.examIds.size > 0 && !options.examIds.has(examId)) continue;

        const outputPath = path.join(outDir, examId, 'answers_raw.json');
        if (!options.overwrite && existsSync(outputPath)) continue;

        targets.push({
            examId,
            category,
            pdfPath: path.join(rawDir, file),
            outputPath,
        });
    }

    targets.sort((a, b) => b.examId.localeCompare(a.examId));
    return typeof options.limit === 'number' ? targets.slice(0, options.limit) : targets;
}

async function generateWithOllama(baseUrl: string, model: string, prompt: string, imageBuffers: Buffer[], timeoutMs: number): Promise<string> {
    const images = imageBuffers.map(buf => buf.toString('base64'));
    const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
        model,
        prompt,
        images,
        stream: false,
        format: 'json',
        options: {
            temperature: 0,
        },
    }, { timeout: timeoutMs });

    if (typeof response.data?.response !== 'string') {
        throw new Error('Ollama response did not include a text response.');
    }

    return response.data.response;
}

function extractJsonText(text: string): string {
    let jsonText = text.trim();
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return jsonText.slice(firstBrace, lastBrace + 1);
    }

    throw new Error('Ollama response did not contain a JSON object.');
}

function optionToLetter(value: unknown): string | undefined {
    const raw = String(value ?? '').trim();
    if (OPTION_MAP[raw]) return OPTION_MAP[raw];

    const firstOption = raw.match(/[アイウエa-dA-D]/)?.[0];
    return firstOption ? OPTION_MAP[firstOption] : undefined;
}

function normalizeMorningAnswers(parsed: Record<string, unknown>): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [rawKey, rawValue] of Object.entries(parsed)) {
        const qNo = String(rawKey).match(/\d+/)?.[0];
        const option = optionToLetter(rawValue);
        if (qNo && option) normalized[qNo] = option;
    }

    const ordered = Object.fromEntries(Object.entries(normalized).sort((a, b) => Number(a[0]) - Number(b[0])));
    if (Object.keys(ordered).length === 0) {
        throw new Error('No multiple-choice answers were detected in the JSON object.');
    }

    return ordered;
}

function parseMorningAnswersFromText(text: string): Record<string, string> {
    const normalized: Record<string, string> = {};
    const compactText = text.replace(/\s+/g, ' ').trim();
    const answerPattern = /問\s*(\d{1,3})\s*([アイウエa-dA-D])/g;

    for (const match of compactText.matchAll(answerPattern)) {
        const qNo = match[1];
        const option = optionToLetter(match[2]);
        if (qNo && option) normalized[qNo] = option;
    }

    return Object.fromEntries(Object.entries(normalized).sort((a, b) => Number(a[0]) - Number(b[0])));
}

function formatAnswerJson(examId: string, responseText: string): string {
    const parsed = JSON.parse(extractJsonText(responseText));

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Answer extraction output must be a JSON object.');
    }

    if (/-AM2?$/.test(examId)) {
        return JSON.stringify(normalizeMorningAnswers(parsed as Record<string, unknown>), null, 2);
    }

    if (Object.keys(parsed).length === 0) {
        throw new Error('Answer extraction output was an empty JSON object.');
    }

    return JSON.stringify(parsed, null, 2);
}

async function buildPrompt(examId: string): Promise<string> {
    const promptPath = path.resolve(__dirname, '../../../../docs/prompts/ollama_answer_ocr_prompt.md');
    const prompt = await fs.readFile(promptPath, 'utf8');
    return `${prompt}

Target exam ID: ${examId}

For this target, extract every answer row visible in the PDF. Output only valid JSON.`;
}

async function extractTarget(target: AnswerTarget, options: CliOptions) {
    const dpi = parseNumber(process.env.OLLAMA_RENDER_DPI, DEFAULT_DPI)!;
    const maxPages = parseNumber(process.env.OLLAMA_MAX_PAGES, DEFAULT_MAX_PAGES)!;
    const timeoutMs = parseNumber(process.env.OLLAMA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)!;

    console.log(`--- Processing ${target.examId} answers with ${options.model} ---`);
    if (/-AM2?$/.test(target.examId)) {
        const textAnswers = parseMorningAnswersFromText(await extractPdfText(target.pdfPath, maxPages));
        if (Object.keys(textAnswers).length > 0) {
            await fs.mkdir(path.dirname(target.outputPath), { recursive: true });
            await fs.writeFile(target.outputPath, JSON.stringify(textAnswers, null, 2));
            console.log(`Saved ${target.outputPath} (${Object.keys(textAnswers).length} answers from embedded PDF text)`);
            return;
        }
    }

    const imageBuffers = await renderPdfPages(target.pdfPath, dpi, maxPages);
    const prompt = await buildPrompt(target.examId);
    const responseText = await generateWithOllama(options.baseUrl, options.model, prompt, imageBuffers, timeoutMs);
    const json = formatAnswerJson(target.examId, responseText);
    await fs.mkdir(path.dirname(target.outputPath), { recursive: true });
    await fs.writeFile(target.outputPath, json);
    console.log(`Saved ${target.outputPath}`);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    const outDir = path.resolve(__dirname, '../../data/questions');
    const targets = await collectTargets(rawDir, outDir, options);

    if (options.dryRun) {
        console.log(`Target answer PDFs: ${targets.length}`);
        targets.slice(0, 50).forEach(target => console.log(target.examId));
        if (targets.length > 50) console.log(`... ${targets.length - 50} more`);
        return;
    }

    await ensureOllamaModel(options.baseUrl, options.model);
    console.log(`Ollama model available: ${options.model}`);

    if (options.checkOnly) {
        console.log('Ollama answer extraction prerequisites are available.');
        return;
    }

    if (targets.length === 0) {
        console.log('No answer PDFs require extraction.');
        return;
    }

    for (const target of targets) {
        await extractTarget(target, options);
    }
}

if (require.main === module) {
    main().catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Ollama answer extraction failed: ${message}`);
        process.exit(1);
    });
}