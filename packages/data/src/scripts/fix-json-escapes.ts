import * as fs from 'fs';
import * as path from 'path';

const targetFile = path.resolve(__dirname, '../../data/questions/FE-2024-Public-PM/questions_raw.json');

function main() {
    console.log(`Fixing escapes in ${targetFile}...`);
    let content = fs.readFileSync(targetFile, 'utf-8');

    // JSON allows: \" \\ \/ \b \f \n \r \t \uXXXX
    // We want to find backslashes that are NOT followed by these.
    // Regex for valid escape: \\(["\\/bfnrt]|u[0-9a-fA-F]{4})
    // But we want to find invalid ones.
    // It's easier to iterate or use specific replacements for known Latex.

    // Common Latex: \{ \} \l \g \t (wait \t is tab). \s \p \d ...
    // Let's replace single backslashes that are causing trouble.
    // NOTE: In the string READ from file, a backslash is a character.
    // If the file text is `"... \left ... "`, then `\` is char 92.
    // If it's valid JSON, it should be `"... \\left ... "`.

    // We want to replace `\` with `\\` IF it's not a valid escape.
    // Valid escapes chars: " \ / b f n r t u
    // So if we see `\` followed by anything ELSE, we double it.

    // Regex: \\(?!["\\/bfnrtu])
    // matches a backslash NOT followed by valid chars.

    const fixed = content.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

    if (content !== fixed) {
        console.log("Found invalid escapes. Saving...");
        fs.writeFileSync(targetFile, fixed);
        console.log("Saved.");
    } else {
        console.log("No invalid escapes found (regex might be wrong or file is fine).");
    }
}

main();
