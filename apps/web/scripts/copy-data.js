const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../../packages/data/data/questions');
const destDir = path.resolve(__dirname, '../data/questions');

console.log(`[CopyData] Copying from ${srcDir} to ${destDir}...`);

async function copyDir(src, dest) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.promises.copyFile(srcPath, destPath);
        }
    }
}

copyDir(srcDir, destDir)
    .then(() => console.log('[CopyData] Success!'))
    .catch(err => {
        // Warn only, don't break build if local dev without data (though strict for prod)
        // Actually, for SSG in prod we need this.
        console.error('[CopyData] Failed:', err);
        process.exit(1);
    });
