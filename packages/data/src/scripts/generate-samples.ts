import fs from 'fs/promises';
import path from 'path';

async function main() {
    const questionsDir = path.resolve(__dirname, '../../data/questions');

    // Ensure questions dir exists
    try {
        await fs.access(questionsDir);
    } catch {
        console.error("Questions directory not found.");
        return;
    }

    const dirs = await fs.readdir(questionsDir);

    for (const dir of dirs) {
        const examDir = path.join(questionsDir, dir);
        const stats = await fs.stat(examDir);

        if (!stats.isDirectory()) continue;

        // Always regenerate consistency
        const q1JsonPath = path.join(examDir, 'q1.json');
        const q1MdPath = path.join(examDir, 'q1.md');

        // Delete old markdown if exists
        try {
            await fs.unlink(q1MdPath);
            console.log(`[CLEANUP] Deleted old q1.md in ${dir}`);
        } catch { } // Ignore if missing

        // Generate JSON
        console.log(`[GENERATE] Creating q1.json for ${dir}`);

        const sampleJson = {
            id: `${dir}-1`,
            qNo: 1,
            examId: dir,
            category: "テクノロジ",
            subCategory: "セキュリティ",
            text: "【サンプル問題】\n202X年春期 午後問1に関連するサンプル問題です。\n情報セキュリティの要素、機密性、完全性、可用性のうち、可用性を確保するための対策として適切なものはどれか。",
            options: [
                { id: "a", text: "デジタル署名を付与する" },
                { id: "b", text: "ハードウェアを二重化する" },
                { id: "c", text: "生体認証を導入する" },
                { id: "d", text: "データを暗号化する" }
            ],
            correctOption: "b",
            explanation: "正解は「イ」です。\n可用性（Availability）とは、システムがいつでも利用可能であることを意味します。ハードウェアの二重化（冗長化）は、障害発生時でもサービスを継続させるための対策です。"
        };

        await fs.writeFile(q1JsonPath, JSON.stringify(sampleJson, null, 2));
    }
    console.log("Sample generation completed.");
}

if (require.main === module) {
    main();
}
