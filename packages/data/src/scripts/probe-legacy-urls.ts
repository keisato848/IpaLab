
import axios from 'axios';

const BASES: Record<string, string> = {
    '2020_Fall': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000d05l-att/',
    '2019_Fall': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000dict-att/',
    '2019_Spring': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000ddiw-att/',
    '2018_Fall': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000f01f-att/',
    '2018_Spring': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000fabr-att/',
    '2017_Fall': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000fqpm-att/',
    '2017_Spring': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000fzx1-att/',
    '2016_Fall': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000g6fw-att/',
    '2016_Spring': 'https://www.ipa.go.jp/shiken/mondai-kaiotu/gmcbt8000000gn5o-att/',
};

const NENGOS: Record<string, string> = {
    '2020_Fall': '2020r02o',
    '2019_Fall': '2019r01a',
    '2019_Spring': '2019h31h',
    '2018_Fall': '2018h30a',
    '2018_Spring': '2018h30h',
    '2017_Fall': '2017h29a',
    '2017_Spring': '2017h29h',
    '2016_Fall': '2016h28a',
    '2016_Spring': '2016h28h',
};

// PM is Spring only (except 2020 Fall). SC is both. AP is both.
const ATTEMPTS = [
    // AP Afternoon
    { cat: 'ap', type: 'pm', years: ['2020_Fall', '2019_Fall', '2019_Spring', '2018_Fall', '2018_Spring', '2017_Fall', '2017_Spring', '2016_Fall', '2016_Spring'] },
    // PM Afternoon 1 & 2 (Spring usually, 2020 Fall)
    { cat: 'pm', type: 'pm1', years: ['2020_Fall', '2019_Spring', '2018_Spring', '2017_Spring', '2016_Spring'] },
    { cat: 'pm', type: 'pm2', years: ['2020_Fall', '2019_Spring', '2018_Spring', '2017_Spring', '2016_Spring'] },
    // SC Afternoon 1 & 2 (Spring & Fall, but 2020 Spring cancelled -> 2020 Fall)
    { cat: 'sc', type: 'pm1', years: ['2020_Fall', '2019_Fall', '2019_Spring', '2018_Fall', '2018_Spring', '2017_Fall', '2017_Spring', '2016_Fall', '2016_Spring'] },
    { cat: 'sc', type: 'pm2', years: ['2020_Fall', '2019_Fall', '2019_Spring', '2018_Fall', '2018_Spring', '2017_Fall', '2017_Spring', '2016_Fall', '2016_Spring'] },
];

async function checkUrl(url: string) {
    try {
        await axios.head(url);
        return true;
    } catch (e) {
        return false;
    }
}

async function main() {
    console.log('Checking Legacy Afternoon URLs...');

    for (const attempt of ATTEMPTS) {
        for (const yearKey of attempt.years) {
            const base = BASES[yearKey];
            const nengo = NENGOS[yearKey];

            // Construct filename: e.g. 2018h30h_ap_pm_qs.pdf
            const filename = `${nengo}_${attempt.cat}_${attempt.type}_qs.pdf`;
            const ansFilename = `${nengo}_${attempt.cat}_${attempt.type}_ans.pdf`;

            const url = `${base}${filename}`;
            const ansUrl = `${base}${ansFilename}`;

            const exists = await checkUrl(url);
            const ansExists = await checkUrl(ansUrl);

            const status = exists ? 'FOUND' : 'MISSING';
            const ansStatus = ansExists ? 'FOUND' : 'MISSING';

            console.log(`[${yearKey}] ${attempt.cat.toUpperCase()} ${attempt.type.toUpperCase()}: ${status} (Ans: ${ansStatus})`);
            if (exists) {
                console.log(`  QS: ${url}`);
            }
            if (ansExists) {
                console.log(`  ANS: ${ansUrl}`);
            }
        }
    }
}

main();
