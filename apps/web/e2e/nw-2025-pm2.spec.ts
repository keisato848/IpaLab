import { test, expect, captureEvidence } from './helpers/evidence';

const Q1_URL = '/exam/NW-2025-Spring-PM2/PM2/1?mode=practice';
const Q2_URL = '/exam/NW-2025-Spring-PM2/PM2/2?mode=practice';

async function expectRenderedMermaid(page: import('@playwright/test').Page, expectedCount: number) {
  const firstSvg = page.locator('.mermaid svg').first();
  await firstSvg.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.mermaid svg')).toHaveCount(expectedCount);
  await expect(page.getByText('図の描画に失敗しました')).toHaveCount(0);

  for (let index = 0; index < expectedCount; index += 1) {
    const childCount = await page.locator('.mermaid svg').nth(index).evaluate((svg) => svg.children.length);
    expect(childCount).toBeGreaterThan(0);
  }
}

test.describe('NW-2025-Spring-PM2 午後IIデータ表示', () => {
  test('N-01: 問1で解答欄とMermaid図表が表示される', async ({ page }, testInfo) => {
    await page.goto(Q1_URL);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: '社内ネットワークのIPv6対応' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '設問一覧' })).toBeVisible();
    await expect(page.getByText('解答欄 32')).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(32);
    await expect(page.getByText('本文中の [ a ] に入れる適切な字句を答えよ。')).toBeVisible();
    await expect(page.getByText('表1中の [ ケ ] に入れる適切な字句を答えよ。')).toBeVisible();
    await expectRenderedMermaid(page, 4);

    await captureEvidence(page, testInfo, 'N-01_NW2025PM2_Q1_answer_fields');
  });

  test('N-02: 問2で欠落していた設問(2)(3)を含む解答欄が表示される', async ({ page }, testInfo) => {
    await page.goto(Q2_URL);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'IoT システムの設計' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '設問一覧' })).toBeVisible();
    await expect(page.getByText('解答欄 31')).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(31);
    await expect(page.getByText('本文中の [ l ] に入れる適切な字句を答えよ。')).toBeVisible();
    await expect(page.getByText('本文中の下線②について、サーバが送信したACKを、図5中の(i)〜(ix)で答えよ。')).toBeVisible();
    await expect(page.getByText('本文中の下線③について、受信した機器が重複したACKであると判断する理由を、30字以内で答えよ。')).toBeVisible();
    await expectRenderedMermaid(page, 4);

    await captureEvidence(page, testInfo, 'N-02_NW2025PM2_Q2_answer_fields');
  });
});