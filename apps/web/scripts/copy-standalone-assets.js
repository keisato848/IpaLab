/**
 * Next.js standalone モードのビルド後処理スクリプト
 * 
 * standalone 出力には static フォルダと public フォルダが含まれないため、
 * 手動でコピーする必要があります。
 * 
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files
 */
const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '..');
const standaloneDir = path.join(webDir, '.next', 'standalone');
const standaloneWebDir = path.join(standaloneDir, 'apps', 'web');

// ソースパス
const publicSrc = path.join(webDir, 'public');
const staticSrc = path.join(webDir, '.next', 'static');

// 宛先パス（monorepo 構造: .next/standalone/apps/web/）
const publicDest = path.join(standaloneWebDir, 'public');
const staticDest = path.join(standaloneWebDir, '.next', 'static');

console.log('📁 Copying standalone assets...');
console.log('   Standalone dir:', standaloneDir);

// standalone ディレクトリの存在確認
if (!fs.existsSync(standaloneDir)) {
    console.error('❌ Error: standalone directory not found.');
    console.error('   Make sure to run "next build" first.');
    process.exit(1);
}

// public フォルダをコピー
if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
    console.log('✅ Copied public folder to', publicDest);
} else {
    console.log('⚠️  No public folder found, skipping.');
}

// static フォルダをコピー
if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true });
    console.log('✅ Copied static folder to', staticDest);
} else {
    console.error('❌ Error: .next/static folder not found.');
    process.exit(1);
}

// Application Insights preload スクリプトをコピー
const appInsightsSrc = path.join(__dirname, 'appinsights-preload.js');
const appInsightsDest = path.join(standaloneWebDir, 'appinsights-preload.js');
if (fs.existsSync(appInsightsSrc)) {
    fs.copyFileSync(appInsightsSrc, appInsightsDest);
    console.log('✅ Copied appinsights-preload.js to', appInsightsDest);
}

console.log('🎉 Standalone assets copied successfully!');

