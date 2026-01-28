/**
 * Apply correct answers from answers_raw.json to questions_raw.json
 * This script handles AM2 (multiple choice) questions
 */
const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, 'data/questions');
const folders = fs.readdirSync(questionsDir).filter(f => 
    fs.statSync(path.join(questionsDir, f)).isDirectory()
);

let totalFixed = 0;
let totalExams = 0;

for (const folder of folders) {
    const questionsPath = path.join(questionsDir, folder, 'questions_raw.json');
    const answersPath = path.join(questionsDir, folder, 'answers_raw.json');
    
    if (!fs.existsSync(questionsPath)) continue;
    if (!fs.existsSync(answersPath)) continue;
    
    const data = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
    const questions = data.questions || [];
    
    // Load answers
    const answersData = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
    
    // Convert answers to map (handle different formats)
    let answerMap = {};
    if (Array.isArray(answersData)) {
        answersData.forEach(a => {
            answerMap[a.qNo] = a.correctOption || a.correct;
        });
    } else if (answersData.answers) {
        answersData.answers.forEach(a => {
            answerMap[a.qNo] = a.correctOption || a.correct;
        });
    } else {
        // Object format: {"1": "a", "2": "b", ...}
        answerMap = answersData;
    }
    
    let fixedCount = 0;
    
    for (const q of questions) {
        const qNo = q.qNo || q.questionNo;
        if (!qNo) continue;
        
        const correctAnswer = answerMap[qNo] || answerMap[String(qNo)];
        
        if (correctAnswer && (!q.correctOption || q.correctOption === null || q.correctOption === '')) {
            q.correctOption = correctAnswer;
            fixedCount++;
        }
    }
    
    if (fixedCount > 0) {
        fs.writeFileSync(questionsPath, JSON.stringify(data, null, 2));
        console.log(`${folder}: Fixed ${fixedCount} questions`);
        totalFixed += fixedCount;
        totalExams++;
    }
}

console.log(`\n=== Summary ===`);
console.log(`Total exams updated: ${totalExams}`);
console.log(`Total questions fixed: ${totalFixed}`);
