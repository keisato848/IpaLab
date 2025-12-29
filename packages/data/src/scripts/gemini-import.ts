import fs from 'fs/promises';
import path from 'path';

async function main() {
    const rawDir = path.resolve(__dirname, '../../data/questions');

    // Read all directories in questions/
    const dirs = await fs.readdir(rawDir);

    for (const examId of dirs) {
        // Skip if not a directory or hidden
        const examDir = path.join(rawDir, examId);
        const stats = await fs.stat(examDir);
        if (!stats.isDirectory()) continue;

        console.log(`Processing ${examId}...`);

        try {
            const questionsPath = path.join(examDir, 'questions_raw.json');
            const answersPath = path.join(examDir, 'answers_raw.json');

            // Check if both exist
            try {
                await fs.access(questionsPath);
                await fs.access(answersPath);
            } catch {
                console.log(`Missing raw files for ${examId}, skipping.`);
                continue;
            }


            const questionsRaw = await fs.readFile(questionsPath, 'utf-8');
            const answersRaw = await fs.readFile(answersPath, 'utf-8');

            const questions = JSON.parse(questionsRaw);
            const answers = JSON.parse(answersRaw);

            // Load Explanations (Optional)
            let explanations: any = {};
            try {
                const expContent = await fs.readFile(path.join(examDir, 'explanations_raw.json'), 'utf-8');
                explanations = JSON.parse(expContent);
            } catch (e) {
                // Ignore if missing, use empty
            }

            let importedCount = 0;
            for (const q of questions) {
                const qNo = q.qNo;
                const correctOption = answers[String(qNo)];

                // Retrieve explanation if available
                const explanation = explanations[String(qNo)] || "";

                // Construct final object
                const finalObj = {
                    id: `${examId}-${qNo}`,
                    qNo: qNo,
                    text: q.text,
                    options: q.options,
                    correctOption: correctOption || null,
                    explanation: explanation,
                    examId: examId,
                    category: q.category,
                    subCategory: q.subCategory
                };

                // Save as q{No}.json
                const outFile = path.join(examDir, `q${qNo}.json`);
                await fs.writeFile(outFile, JSON.stringify(finalObj, null, 2));
                importedCount++;
            }
            console.log(`Imported ${importedCount} questions for ${examId}`);

        } catch (e) {
            console.error(`Error importing ${examId}:`, e);
        }
    }
    console.log("Batch import completed.");
}

if (require.main === module) {
    main();
}
