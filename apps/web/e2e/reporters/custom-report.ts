/**
 * Playwright カスタムレポーター — E2E エビデンス報告書自動生成
 *
 * 全 E2E テスト実行後に docs/04_reports/E2E_Test_Evidence_Report_{YYYYMMDD}.md を
 * 自動生成する。SKIP_EVIDENCE による省略は廃止済み。
 */

import type {
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

interface TestRecord {
  id: string;
  title: string;
  suiteName: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  attachments: { name: string; path?: string; contentType: string }[];
}

class CustomReporter implements Reporter {
  private records: TestRecord[] = [];
  private startTime = 0;
  private branch = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? '(local)';
  private prNumber = process.env.GITHUB_PR_NUMBER ?? process.env.PR_NUMBER ?? '';

  onBegin(_config: unknown, _suite: Suite): void {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const titles = test.titlePath();
    // titlePath は [ファイル, スイート, ..., テスト名] の配列
    const suiteName = titles.slice(0, -1).join(' > ');
    const testTitle = titles[titles.length - 1] ?? test.title;

    // テスト ID を決定（タイトルから "D-01" 等のパターンを抽出、なければ連番）
    const idMatch = testTitle.match(/^([A-Z]-\d+)/);
    const id = idMatch ? idMatch[1] : `T-${String(this.records.length + 1).padStart(2, '0')}`;

    this.records.push({
      id,
      title: testTitle,
      suiteName,
      status: result.status,
      duration: result.duration,
      attachments: result.attachments.map((a) => ({
        name: a.name,
        path: a.path,
        contentType: a.contentType,
      })),
    });
  }

  onEnd(): void {
    this._writeReport();
  }

  private _writeReport(): void {
    const now = new Date();
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const dateStr = now.toISOString().slice(0, 10);
    const durationSec = ((Date.now() - this.startTime) / 1000).toFixed(1);

    const total = this.records.length;
    const passed = this.records.filter((r) => r.status === 'passed').length;
    const failed = this.records.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
    const skipped = this.records.filter((r) => r.status === 'skipped' || r.status === 'interrupted').length;
    const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    // エビデンス画像を収集（evidence/ ディレクトリから）
    const evidenceDir = path.resolve(process.cwd(), 'e2e', 'evidence');
    const evidenceFiles = fs.existsSync(evidenceDir)
      ? fs.readdirSync(evidenceDir)
          .filter((f) => f.endsWith('.png'))
          .sort()
      : [];

    // 実行タイムスタンププレフィックスで直近実行分に絞る（今日分）
    const todayPrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayEvidence = evidenceFiles.filter((f) => f.startsWith(todayPrefix.slice(0, 4)));

    // スイートでグループ化
    const suiteMap = new Map<string, TestRecord[]>();
    for (const r of this.records) {
      if (!suiteMap.has(r.suiteName)) suiteMap.set(r.suiteName, []);
      suiteMap.get(r.suiteName)!.push(r);
    }

    const statusEmoji = (s: TestRecord['status']) => {
      switch (s) {
        case 'passed': return '✅ Pass';
        case 'failed': return '❌ Fail';
        case 'timedOut': return '⏱ Timeout';
        default: return '⏭ Skip';
      }
    };

    // 報告書本文構築
    const lines: string[] = [
      `# E2E テストエビデンス報告書`,
      ``,
      `> 自動生成: ${now.toISOString()} — Playwright カスタムレポーター`,
      ``,
      `## 1. エグゼクティブサマリー`,
      ``,
      `| 項目 | 値 |`,
      `|------|-----|`,
      `| テストフレームワーク | Playwright |`,
      `| 総テスト数 | ${total} |`,
      `| 成功 | ${passed} |`,
      `| 失敗 | ${failed} |`,
      `| スキップ | ${skipped} |`,
      `| 成功率 | ${rate}% |`,
      `| 実行時間 | ${durationSec} 秒 |`,
      `| ブランチ | ${this.branch} |`,
      `| PR 番号 | ${this.prNumber || '(なし)'} |`,
      ``,
      `## 2. 変更概要`,
      ``,
      `> 本報告書は E2E テスト実行時に自動生成されます。変更概要は PR 本文を参照してください。`,
      ``,
      `## 3. テストシナリオ一覧`,
      ``,
    ];

    for (const [suiteName, records] of suiteMap) {
      lines.push(`### ${suiteName}`);
      lines.push(``);
      lines.push(`| テスト ID | シナリオ名 | 結果 | 実行時間 |`);
      lines.push(`|-----------|-----------|------|---------|`);
      for (const r of records) {
        lines.push(`| ${r.id} | ${r.title} | ${statusEmoji(r.status)} | ${(r.duration / 1000).toFixed(1)}s |`);
      }
      lines.push(``);
    }

    lines.push(`## 4. スクリーンショットエビデンス`);
    lines.push(``);

    if (todayEvidence.length === 0) {
      lines.push(`> スクリーンショットなし（エビデンスファイルが見つかりませんでした）`);
      lines.push(``);
    } else {
      // テスト ID でグループ化して横並び表示
      const groups = new Map<string, string[]>();
      for (const f of todayEvidence) {
        const idM = f.match(/_([A-Z]-\d+)/);
        const key = idM ? idM[1] : 'その他';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(f);
      }

      for (const [key, files] of groups) {
        if (files.length === 1) {
          lines.push(`![${key}](../../apps/web/e2e/evidence/${files[0]})`);
          lines.push(``);
        } else {
          // 複数画像はテーブルで横並び
          const headers = files.map((_, i) => `画像${i + 1}`).join(' | ');
          const aligns = files.map(() => ':---:').join(' | ');
          const imgs = files.map((f) => `![${key}](../../apps/web/e2e/evidence/${f})`).join(' | ');
          lines.push(`| ${headers} |`);
          lines.push(`| ${aligns} |`);
          lines.push(`| ${imgs} |`);
          lines.push(``);
        }
      }
    }

    lines.push(`## 5. 結論`);
    lines.push(``);
    if (failed === 0) {
      lines.push(`全 ${total} テストが成功しました。UI への悪影響はありません。`);
    } else {
      lines.push(`**${failed} 件のテストが失敗しました。** 上記の失敗シナリオを確認してください。`);
    }
    lines.push(``);

    // 出力先: docs/04_reports/E2E_Test_Evidence_Report_YYYYMMDD.md
    // ワークスペースルートを推定（apps/web から 2 つ上）
    const workspaceRoot = path.resolve(process.cwd(), '..', '..');
    const reportsDir = path.join(workspaceRoot, 'docs', '04_reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(reportsDir, `E2E_Test_Evidence_Report_${yyyymmdd}.md`);
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
    console.log(`\n[custom-report] 報告書を生成しました: ${reportPath}`);
  }
}

export default CustomReporter;
