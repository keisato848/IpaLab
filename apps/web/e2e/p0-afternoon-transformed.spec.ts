import { test, expect, captureEvidence } from './helpers/evidence';

const cases = [
  { id: 'P0-01', examId: 'SA-2025-Spring-PM1', type: 'PM1', qNo: 1, title: '消耗品の集中購買化', sections: 3, fields: 10, mermaid: 0 },
  { id: 'P0-02', examId: 'SA-2025-Spring-PM1', type: 'PM1', qNo: 2, title: '営業活動を支援', sections: 4, fields: 8, mermaid: 0 },
  { id: 'P0-03', examId: 'SA-2025-Spring-PM1', type: 'PM1', qNo: 3, title: '不動産売買仲介', sections: 4, fields: 8, mermaid: 0 },
  { id: 'P0-04', examId: 'SA-2025-Spring-PM2', type: 'PM2', qNo: 1, title: '複数の情報システム', sections: 3, fields: 3, mermaid: 0 },
  { id: 'P0-05', examId: 'SA-2025-Spring-PM2', type: 'PM2', qNo: 2, title: '現行システムと新システム', sections: 3, fields: 3, mermaid: 0 },
  { id: 'P0-06', examId: 'ST-2025-Spring-PM1', type: 'PM1', qNo: 1, title: 'ITを活用した新たなビジネス領域', sections: 3, fields: 8, mermaid: 1 },
  { id: 'P0-07', examId: 'ST-2025-Spring-PM1', type: 'PM1', qNo: 2, title: 'ITを活用した子育て支援', sections: 3, fields: 8, mermaid: 0 },
  { id: 'P0-08', examId: 'ST-2025-Spring-PM1', type: 'PM1', qNo: 3, title: 'ドラッグストア', sections: 4, fields: 7, mermaid: 0 },
  { id: 'P0-09', examId: 'ST-2025-Spring-PM2', type: 'PM2', qNo: 1, title: '基幹システム', sections: 3, fields: 3, mermaid: 0 },
  { id: 'P0-10', examId: 'ST-2025-Spring-PM2', type: 'PM2', qNo: 2, title: 'DX の企画策定', sections: 3, fields: 3, mermaid: 0 },
];

test.describe('P0午後問題 transformed データ表示', () => {
  for (const item of cases) {
    test(`${item.id}: ${item.examId} 問${item.qNo}の解答欄が表示される`, async ({ page }, testInfo) => {
      await page.goto(`/exam/${item.examId}/${item.type}/${item.qNo}?mode=practice`);
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText(item.title).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('heading', { name: '設問一覧' })).toBeVisible();
      await expect(page.getByText(`全${item.sections}問`)).toBeVisible();
      await expect(page.locator('textarea')).toHaveCount(item.fields);
      await expect(page.getByText('設問データがありません')).toHaveCount(0);
      await expect(page.getByText('図の描画に失敗しました')).toHaveCount(0);

      if (item.mermaid > 0) {
        await expect(page.locator('.mermaid svg')).toHaveCount(item.mermaid);
        const childCount = await page.locator('.mermaid svg').first().evaluate((svg) => svg.children.length);
        expect(childCount).toBeGreaterThan(0);
      }

      await captureEvidence(page, testInfo, `${item.id}_${item.examId}_q${item.qNo}_answer_fields`, { fullPage: false });
    });
  }
});