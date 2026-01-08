
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data/questions');

function main() {
    console.log("Starting Comprehensive Exam Data Audit...\n");
    console.log("| Exam ID | Q Count | Missing Expl | Missing Ans | Has Backups | Has AnsFile |");
    console.log("|---|---|---|---|---|---|");

    const dirs = fs.readdirSync(DATA_DIR);
    dirs.sort().reverse();

    let totalMissingExpl = 0;

    for (const dir of dirs) {
        if (!fs.statSync(path.join(DATA_DIR, dir)).isDirectory()) continue;

        const examDir = path.join(DATA_DIR, dir);

        // Check files
        const transformedPath = path.join(examDir, 'questions_transformed.json');
        const rawPath = path.join(examDir, 'questions_raw.json');
        const answersPath = path.join(examDir, 'answers_raw.json');
        const backupFiles = fs.readdirSync(examDir).filter(f => f.match(/^q\d+\.json$/));

        let data = [];
        let source = "None";

        if (fs.existsSync(transformedPath)) {
            try {
                const content = JSON.parse(fs.readFileSync(transformedPath, 'utf-8'));
                data = Array.isArray(content) ? content : (content.questions || []);
                source = "Transformed";
            } catch (e) { }
        } else if (fs.existsSync(rawPath)) {
            try {
                const content = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
                data = Array.isArray(content) ? content : (content.questions || []);
                source = "Raw";
            } catch (e) { }
        }

        if (data.length === 0) {
            console.log(`| ${dir} | 0 | - | - | ${backupFiles.length > 0} | ${fs.existsSync(answersPath)} |`);
            continue;
        }

        let missingExpl = 0;
        let missingAns = 0;

        data.forEach((q: any) => {
            if (!q.explanation || q.explanation.length < 10) missingExpl++;
            if (!q.correctOption) missingAns++;
        });

        if (missingExpl > 0 || missingAns > 0) {
            console.log(`| ${dir} | ${data.length} | ${missingExpl} | ${missingAns} | ${backupFiles.length > 0 ? 'YES (' + backupFiles.length + ')' : 'NO'} | ${fs.existsSync(answersPath) ? 'YES' : 'NO'} |`);
            totalMissingExpl += missingExpl;
        }
    }
    console.log(`\nTotal Missing Explanations: ${totalMissingExpl}`);
}

main();
