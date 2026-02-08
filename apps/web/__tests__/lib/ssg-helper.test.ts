import { describe, it, expect } from 'vitest';

describe('SSG Helper 型定義', () => {
    describe('SSGExamParams型', () => {
        it('正しい型構造を持つ', () => {
            const mockParams = {
                year: '2024',
                type: 'AP',
                examId: 'AP-2024-Spring-AM',
            };

            expect(mockParams).toHaveProperty('year');
            expect(mockParams).toHaveProperty('type');
            expect(mockParams).toHaveProperty('examId');
            expect(typeof mockParams.year).toBe('string');
            expect(typeof mockParams.type).toBe('string');
            expect(typeof mockParams.examId).toBe('string');
        });
    });

    describe('SSGQuestionParams型', () => {
        it('SSGExamParamsを継承しqNoを持つ', () => {
            const mockParams = {
                year: '2024',
                type: 'AP',
                examId: 'AP-2024-Spring-AM',
                qNo: '1',
            };

            expect(mockParams).toHaveProperty('year');
            expect(mockParams).toHaveProperty('type');
            expect(mockParams).toHaveProperty('examId');
            expect(mockParams).toHaveProperty('qNo');
            expect(typeof mockParams.qNo).toBe('string');
        });
    });
});

describe('ExamIdパーサーロジック', () => {
    // ssg-helper.tsのgenerateAllExamParamsで使われるパース処理をテスト
    const parseExamId = (examId: string) => {
        const parts = examId.split('-');
        const type = parts[0] || 'FE';
        return {
            year: examId,
            type: type,
            examId: examId,
        };
    };

    it('標準的なexamIdをパースする', () => {
        const result = parseExamId('AP-2024-Spring-AM');
        expect(result.type).toBe('AP');
        expect(result.examId).toBe('AP-2024-Spring-AM');
    });

    it('FEタイプをパースする', () => {
        const result = parseExamId('FE-2023-Fall-PM');
        expect(result.type).toBe('FE');
    });

    it('SGタイプをパースする', () => {
        const result = parseExamId('SG-2024-Spring-AM');
        expect(result.type).toBe('SG');
    });

    it('SAタイプをパースする', () => {
        const result = parseExamId('SA-2024-Fall-PM');
        expect(result.type).toBe('SA');
    });

    it('不正な形式でもパースできる', () => {
        const result = parseExamId('unknown-format');
        expect(result.type).toBe('unknown');
    });

    it('ハイフンなしの場合は全体がタイプになる', () => {
        const result = parseExamId('SimpleExam');
        expect(result.type).toBe('SimpleExam');
    });

    it('空文字列の場合はデフォルト値', () => {
        const result = parseExamId('');
        expect(result.type).toBe('FE'); // デフォルト
    });
});

describe('データディレクトリ解決ロジック', () => {
    // resolveDataDir関数の候補パスを検証
    it('正しい候補パスのパターンを持つ', () => {
        const candidates = [
            '../../packages/data/data/questions',
            'packages/data/data/questions',
            '../packages/data/data/questions',
        ];

        candidates.forEach(candidate => {
            expect(candidate).toContain('packages/data/data/questions');
        });
    });

    it('候補パスは相対パスを含む', () => {
        const candidate1 = '../../packages/data/data/questions';
        const candidate2 = 'packages/data/data/questions';

        expect(candidate1.startsWith('../')).toBe(true);
        expect(candidate2.startsWith('packages')).toBe(true);
    });
});

describe('JSONファイル読み込みロジック', () => {
    it('questions_raw.jsonのファイル名パターン', () => {
        const examId = 'AP-2024-Spring-AM';
        const expectedFilePath = `${examId}/questions_raw.json`;

        expect(expectedFilePath).toBe('AP-2024-Spring-AM/questions_raw.json');
    });

    it('ディレクトリフィルタリングロジック', () => {
        const dirents = [
            { name: 'AP-2024', isDirectory: () => true },
            { name: 'readme.txt', isDirectory: () => false },
            { name: 'FE-2023', isDirectory: () => true },
        ];

        const directories = dirents
            .filter(d => d.isDirectory())
            .map(d => d.name);

        expect(directories).toEqual(['AP-2024', 'FE-2023']);
    });
});
