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
    outputFile: string;
    chunkPages: number;
    chunkOverlap: number;
    pageRange?: { start: number; end: number };
    renderDpi: number;
    timeoutMs: number;
    numCtx?: number;
    numPredict?: number;
    textOnly: boolean;
    withExplanations: boolean;
    splitColumns: boolean;
    allowPartial: boolean;
    debugDir?: string;
    help: boolean;
};

type QuestionTarget = {
    examId: string;
    category: string;
    pdfPath: string;
    outputPath: string;
    answersPath: string;
};

type PageArtifact = {
    pageNumber: number;
    label: string;
    image: Buffer | null;
    text: string;
};

type ChunkSpec = {
    pages: number[];
    column?: 'left' | 'right';
};

type MorningQuestion = {
    qNo: number;
    text: string;
    options: Array<{ id: string; text: string }>;
    correctOption: string | null;
    explanation: string;
};

const DEFAULT_CATEGORIES = ['AP', 'FE', 'PM', 'SC', 'NW', 'DB', 'AU', 'SM', 'SA', 'ES', 'ST'];
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'gemma4:31b';
const DEFAULT_DPI = 150;
const DEFAULT_TIMEOUT_MS = 900000;
const DEFAULT_CHUNK_PAGES = 2;
const DEFAULT_CHUNK_OVERLAP = 1;
const DEFAULT_OUTPUT_FILE = 'questions_raw.json';

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

function splitList(value?: string): string[] {
    if (!value) return [];
    return value.split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
}

function parseNumber(value: string | undefined, fallback?: number): number | undefined {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid positive number: ${value}`);
    }
    return Math.floor(parsed);
}

function parseNonNegativeNumber(value: string | undefined, fallback?: number): number | undefined {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Invalid non-negative number: ${value}`);
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

function parsePageRange(value?: string): { start: number; end: number } | undefined {
    if (!value) return undefined;
    const match = value.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error(`Invalid page range: ${value}`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (end < start) throw new Error(`Invalid page range: ${value}`);
    return { start, end };
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
        outputFile: getEnvValue('OLLAMA_OUTPUT_FILE', 'npm_config_output', DEFAULT_OUTPUT_FILE)!,
        chunkPages: parseNumber(getEnvValue('OLLAMA_CHUNK_PAGES', 'npm_config_chunk_pages'), DEFAULT_CHUNK_PAGES)!,
        chunkOverlap: parseNonNegativeNumber(getEnvValue('OLLAMA_CHUNK_OVERLAP', 'npm_config_chunk_overlap'), DEFAULT_CHUNK_OVERLAP)!,
        pageRange: parsePageRange(getEnvValue('OLLAMA_PAGE_RANGE', 'npm_config_page_range')),
        renderDpi: parseNumber(getEnvValue('OLLAMA_RENDER_DPI', 'npm_config_render_dpi'), DEFAULT_DPI)!,
        timeoutMs: parseNumber(getEnvValue('OLLAMA_TIMEOUT_MS', 'npm_config_timeout_ms'), DEFAULT_TIMEOUT_MS)!,
        numCtx: parseNumber(getEnvValue('OLLAMA_NUM_CTX', 'npm_config_num_ctx')),
        numPredict: parseNumber(getEnvValue('OLLAMA_NUM_PREDICT', 'npm_config_num_predict')),
        textOnly: isEnabled(getEnvValue('OLLAMA_TEXT_ONLY', 'npm_config_text_only')),
        withExplanations: isEnabled(getEnvValue('OLLAMA_WITH_EXPLANATIONS', 'npm_config_with_explanations')),
        splitColumns: isEnabled(getEnvValue('OLLAMA_SPLIT_COLUMNS', 'npm_config_split_columns')),
        allowPartial: isEnabled(getEnvValue('OLLAMA_ALLOW_PARTIAL', 'npm_config_allow_partial')),
        debugDir: getEnvValue('OLLAMA_DEBUG_DIR', 'npm_config_debug_dir'),
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
        else if (getArgValue(arg, 'output')) options.outputFile = getArgValue(arg, 'output')!;
        else if (getArgValue(arg, 'chunk-pages')) options.chunkPages = parseNumber(getArgValue(arg, 'chunk-pages'))!;
        else if (getArgValue(arg, 'chunk-overlap')) options.chunkOverlap = parseNonNegativeNumber(getArgValue(arg, 'chunk-overlap'))!;
        else if (getArgValue(arg, 'page-range')) options.pageRange = parsePageRange(getArgValue(arg, 'page-range'));
        else if (getArgValue(arg, 'render-dpi')) options.renderDpi = parseNumber(getArgValue(arg, 'render-dpi'))!;
        else if (getArgValue(arg, 'timeout-ms')) options.timeoutMs = parseNumber(getArgValue(arg, 'timeout-ms'))!;
        else if (getArgValue(arg, 'num-ctx')) options.numCtx = parseNumber(getArgValue(arg, 'num-ctx'));
        else if (getArgValue(arg, 'num-predict')) options.numPredict = parseNumber(getArgValue(arg, 'num-predict'));
        else if (arg === '--text-only') options.textOnly = true;
        else if (arg === '--with-explanations') options.withExplanations = true;
        else if (arg === '--split-columns') options.splitColumns = true;
        else if (arg === '--allow-partial') options.allowPartial = true;
        else if (getArgValue(arg, 'debug-dir')) options.debugDir = getArgValue(arg, 'debug-dir')!;
        else throw new Error(`Unknown argument: ${arg}`);
    }

    if (options.chunkOverlap >= options.chunkPages) {
        throw new Error('--chunk-overlap must be smaller than --chunk-pages');
    }

    return options;
}

