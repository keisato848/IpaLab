export function getExamLabel(examId: string): string {
    // Format: AP-2024-Spring-AM, FE-2023-Fall-PM
    // Target: 応用情報技術者試験 令和6年 春期 (午前)

    if (!examId) return '';

    const parts = examId.split('-');
    if (parts.length < 3) return examId;

    const [type, yearStr, season, time] = parts;

    // 1. Exam Type
    let typeLabel = type;
    if (type === 'AP') typeLabel = '応用情報技術者試験';
    if (type === 'FE') typeLabel = '基本情報技術者試験';
    if (type === 'SG') typeLabel = '情報セキュリティマネジメント試験';

    // 2. Year (AD -> REIWA)
    // 2019 was Reiwa 1 (May onwards, but simplified for exams usually)
    // 2018 = Heisei 30
    const year = parseInt(yearStr);
    let yearLabel = `${year}年`;
    if (year >= 2019) {
        yearLabel = `令和${year - 2018}年`;
    } else if (year > 1988) {
        yearLabel = `平成${year - 1988}年`;
    }

    // 3. Season
    let seasonLabel = season;
    if (season === 'Spring') seasonLabel = '春期';
    if (season === 'Fall') seasonLabel = '秋期';
    if (season === 'Public') seasonLabel = '公開問題';

    // 4. Time (AM/PM/AM1/AM2)
    // Note: ID might be AP-2024-Spring-AM, so 'time' is index 3
    let timeLabel = '';

    const suffix = time || ''; // AM, PM, AM1 etc

    // Special handling for FE 2023 onwards (CBT: Subject A/B)
    if (type === 'FE' && year >= 2023) {
        if (suffix.startsWith('AM')) timeLabel = '(科目A)';
        if (suffix.startsWith('PM')) timeLabel = '(科目B)';
    } else {
        // Standard legacy AM/PM
        if (suffix.startsWith('AM')) timeLabel = '(午前)';
        if (suffix === 'AM1') timeLabel = '(午前I)';
        if (suffix === 'AM2') timeLabel = '(午前II)';
        if (suffix.startsWith('PM')) timeLabel = '(午後)';
    }

    return `${typeLabel} ${yearLabel} ${seasonLabel} ${timeLabel}`.trim();
}
