import fs from 'fs';
import path from 'path';

const targetDirs = ['AP-2025-Fall-AM'];

targetDirs.forEach(dir => {
    const jsonPath = path.resolve(__dirname, '../../data/questions', dir, 'questions_raw.json');
    if (!fs.existsSync(jsonPath)) {
        console.log(`${dir}: File not found`);
        return;
    }
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(content);
    const questions = Array.isArray(data) ? data : data.questions;

    console.log(`\n--- ${dir} ---`);
    console.log(`Total Questions: ${questions.length}`);

    const missing = questions.filter((q: any) => !q.explanation || q.explanation.length < 20).length;
    console.log(`Missing Explanations (<20 chars): ${missing}`);

    // Check first 10
    questions.slice(0, 10).forEach((q: any) => {
        const len = q.explanation ? q.explanation.length : 0;
        console.log(`  Q${q.qNo}: Len ${len}, Start: ${q.explanation ? q.explanation.substring(0, 10) : 'NULL'}`);
    });
});