function printHelp() {
    console.log(`Usage: npm run extract:questions:ollama -- [options]

Options:
  --check                  Check Ollama and PDF renderer availability.
  --dry-run                List target question PDFs without running extraction.
  --exam-id=<examId>       Process a single exam, for example DB-2016-Spring-AM2.
  --exam-ids=<list>        Process comma or space separated exam IDs.
  --categories=<list>      Process target categories. Default: ${DEFAULT_CATEGORIES.join(',')}.
  --limit=<n>              Process at most n missing question files.
  --overwrite              Recreate output file when it already exists.
  --output=<file>          Output file name inside each exam directory. Default: ${DEFAULT_OUTPUT_FILE}.
  --page-range=<a-b>       Restrict PDF pages for probing, for example 1-2.
  --chunk-pages=<n>        Number of pages per Ollama request. Default: ${DEFAULT_CHUNK_PAGES}.
  --chunk-overlap=<n>      Overlap pages between chunks. Default: ${DEFAULT_CHUNK_OVERLAP}.
  --render-dpi=<n>         PDF render DPI. Default: ${DEFAULT_DPI}.
  --timeout-ms=<n>         Ollama request timeout. Default: ${DEFAULT_TIMEOUT_MS}.
    --text-only              Send embedded PDF text only, without page images.
    --with-explanations      Generate explanations in the same pass. Default is empty explanation for speed.
    --split-columns          Render each page as left/right column images and process them separately.
    --allow-partial          Continue when a page chunk fails and save successfully extracted questions.
    --debug-dir=<path>       Save raw Ollama responses for prompt debugging.
  --model=<name>           Ollama model. Default: ${DEFAULT_MODEL}.
  --base-url=<url>         Ollama base URL. Default: ${DEFAULT_BASE_URL}.

This script targets AM/AM2 multiple-choice question PDFs. Use Ollama Gemma4:31B for AI extraction.`);
}

async function loadPdfJs() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const pdfjsLib = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as typeof import('pdfjs-dist');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsDistDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
    const workerPath = path.join(pdfjsDistDir, 'legacy', 'build', 'pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file:///${workerPath.replace(/\\/g, '/')}`;
    return pdfjsLib;
}

async function openPdf(pdfPath: string) {
    const pdfjsLib = await loadPdfJs();
    const data = await fs.readFile(pdfPath);
    return pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
}

