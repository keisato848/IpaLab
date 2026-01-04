
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';

const downloadsDir = path.resolve(__dirname, '../../data/downloads/answers');
const ipPdf = path.join(downloadsDir, 'FE-2024-Public-AM_ans.pdf');

async function main() {
    if (!fs.existsSync(ipPdf)) {
        console.log("PDF not found:", ipPdf);
        // Fallback to finding it in raw_pdfs
        const rawPdf = path.resolve(__dirname, '../../data/raw_pdfs/FE-2024-Public-AM-Ans.pdf');
        if (fs.existsSync(rawPdf)) {
            console.log("Found in raw_pdfs:", rawPdf);
            const buffer = fs.readFileSync(rawPdf);
            const data = await pdf(buffer);
            console.log("Preview of FE PDF Text:");
            console.log(data.text.substring(0, 2000));
            return;
        }
        return;
    }
    const buffer = fs.readFileSync(ipPdf);
    const data = await pdf(buffer);
    console.log("Preview of FE PDF Text:");
    console.log(data.text.substring(0, 2000));
}

main();
