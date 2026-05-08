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
      await expect(page.getByText(`解答欄 ${item.fields}`)).toBeVisible();
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

  test('P0-11: 新形式午後画面の下書き保存・文字数制限・ヘッダー表示が機能する', async ({ page }, testInfo) => {
    await page.goto('/exam/SA-2025-Spring-PM1/PM1/1?mode=practice');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('[aria-label="総合スコア 100点満点"]')).toBeVisible();
    await expect(page.getByText('0/100')).toBeVisible();
    await expect(page.getByText(/0 \/ \d+ 文字/).first()).toBeVisible();

    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.fill('途中保存の確認');
    await page.getByRole('button', { name: '下書き保存' }).first().click();
    await expect(page.getByText(/保存済み/).first()).toBeVisible();

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('textarea').first()).toHaveValue('途中保存の確認');

    const exitButton = page.getByRole('button', { name: '終了して一覧へ' });
    await expect(exitButton).toBeVisible();
    const backgroundColor = await exitButton.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    await captureEvidence(page, testInfo, 'P0-11_pm_draft_limit_header', { fullPage: false });
  });

  test('P0-12: スマホ幅でも解答ヘッダーが1行に収まり解答欄数を表示する', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/exam/SA-2025-Spring-PM1/PM1/1?mode=practice');
    await page.waitForLoadState('domcontentloaded');

    const header = page.getByTestId('pm-answer-pane-header');
    await expect(header).toBeVisible();
    await expect(header.getByText('設問一覧')).toBeVisible();
    await expect(header.getByText('解答欄 10')).toBeVisible();
    await expect(header.getByText('スコア')).toBeVisible();
    await expect(header.getByText('0/100')).toBeVisible();
    await expect(header.getByText('全3問')).toHaveCount(0);

    const headerBox = await header.boundingBox();
    expect(headerBox?.height).toBeLessThanOrEqual(56);

    await captureEvidence(page, testInfo, 'P0-12_mobile_compact_answer_header', { fullPage: false });
  });
});