async function renderPageArtifacts(
    pdfPath: string,
    pageNumbers: number[],
    dpi: number,
    renderImages: boolean,
    column?: 'left' | 'right',
): Promise<PageArtifact[]> {
    const canvasLib = renderImages
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        ? require('@napi-rs/canvas') as typeof import('@napi-rs/canvas')
        : null;
    const pdf = await openPdf(pdfPath);
    const scale = dpi / 72;
    const artifacts: PageArtifact[] = [];

    for (const pageNumber of pageNumbers) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items
            .map((item: any) => String(item.str ?? '').trim())
            .filter(Boolean)
            .join(' ');
        let image: Buffer | null = null;

        if (canvasLib) {
            const viewport = page.getViewport({ scale });
            const canvas = canvasLib.createCanvas(Math.round(viewport.width), Math.round(viewport.height));
            const context = canvas.getContext('2d');
            await page.render({
                canvasContext: context as unknown as CanvasRenderingContext2D,
                canvas: canvas as unknown as HTMLCanvasElement,
                viewport,
            }).promise;

            if (column) {
                const overlap = Math.round(canvas.width * 0.06);
                const middle = Math.round(canvas.width / 2);
                const sourceX = column === 'left' ? 0 : Math.max(0, middle - overlap);
                const sourceWidth = column === 'left'
                    ? Math.min(canvas.width, middle + overlap)
                    : canvas.width - sourceX;
                const cropped = canvasLib.createCanvas(sourceWidth, canvas.height);
                const croppedContext = cropped.getContext('2d');
                croppedContext.drawImage(canvas, sourceX, 0, sourceWidth, canvas.height, 0, 0, sourceWidth, canvas.height);
                image = cropped.toBuffer('image/png');
            } else {
                image = canvas.toBuffer('image/png');
            }
        }

        artifacts.push({ pageNumber, label: column ? `${pageNumber}-${column}` : String(pageNumber), image, text });
    }

    return artifacts;
}

async function getPageCount(pdfPath: string): Promise<number> {
    const pdf = await openPdf(pdfPath);
    return pdf.numPages;
}

async function ensureOllamaModel(baseUrl: string, model: string) {
    const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/tags`, { timeout: 10000 });
    const models = Array.isArray(response.data?.models) ? response.data.models : [];
    const modelNames = models.map((item: any) => String(item.name));

    if (!modelNames.includes(model)) {
        throw new Error(`Ollama model not found: ${model}. Available models: ${modelNames.join(', ') || '(none)'}`);
    }
}

function isMorningExam(examId: string): boolean {
    return /-AM2?$/.test(examId);
}

async function collectTargets(rawDir: string, outDir: string, options: CliOptions): Promise<QuestionTarget[]> {
    const files = await fs.readdir(rawDir);
    const targets: QuestionTarget[] = [];

    for (const file of files) {
        if (!file.endsWith('.pdf') || file.endsWith('-Ans.pdf')) continue;
        const examId = file.replace(/\.pdf$/, '');
        const category = examId.split('-')[0]?.toUpperCase() ?? '';

        if (!isMorningExam(examId)) continue;
        if (!options.categories.has(category)) continue;
        if (options.examIds.size > 0 && !options.examIds.has(examId)) continue;

        const outputPath = path.join(outDir, examId, options.outputFile);
        if (!options.overwrite && existsSync(outputPath)) continue;

        targets.push({
            examId,
            category,
            pdfPath: path.join(rawDir, file),
            outputPath,
            answersPath: path.join(outDir, examId, 'answers_raw.json'),
        });
    }

    targets.sort((a, b) => b.examId.localeCompare(a.examId));
    return typeof options.limit === 'number' ? targets.slice(0, options.limit) : targets;
}

async function readAnswerMap(answersPath: string): Promise<Record<string, string>> {
    try {
        const raw = JSON.parse(await fs.readFile(answersPath, 'utf8'));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        return Object.fromEntries(
            Object.entries(raw)
                .map(([key, value]) => [String(key), optionToLetter(value) ?? String(value ?? '')])
                .filter(([, value]) => value),
        );
    } catch {
        return {};
    }
}

function buildPageChunks(pageCount: number, options: CliOptions): number[][] {
    const firstPage = options.pageRange?.start ?? 1;
    const lastPage = Math.min(options.pageRange?.end ?? pageCount, pageCount);
    const chunks: number[][] = [];
    const step = options.chunkPages - options.chunkOverlap;

    for (let start = firstPage; start <= lastPage; start += step) {
        const end = Math.min(start + options.chunkPages - 1, lastPage);
        const chunk: number[] = [];
        for (let page = start; page <= end; page++) chunk.push(page);
        chunks.push(chunk);
        if (end === lastPage) break;
    }

    return chunks;
}

function buildChunkSpecs(pageCount: number, options: CliOptions): ChunkSpec[] {
    const pageChunks = buildPageChunks(pageCount, options);
    if (!options.splitColumns) return pageChunks.map(pages => ({ pages }));

    const specs: ChunkSpec[] = [];
    for (const pages of pageChunks) {
        for (const page of pages) {
            specs.push({ pages: [page], column: 'left' });
            specs.push({ pages: [page], column: 'right' });
        }
    }
    return specs;
}

async function buildPrompt(examId: string, artifacts: PageArtifact[], answerMap: Record<string, string>, withExplanations: boolean): Promise<string> {
    const promptPath = path.resolve(__dirname, '../../../../docs/prompts/ollama_am_ocr_prompt.md');
    const prompt = await fs.readFile(promptPath, 'utf8');
    const pageText = artifacts
        .map(page => `### Page ${page.pageNumber}\n${page.text || '(no embedded PDF text)'}`)
        .join('\n\n');

    return `${prompt}

Target exam ID: ${examId}
Page chunk: ${artifacts.map(page => page.label).join(', ')}
Input mode: ${artifacts.some(page => page.image) ? 'page images plus embedded PDF text' : 'embedded PDF text only'}
Need explanations: ${withExplanations ? 'true' : 'false'}

Known answer key JSON:
${JSON.stringify(answerMap, null, 2)}

Embedded PDF text assist:
${pageText}

Return only JSON for complete questions visible in this chunk.`;
}

