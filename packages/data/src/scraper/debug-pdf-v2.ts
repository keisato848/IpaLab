import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';

async function checkFile(fileName: string) {
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    const filePath = path.join(rawDir, fileName);

    console.log(`Checking ${fileName}...`);
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);

        console.log(`Length: ${data.text.length}`);
        if (data.text.length > 0) {
            console.log(`Preview (first 200 chars non-empty):`);
            console.log(data.text.replace(/\s+/g, ' ').substring(0, 200));

            // Check for keywords
            const hasQ1 = data.text.includes('問1') || data.text.includes('問１');
            console.log(`Contains '問1': ${hasQ1}`);
        } else {
            console.log("Text is empty.");
        }

    } catch (e) {
        console.error(`Error: ${e}`);
    }
    console.log("--------------------------------------------------");
}

async function main() {
    await checkFile('AP-2024-Fall-AM.pdf');
    await checkFile('AP-2019-Spring-AM.pdf');
}

if (require.main === module) {
    main();
}
