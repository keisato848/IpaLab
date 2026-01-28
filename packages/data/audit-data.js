const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, 'data/questions');
const folders = fs.readdirSync(questionsDir).filter(f => 
    fs.statSync(path.join(questionsDir, f)).isDirectory()
);

const results = {
    missingCorrectOption: [],
    missingExplanation: [],
    shortExplanation: []
};

for (const folder of folders) {
    const questionsPath = path.join(questionsDir, folder, 'questions_raw.json');
    const answersPath = path.join(questionsDir, folder, 'answers_raw.json');
    
    if (!fs.existsSync(questionsPath)) continue;
    
    const hasAnswersRaw = fs.existsSync(answersPath);
    const data = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
    const questions = data.questions || [];
    
    for (const q of questions) {
        const qNo = q.qNo || q.questionNo || '?';
        
        if (!q.correctOption || q.correctOption === null || q.correctOption === '') {
            results.missingCorrectOption.push({ examId: folder, qNo, hasAnswersRaw });
        }
        
        if (!q.explanation || q.explanation === null) {
            results.missingExplanation.push({ examId: folder, qNo });
        } else if (q.explanation.length <= 20) {
            results.shortExplanation.push({ examId: folder, qNo, len: q.explanation.length });
        }
    }
}

// Group by exam
const groupByExam = (arr) => {
    const map = {};
    arr.forEach(r => {
        if (!map[r.examId]) map[r.examId] = { questions: [], hasAnswersRaw: r.hasAnswersRaw };
        map[r.examId].questions.push(r.qNo);
    });
    return map;
};

const correctGroup = groupByExam(results.missingCorrectOption);
const explGroup = groupByExam(results.missingExplanation);

console.log('========================================');
console.log('       試験データ整合性監査レポート');
console.log('========================================\n');

console.log('【サマリー】');
console.log(`  総フォルダ数: ${folders.length}`);
console.log(`  correctOption欠落: ${results.missingCorrectOption.length} 問`);
console.log(`  explanation欠落:   ${results.missingExplanation.length} 問`);
console.log(`  短いexplanation:   ${results.shortExplanation.length} 問\n`);

console.log('========================================');
console.log('【correctOption欠落一覧】');
console.log('----------------------------------------');
const correctExams = Object.keys(correctGroup).sort();
console.log(`対象試験数: ${correctExams.length}\n`);

correctExams.forEach(ex => {
    const info = correctGroup[ex];
    const answersStatus = info.hasAnswersRaw ? '✓あり' : '✗なし';
    console.log(`${ex}`);
    console.log(`  answers_raw.json: ${answersStatus}`);
    console.log(`  欠落問題: ${info.questions.length}問 (Q${info.questions.join(', Q')})`);
    console.log('');
});

console.log('========================================');
console.log('【explanation欠落一覧】');
console.log('----------------------------------------');
const explExams = Object.keys(explGroup).sort();
console.log(`対象試験数: ${explExams.length}\n`);

explExams.forEach(ex => {
    const info = explGroup[ex];
    console.log(`${ex}: ${info.questions.length}問 (Q${info.questions.join(', Q')})`);
});

if (results.shortExplanation.length > 0) {
    console.log('\n========================================');
    console.log('【短いexplanation（20文字以下）】');
    console.log('----------------------------------------');
    results.shortExplanation.forEach(r => {
        console.log(`${r.examId} Q${r.qNo}: ${r.len}文字`);
    });
}

// Output JSON summary
const summary = {
    timestamp: new Date().toISOString(),
    totalFolders: folders.length,
    missingCorrectOption: {
        total: results.missingCorrectOption.length,
        exams: correctExams.map(ex => ({
            examId: ex,
            hasAnswersRaw: correctGroup[ex].hasAnswersRaw,
            questionCount: correctGroup[ex].questions.length,
            questions: correctGroup[ex].questions
        }))
    },
    missingExplanation: {
        total: results.missingExplanation.length,
        exams: explExams.map(ex => ({
            examId: ex,
            questionCount: explGroup[ex].questions.length,
            questions: explGroup[ex].questions
        }))
    }
};

fs.writeFileSync(path.join(__dirname, 'audit_result.json'), JSON.stringify(summary, null, 2));
console.log('\n\n詳細データは audit_result.json に出力しました。');