async function generateWithOllama(options: CliOptions, prompt: string, artifacts: PageArtifact[]): Promise<string> {
    const generationOptions: Record<string, number> = { temperature: 0 };
    if (options.numCtx) generationOptions.num_ctx = options.numCtx;
    if (options.numPredict) generationOptions.num_predict = options.numPredict;
    const images = artifacts.map(page => page.image).filter((image): image is Buffer => Boolean(image));

    const payload: Record<string, unknown> = {
        model: options.model,
        prompt,
        stream: false,
        format: 'json',
        options: generationOptions,
    };

    if (images.length > 0) {
        payload.images = images.map(image => image.toString('base64'));
    }

    const response = await axios.post(`${options.baseUrl.replace(/\/$/, '')}/api/generate`, payload, { timeout: options.timeoutMs });

    if (typeof response.data?.response !== 'string') {
        throw new Error('Ollama response did not include a text response.');
    }

    return response.data.response;
}

function extractJsonText(text: string): string {
    let jsonText = text.trim();
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    const firstObject = jsonText.indexOf('{');
    const lastObject = jsonText.lastIndexOf('}');
    if (firstObject >= 0 && lastObject > firstObject) return jsonText.slice(firstObject, lastObject + 1);
    const firstArray = jsonText.indexOf('[');
    const lastArray = jsonText.lastIndexOf(']');
    if (firstArray >= 0 && lastArray > firstArray) return jsonText.slice(firstArray, lastArray + 1);
    throw new Error('Ollama response did not contain JSON.');
}

function optionToLetter(value: unknown): string | undefined {
    const raw = String(value ?? '').trim();
    if (OPTION_MAP[raw]) return OPTION_MAP[raw];
    const firstOption = raw.match(/[アイウエa-dA-D]/)?.[0];
    return firstOption ? OPTION_MAP[firstOption] : undefined;
}

function normalizeOptions(value: unknown): Array<{ id: string; text: string }> | null {
    if (!Array.isArray(value)) return null;
    const options = value
        .map(item => {
            if (!item || typeof item !== 'object') return null;
            const id = optionToLetter((item as any).id ?? (item as any).label ?? (item as any).option);
            const text = String((item as any).text ?? (item as any).value ?? '').trim();
            return id && text ? { id, text } : null;
        })
        .filter((item): item is { id: string; text: string } => Boolean(item));

    const deduped = new Map<string, { id: string; text: string }>();
    for (const option of options) deduped.set(option.id, option);
    const ordered = ['a', 'b', 'c', 'd'].map(id => deduped.get(id)).filter(Boolean) as Array<{ id: string; text: string }>;
    return ordered.length === 4 ? ordered : null;
}

function parseQuestions(responseText: string, answerMap: Record<string, string>, withExplanations: boolean): MorningQuestion[] {
    const parsed = JSON.parse(extractJsonText(responseText));
    const source = Array.isArray(parsed) ? parsed : parsed?.questions;
    if (!Array.isArray(source)) throw new Error('Question extraction output must include a questions array.');

    const questions: MorningQuestion[] = [];
    for (const rawQuestion of source) {
        if (!rawQuestion || typeof rawQuestion !== 'object') continue;
        const qNo = Number(String((rawQuestion as any).qNo ?? '').match(/\d+/)?.[0]);
        const text = String((rawQuestion as any).text ?? '').trim();
        const options = normalizeOptions((rawQuestion as any).options ?? (rawQuestion as any).choices);
        if (!Number.isFinite(qNo) || qNo <= 0 || !text || !options) continue;

        const correctOption = optionToLetter((rawQuestion as any).correctOption) ?? optionToLetter(answerMap[String(qNo)]) ?? null;
        const explanation = withExplanations ? String((rawQuestion as any).explanation ?? '').trim() : '';
        questions.push({ qNo, text, options, correctOption, explanation });
    }

    return questions;
}

