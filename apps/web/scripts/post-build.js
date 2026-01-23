const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nextDir = path.join(projectRoot, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const appInStandalone = path.join(standaloneDir, 'apps', 'web'); // Adjust based on your monorepo structure

console.log('[Post-Build] Starting static asset copy for Standalone...');

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    // 1. Copy .next/static -> .next/standalone/apps/web/.next/static
    const staticSrc = path.join(nextDir, 'static');
    const staticDest = path.join(appInStandalone, '.next', 'static');
    console.log(`[Post-Build] Copying static files: ${staticSrc} -> ${staticDest}`);
    copyDir(staticSrc, staticDest);

    // 2. Copy public -> .next/standalone/apps/web/public
    const publicSrc = path.join(projectRoot, 'public');
    const publicDest = path.join(appInStandalone, 'public');
    console.log(`[Post-Build] Copying public files: ${publicSrc} -> ${publicDest}`);
    copyDir(publicSrc, publicDest);

    console.log('[Post-Build] Copy complete.');
} catch (error) {
    console.error('[Post-Build] Error copying files:', error);
    process.exit(1);
}
