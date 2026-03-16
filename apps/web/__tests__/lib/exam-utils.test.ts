import { describe, it, expect } from 'vitest';
import { getExamLabel, getExamTypeName } from '@/lib/exam-utils';

describe('getExamTypeName', () => {
    it('ITパスポート試験のコードを正しく変換する', () => {
        expect(getExamTypeName('IP')).toBe('ITパスポート試験');
    });

    it('基本情報技術者試験のコードを正しく変換する', () => {
        expect(getExamTypeName('FE')).toBe('基本情報技術者試験');
    });

    it('応用情報技術者試験のコードを正しく変換する', () => {
        expect(getExamTypeName('AP')).toBe('応用情報技術者試験');
    });

    it('情報処理安全確保支援士試験のコードを正しく変換する', () => {
        expect(getExamTypeName('SC')).toBe('情報処理安全確保支援士試験');
    });

    it('プロジェクトマネージャ試験のコードを正しく変換する', () => {
        expect(getExamTypeName('PM')).toBe('プロジェクトマネージャ試験');
    });

    it('ネットワークスペシャリスト試験のコードを正しく変換する', () => {
        expect(getExamTypeName('NW')).toBe('ネットワークスペシャリスト試験');
    });

    it('システムアーキテクト試験のコードを正しく変換する', () => {
        expect(getExamTypeName('SA')).toBe('システムアーキテクト試験');
    });

    it('ITストラテジスト試験のコードを正しく変換する', () => {
        expect(getExamTypeName('ST')).toBe('ITストラテジスト試験');
    });

    it('情報セキュリティマネジメント試験のコードを正しく変換する', () => {
        expect(getExamTypeName('SG')).toBe('情報セキュリティマネジメント試験');
    });

    it('未知の試験コードはそのまま返す', () => {
        expect(getExamTypeName('XX')).toBe('XX');
    });
});

describe('getExamLabel', () => {
    describe('基本的な変換', () => {
        it('応用情報技術者試験の午前問題を正しく変換する', () => {
            const result = getExamLabel('AP-2024-Spring-AM');
            expect(result).toBe('応用情報技術者試験 令和6年 春期 (午前)');
        });

        it('応用情報技術者試験の午後問題を正しく変換する', () => {
            const result = getExamLabel('AP-2024-Fall-PM');
            expect(result).toBe('応用情報技術者試験 令和6年 秋期 (午後)');
        });

        it('基本情報技術者試験（2023年以降）を正しく変換する', () => {
            const result = getExamLabel('FE-2023-Spring-AM');
            expect(result).toBe('基本情報技術者試験 令和5年 春期 (科目A)');
        });

        it('基本情報技術者試験（2023年以降）の科目Bを正しく変換する', () => {
            const result = getExamLabel('FE-2024-Fall-PM');
            expect(result).toBe('基本情報技術者試験 令和6年 秋期 (科目B)');
        });

        it('情報セキュリティマネジメント試験を正しく変換する', () => {
            const result = getExamLabel('SG-2024-Spring-AM');
            expect(result).toBe('情報セキュリティマネジメント試験 令和6年 春期 (午前)');
        });
    });

    describe('年号変換', () => {
        it('令和元年（2019年）を正しく変換する', () => {
            const result = getExamLabel('AP-2019-Spring-AM');
            expect(result).toBe('応用情報技術者試験 令和1年 春期 (午前)');
        });

        it('平成30年（2018年）を正しく変換する', () => {
            const result = getExamLabel('AP-2018-Fall-AM');
            expect(result).toBe('応用情報技術者試験 平成30年 秋期 (午前)');
        });

        it('平成元年（1989年）を正しく変換する', () => {
            const result = getExamLabel('AP-1989-Spring-AM');
            expect(result).toBe('応用情報技術者試験 平成1年 春期 (午前)');
        });
    });

    describe('午前I/II の変換', () => {
        it('午前Iを正しく変換する', () => {
            const result = getExamLabel('AP-2024-Spring-AM1');
            expect(result).toBe('応用情報技術者試験 令和6年 春期 (午前I)');
        });

        it('午前IIを正しく変換する', () => {
            const result = getExamLabel('AP-2024-Spring-AM2');
            expect(result).toBe('応用情報技術者試験 令和6年 春期 (午前II)');
        });
    });

    describe('公開問題', () => {
        it('公開問題を正しく変換する', () => {
            const result = getExamLabel('FE-2024-Public-AM');
            expect(result).toBe('基本情報技術者試験 令和6年 公開問題 (科目A)');
        });
    });

    describe('エッジケース', () => {
        it('空文字列の場合は空文字列を返す', () => {
            const result = getExamLabel('');
            expect(result).toBe('');
        });

        it('不正なフォーマットの場合はそのまま返す', () => {
            const result = getExamLabel('invalid');
            expect(result).toBe('invalid');
        });

        it('パーツが2つしかない場合はそのまま返す', () => {
            const result = getExamLabel('AP-2024');
            expect(result).toBe('AP-2024');
        });

        it('未知の試験タイプはそのまま表示する', () => {
            const result = getExamLabel('XX-2024-Spring-AM');
            expect(result).toBe('XX 令和6年 春期 (午前)');
        });

        it('時間指定がない場合は省略される', () => {
            const result = getExamLabel('AP-2024-Spring');
            expect(result).toBe('応用情報技術者試験 令和6年 春期');
        });
    });

    describe('西暦併記オプション', () => {
        it('令和年に西暦を併記する', () => {
            const result = getExamLabel('AP-2024-Spring-AM', { includeWesternYear: true });
            expect(result).toBe('応用情報技術者試験 令和6年(2024年) 春期 (午前)');
        });

        it('平成年に西暦を併記する', () => {
            const result = getExamLabel('AP-2018-Fall-AM', { includeWesternYear: true });
            expect(result).toBe('応用情報技術者試験 平成30年(2018年) 秋期 (午前)');
        });

        it('オプション未指定では西暦を併記しない', () => {
            const result = getExamLabel('AP-2024-Spring-AM');
            expect(result).toBe('応用情報技術者試験 令和6年 春期 (午前)');
        });

        it('午前IIで西暦併記が正しく動作する', () => {
            const result = getExamLabel('SA-2024-Spring-AM2', { includeWesternYear: true });
            expect(result).toBe('システムアーキテクト試験 令和6年(2024年) 春期 (午前II)');
        });
    });
});
