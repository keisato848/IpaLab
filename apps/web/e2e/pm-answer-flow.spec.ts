import { test, expect, captureEvidence } from './helpers/evidence';
import fs from 'fs';
import path from 'path';

type ScoreResult = {
  score: number;
  radarChartData: { subject: string; A: number; fullMark: number }[];
  feedback: string;
  mermaidDiagram: string;
  improvedAnswer: string;
};

type PMAnswerFlowFixture = {
  id: string;
  pagePath: string;
  answerInputIndex: number;
  questionTextIncludes: string;
  answerFieldId: string;
  draftKey: string;
  displayMaxChars: number;
  answer: string;
  scoreResult: ScoreResult;
};

const fixturePath = path.resolve(process.cwd(), 'e2e', 'fixtures', 'pm-answer-flow.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as PMAnswerFlowFixture;

test.describe('受講者想定 午後回答フロー', () => {
  test(`${fixture.id}: テスト答案を入力し採点結果とゲスト保存を確認する`, async ({ page }, testInfo) => {
    const scoreRequests: unknown[] = [];

    await page.route('**/api/score', async (route) => {
      scoreRequests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixture.scoreResult),
      });
    });

    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(fixture.pagePath);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '設問一覧' })).toBeVisible();

    const contextToggle = page.getByRole('button', { name: /問題文を隠す/ }).first();
    await contextToggle.click();
    await expect(page.getByRole('button', { name: /問題文を表示/ }).first()).toBeVisible();
    await page.waitForFunction((key) => window.localStorage.getItem(key) !== null, fixture.draftKey);

    const answerInput = page.getByLabel('原稿用紙形式の解答入力欄').nth(fixture.answerInputIndex);
    await expect(answerInput).toBeVisible();
    await answerInput.fill(fixture.answer);
    await expect(answerInput).toHaveValue(fixture.answer);

    await expect(page.getByTestId('genko-counter').nth(fixture.answerInputIndex)).toContainText(
      `${Array.from(fixture.answer).length} / ${fixture.displayMaxChars}`,
    );
    await expect(page.getByText('文字数制限を超えています。制限内に収めてから採点してください。')).toHaveCount(0);

    await page.getByRole('button', { name: '下書き保存' }).nth(fixture.answerInputIndex).click();
    await expect(page.getByText(/保存済み/).first()).toBeVisible();

    const draft = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || 'null'), fixture.draftKey);
    expect(draft).toMatchObject({ answer: fixture.answer });

    await page.getByRole('button', { name: 'AIで採点する' }).nth(fixture.answerInputIndex).click();
    await expect(page.getByText(fixture.scoreResult.feedback)).toBeVisible();
    await expect(page.getByText(fixture.scoreResult.improvedAnswer)).toBeVisible();
    await expect(page.getByText(String(fixture.scoreResult.score)).first()).toBeVisible();

    expect(scoreRequests).toHaveLength(1);
    expect(scoreRequests[0]).toMatchObject({
      userAnswer: fixture.answer,
    });
    expect(JSON.stringify(scoreRequests[0])).toContain(fixture.questionTextIncludes);

    const guestHistory = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ipalab_guest_history') || '[]'));
    const savedRecord = guestHistory.find((record: any) => record.questionId === fixture.answerFieldId);
    expect(savedRecord).toMatchObject({
      questionId: fixture.answerFieldId,
      userAnswer: fixture.answer,
      aiScore: fixture.scoreResult.score,
      aiFeedback: fixture.scoreResult.feedback,
      isDescriptive: true,
      isCorrect: true,
    });

    await captureEvidence(page, testInfo, `${fixture.id}_pm_answer_scoring_guest_save`, { fullPage: false });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByLabel('原稿用紙形式の解答入力欄').nth(fixture.answerInputIndex)).toHaveValue(fixture.answer);
  });
});
