import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';

async function main() {
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    // Using a recent file
    const filePath = path.join(rawDir, 'AP-2024-Fall-AM.pdf');

    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);

        console.log("--- PDF TEXT START ---");
        // Print first 3000 chars to check header and first few questions
        console.log(data.text.substring(0, 3000));
        console.log("--- PDF TEXT END ---");

    } catch (e) {
        console.error(e);
    }
}

if (require.main === module) {
    main();
}
