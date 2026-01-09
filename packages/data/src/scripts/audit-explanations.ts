
import fs from 'fs';
import path from 'path';

const questionsDir = path.resolve(__dirname, '../../data/questions');
const dirs = fs.readdirSync(questionsDir).filter(d => d.match(/^[A-Z]{2,4}-\d{4}/));

// Sort for consistent output
dirs.sort();

const summary: Record<string, { totalQuestions: number, missingExplanations: number, exams: string[] }> = {};

console.log(`Scanning ${dirs.length} exams...\n`);

for (const dir of dirs) {
    const category = dir.split('-')[0];
    if (!summary[category]) summary[category] = { totalQuestions: 0, missingExplanations: 0, exams: [] };

    const transformedPath = path.join(questionsDir, dir, 'questions_transformed.json');
    const rawPath = path.join(questionsDir, dir, 'questions_raw.json');
    // Prefer transformed if exists, else raw
    const targetPath = fs.existsSync(transformedPath) ? transformedPath : rawPath;

    if (!fs.existsSync(targetPath)) continue;

    try {
        const content = fs.readFileSync(targetPath, 'utf-8');
        const data = JSON.parse(content);
        const questions = Array.isArray(data) ? data : (data.questions || []);

        // Logic matches fill-missing-explanations.ts
        const missingCount = questions.filter((q: any) =>
            q.text && q.options && q.correctOption && (!q.explanation || q.explanation.length <= 20)
        ).length;

        summary[category].totalQuestions += questions.length;

        if (missingCount > 0) {
            summary[category].missingExplanations += missingCount;
            // Format: ExamName (Missing/Total)
            summary[category].exams.push(`${dir}: ${missingCount} / ${questions.length} missing`);
        }
    } catch (e: any) {
        console.error(`Error reading ${dir}: ${e.message}`);
    }
}

console.log('--- Explanation Audit Report ---');
Object.keys(summary).sort().forEach(cat => {
    const info = summary[cat];
    if (info.missingExplanations > 0) {
        console.log(`\n## ${cat} (Total Missing: ${info.missingExplanations})`);
        info.exams.forEach(e => console.log(` - ${e}`));
    } else {
        console.log(`\n## ${cat} (Complete)`);
    }
});