function qualityScore(question: MorningQuestion): number {
    const optionsLength = question.options.reduce((sum, option) => sum + option.text.length, 0);
    const diagramScore = /```mermaid|\[図:|\|.+\|/.test(question.text) ? 40 : 0;
    return question.text.length + optionsLength * 2 + question.explanation.length + diagramScore + (question.correctOption ? 20 : 0);
}

function mergeQuestions(existing: Map<number, MorningQuestion>, incoming: MorningQuestion[]) {
    for (const question of incoming) {
        const current = existing.get(question.qNo);
        if (!current || qualityScore(question) > qualityScore(current)) {
            existing.set(question.qNo, question);
        }
    }
}

function safeFilePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function writeDebugResponse(options: CliOptions, target: QuestionTarget, chunkLabel: string, responseText: string) {
    if (!options.debugDir) return;
    const debugDir = path.resolve(process.cwd(), options.debugDir);
    await fs.mkdir(debugDir, { recursive: true });
    const fileName = `${safeFilePart(target.examId)}_${safeFilePart(chunkLabel)}.json.txt`;
    await fs.writeFile(path.join(debugDir, fileName), responseText);
}

async function extractTarget(target: QuestionTarget, options: CliOptions) {
    const pageCount = await getPageCount(target.pdfPath);
    const chunks = buildChunkSpecs(pageCount, options);
    const answerMap = await readAnswerMap(target.answersPath);
    const merged = new Map<number, MorningQuestion>();

    console.log(`--- Processing ${target.examId} questions with ${options.model} (${pageCount} pages, ${chunks.length} chunks) ---`);

    for (const chunk of chunks) {
        const chunkLabel = `${chunk.pages.join(', ')}${chunk.column ? ` ${chunk.column}` : ''}`;
        console.log(`Chunk pages: ${chunkLabel}`);
        try {
            const artifacts = await renderPageArtifacts(target.pdfPath, chunk.pages, options.renderDpi, !options.textOnly, chunk.column);
            const prompt = await buildPrompt(target.examId, artifacts, answerMap, options.withExplanations);
            const responseText = await generateWithOllama(options, prompt, artifacts);
            await writeDebugResponse(options, target, chunkLabel, responseText);
            const questions = parseQuestions(responseText, answerMap, options.withExplanations);
            mergeQuestions(merged, questions);
            console.log(`Extracted ${questions.length} questions from pages ${chunkLabel} (merged: ${merged.size})`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!options.allowPartial) throw error;
            console.warn(`[WARN] Skipped chunk ${chunkLabel}: ${message}`);
        }
    }

    const output = [...merged.values()].sort((a, b) => a.qNo - b.qNo);
    if (output.length === 0) throw new Error(`No valid questions were extracted for ${target.examId}.`);

    await fs.mkdir(path.dirname(target.outputPath), { recursive: true });
    await fs.writeFile(target.outputPath, JSON.stringify(output, null, 2));
    console.log(`Saved ${target.outputPath} (${output.length} questions)`);
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
        console.log(`Target morning question PDFs: ${targets.length}`);
        targets.slice(0, 50).forEach(target => console.log(`${target.examId} -> ${path.basename(target.outputPath)}`));
        if (targets.length > 50) console.log(`... ${targets.length - 50} more`);
        return;
    }

    await ensureOllamaModel(options.baseUrl, options.model);
    console.log(`Ollama model available: ${options.model}`);

    if (options.checkOnly) {
        console.log('Ollama question extraction prerequisites are available.');
        return;
    }

    if (targets.length === 0) {
        console.log('No morning question PDFs require extraction.');
        return;
    }

    for (const target of targets) {
        await extractTarget(target, options);
    }
}

if (require.main === module) {
    main().catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Ollama question extraction failed: ${message}`);
        process.exit(1);
    });
}