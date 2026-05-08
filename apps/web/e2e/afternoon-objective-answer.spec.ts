import { test, expect, captureEvidence } from './helpers/evidence';

test.describe('午後客観式回答UI', () => {
  test('O-01 AP午後問1の選択式・短答式をAI採点欄にしない', async ({ page }, testInfo) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto('/exam/AP-2025-Spring-PM/PM/1?mode=practice');
      if (!(await page.getByText('404 This page could not be found').isVisible().catch(() => false))) {
        break;
      }
    }

    await expect(page.getByTestId('pm-answer-pane-header')).toBeVisible({ timeout: 30_000 });

    const objectiveFields = page.getByTestId('afternoon-objective-answer');
    await expect(objectiveFields.first()).toBeVisible();
    await expect(objectiveFields).toHaveCount(8);
    await expect(page.getByRole('button', { name: 'AIで採点する' })).toHaveCount(0);

    const shortTextField = page.locator('[data-testid="afternoon-objective-answer"][data-answer-mode="short-text"]').first();
    await shortTextField.getByRole('textbox').fill('デジタル・フォレンジック。');
    await shortTextField.getByRole('button', { name: '回答を確定' }).click();
    await expect(shortTextField.getByText('正解')).toBeVisible();

    const choiceField = page
      .locator('[data-testid="afternoon-objective-answer"][data-answer-mode="single-choice"]')
      .filter({ hasText: '[ a ]' })
      .first();
    await choiceField.getByRole('radio').nth(6).check();
    await choiceField.getByRole('button', { name: '回答を確定' }).click();
    await expect(choiceField.getByText('正解')).toBeVisible();

    await captureEvidence(page, testInfo, 'O-01_AP_PM_objective_answers');
  });
});
