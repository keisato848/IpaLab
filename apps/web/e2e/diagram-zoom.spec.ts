import { test, expect, captureEvidence, setTheme } from './helpers/evidence';

/**
 * E2Eテスト: 図表拡大表示（DiagramViewerModal）
 *
 * 前提条件:
 * - DiagramViewerModal コンポーネント + Mermaid.tsx 改修が完了していること
 * - テストデータ: SA-2024-Spring-AM2 Q7（Mermaid graph TD + 3 subgraph の複雑な図）
 *
 * テストシナリオ:
 * ┌──────────────────────────────────────────────────────────────────────────────────┐
 * │ ID   │ シナリオ名                               │ 期待結果                      │
 * ├──────┼──────────────────────────────────────────┼───────────────────────────────┤
 * │ Z-01 │ Mermaid図クリックでモーダルが開く          │ overlay + content が表示      │
 * │ Z-02 │ モーダル内に拡大図が表示される              │ SVG がレンダリングされている   │
 * │ Z-03 │ ズームインボタンでスケール増加              │ scale > 1.0                   │
 * │ Z-04 │ ズームアウトボタンでスケール減少            │ scale < 1.0                   │
 * │ Z-05 │ ズームリセットで初期スケールに戻る          │ scale = 1.0                   │
 * │ Z-06 │ 閉じるボタンでモーダルが閉じる             │ overlay が非表示              │
 * │ Z-07 │ オーバーレイクリックでモーダルが閉じる      │ overlay が非表示              │
 * │ Z-08 │ ESCキーでモーダルが閉じる                  │ overlay が非表示              │
 * │ Z-09 │ ダークテーマでモーダルが正しく表示される    │ ダークテーマ適用の外観         │
 * │ Z-10 │ 複雑なMermaid図（3 subgraph）の表示検証   │ subgraph が描画されている      │
 * │ Z-11 │ ピンチズームでスケールが変化する（CDP）    │ scale が変化（Chromium限定）    │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 */

// SA-2024-Spring-AM2 Q7 のページURL
// ※ルーティング: /exam/[year]/[type]/[qNo]
// ExamListClient.tsx: `/exam/${exam.id}/${startType}` → year=examId, type=AM2
const QUESTION_URL = '/exam/SA-2024-Spring-AM2/AM2/7?mode=practice';

/**
 * Mermaid 図をクリックしてモーダルを開くヘルパー
 */
async function openDiagramModal(page: import('@playwright/test').Page) {
  // Mermaid図（SVG）がレンダリングされるまで待機
  const mermaidSvg = page.locator('.mermaid svg').first();
  await mermaidSvg.waitFor({ state: 'visible', timeout: 15000 });
  await mermaidSvg.click();

  // モーダルが開くのを待機
  await page.getByTestId('diagram-viewer-overlay').waitFor({ state: 'visible' });
}

/**
 * zoom-container の現在の scale 値を取得するヘルパー
 */
async function getZoomScale(page: import('@playwright/test').Page): Promise<number> {
  const transform = await page.getByTestId('diagram-zoom-container').evaluate(
    (el) => {
      // transform は内部ラッパー div に適用されている
      const inner = el.firstElementChild as HTMLElement;
      return inner ? getComputedStyle(inner).transform : getComputedStyle(el).transform;
    }
  );
  // matrix(a, b, c, d, tx, ty) — a が scaleX
  const match = transform.match(/matrix\(([^,]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  // transform: none の場合は scale 1.0
  return 1.0;
}

test.describe('図表拡大表示テスト（DiagramViewerModal）', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(QUESTION_URL);
    await page.waitForLoadState('load');
  });

  // ─── Z-01: モーダルの開閉 ───

  test.describe('Z-01: Mermaid図クリックでモーダルが開く', () => {

    test('Mermaid図をクリックするとモーダルオーバーレイが表示される', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      // オーバーレイとコンテンツ領域が表示されていること
      await expect(page.getByTestId('diagram-viewer-overlay')).toBeVisible();
      await expect(page.getByTestId('diagram-viewer-content')).toBeVisible();

      await captureEvidence(page, testInfo, 'Z-01_モーダル表示');
    });
  });

  // ─── Z-02: 拡大図の表示 ───

  test.describe('Z-02: モーダル内に拡大図が表示される', () => {

    test('モーダル内にSVG要素がレンダリングされている', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      // モーダルコンテンツ内にSVGが存在すること
      const svg = page.getByTestId('diagram-zoom-container').locator('svg');
      await expect(svg).toBeVisible();

      // SVG が空でないこと（パスや要素が含まれている）
      const childCount = await svg.evaluate((el) => el.children.length);
      expect(childCount).toBeGreaterThan(0);

      await captureEvidence(page, testInfo, 'Z-02_拡大図表示');
    });
  });

  // ─── Z-03: ズームイン ───

  test.describe('Z-03: ズームインボタンでスケール増加', () => {

    test('ズームインボタンを押すとスケールが1.0より大きくなる', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      const initialScale = await getZoomScale(page);

      // ズームインボタンをクリック
      await page.getByTestId('diagram-zoom-in').click();
      await page.waitForTimeout(300); // トランジション待機

      const zoomedScale = await getZoomScale(page);
      expect(zoomedScale).toBeGreaterThan(initialScale);

      await captureEvidence(page, testInfo, 'Z-03_ズームイン後');
    });
  });

  // ─── Z-04: ズームアウト ───

  test.describe('Z-04: ズームアウトボタンでスケール減少', () => {

    test('ズームアウトボタンを押すとスケールが1.0より小さくなる', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      const initialScale = await getZoomScale(page);

      // ズームアウトボタンをクリック
      await page.getByTestId('diagram-zoom-out').click();
      await page.waitForTimeout(300);

      const zoomedScale = await getZoomScale(page);
      expect(zoomedScale).toBeLessThan(initialScale);

      await captureEvidence(page, testInfo, 'Z-04_ズームアウト後');
    });
  });

  // ─── Z-05: ズームリセット ───

  test.describe('Z-05: ズームリセットで初期スケールに戻る', () => {

    test('ズーム操作後にリセットボタンでスケール1.0に戻る', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      // まずズームインする
      await page.getByTestId('diagram-zoom-in').click();
      await page.getByTestId('diagram-zoom-in').click();
      await page.waitForTimeout(300);

      const zoomedScale = await getZoomScale(page);
      expect(zoomedScale).toBeGreaterThan(1.0);

      // リセットボタンをクリック
      await page.getByTestId('diagram-zoom-reset').click();
      await page.waitForTimeout(300);

      const resetScale = await getZoomScale(page);
      expect(resetScale).toBeCloseTo(1.0, 1);

      await captureEvidence(page, testInfo, 'Z-05_ズームリセット後');
    });
  });

  // ─── Z-06: 閉じるボタン ───

  test.describe('Z-06: 閉じるボタンでモーダルが閉じる', () => {

    test('閉じるボタンをクリックするとモーダルが非表示になる', async ({ page }, testInfo) => {
      await openDiagramModal(page);
      await captureEvidence(page, testInfo, 'Z-06_モーダル表示中');

      // 閉じるボタンをクリック
      await page.getByTestId('diagram-viewer-close').click();

      // オーバーレイが非表示になること
      await expect(page.getByTestId('diagram-viewer-overlay')).not.toBeVisible();

      await captureEvidence(page, testInfo, 'Z-06_モーダル閉じた後');
    });
  });

  // ─── Z-07: オーバーレイクリック ───

  test.describe('Z-07: オーバーレイクリックでモーダルが閉じる', () => {

    test('オーバーレイ部分をクリックするとモーダルが閉じる', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      // オーバーレイの端（コンテンツ外）をクリック
      const overlay = page.getByTestId('diagram-viewer-overlay');
      const box = await overlay.boundingBox();
      expect(box).not.toBeNull();

      // オーバーレイの左上隅付近（コンテンツ領域の外）をクリック
      await page.mouse.click(box!.x + 10, box!.y + 10);

      // モーダルが閉じること
      await expect(page.getByTestId('diagram-viewer-overlay')).not.toBeVisible();

      await captureEvidence(page, testInfo, 'Z-07_オーバーレイクリックで閉じた後');
    });
  });

  // ─── Z-08: ESCキー ───

  test.describe('Z-08: ESCキーでモーダルが閉じる', () => {

    test('ESCキーを押すとモーダルが閉じる', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      // ESCキーを押下
      await page.keyboard.press('Escape');

      // モーダルが閉じること
      await expect(page.getByTestId('diagram-viewer-overlay')).not.toBeVisible();

      await captureEvidence(page, testInfo, 'Z-08_ESCキーで閉じた後');
    });
  });

  // ─── Z-09: ダークテーマ対応 ───

  test.describe('Z-09: ダークテーマでモーダルが正しく表示される', () => {

    test('ダークテーマ時にモーダルのスタイルが正しく適用される', async ({ page }, testInfo) => {
      // ライトテーマでモーダルを開いてエビデンス取得
      await setTheme(page, 'light');
      await page.waitForTimeout(300);
      await openDiagramModal(page);
      await captureEvidence(page, testInfo, 'Z-09_ライトテーマ_モーダル');

      // 閉じる
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('diagram-viewer-overlay')).not.toBeVisible();

      // ダークテーマに切り替え
      await setTheme(page, 'dark');
      await page.waitForTimeout(300);

      // 再度モーダルを開く
      await openDiagramModal(page);

      // モーダルコンテンツが表示されていること
      await expect(page.getByTestId('diagram-viewer-content')).toBeVisible();

      await captureEvidence(page, testInfo, 'Z-09_ダークテーマ_モーダル');
    });
  });

  // ─── Z-10: 複雑なMermaid図の表示検証 ───

  test.describe('Z-10: 複雑なMermaid図（3 subgraph）の表示検証', () => {

    test('3つのsubgraphを含むMermaid図が正しくレンダリングされる', async ({ page }, testInfo) => {
      await openDiagramModal(page);

      const container = page.getByTestId('diagram-zoom-container');
      const svg = container.locator('svg');
      await expect(svg).toBeVisible();

      // subgraph が描画されていること（SVG内の g.cluster 要素で判定）
      const clusterCount = await svg.locator('.cluster').count();
      expect(clusterCount).toBeGreaterThanOrEqual(3);

      // SVG のサイズが十分な大きさであること（レンダリング完了の指標）
      const svgBox = await svg.boundingBox();
      expect(svgBox).not.toBeNull();
      expect(svgBox!.width).toBeGreaterThan(100);
      expect(svgBox!.height).toBeGreaterThan(100);

      await captureEvidence(page, testInfo, 'Z-10_複雑なMermaid図_3subgraph');
    });
  });

  // ─── Z-11: ピンチズーム（CDP経由） ───

  test.describe('Z-11: ピンチズームでスケールが変化する', () => {

    test('CDPのマルチタッチイベントでピンチアウト（ズームイン）できる', async ({ page, browserName }, testInfo) => {
      // CDP は Chromium 限定
      test.skip(browserName !== 'chromium', 'CDP マルチタッチは Chromium のみ対応');

      await openDiagramModal(page);

      const initialScale = await getZoomScale(page);

      // diagram-zoom-container の中心座標を取得
      const container = page.getByTestId('diagram-zoom-container');
      const box = await container.boundingBox();
      expect(box).not.toBeNull();
      const cx = Math.round(box!.x + box!.width / 2);
      const cy = Math.round(box!.y + box!.height / 2);

      // CDP セッションでピンチアウト（2本指を広げる）をシミュレート
      const client = await page.context().newCDPSession(page);

      // タッチ開始: 中心付近に2本指を置く
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { x: cx - 20, y: cy, id: 0 },
          { x: cx + 20, y: cy, id: 1 },
        ],
      });

      // 段階的に指を広げる（ピンチアウト = ズームイン）
      for (let step = 1; step <= 5; step++) {
        const offset = 20 + step * 15;
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: cx - offset, y: cy, id: 0 },
            { x: cx + offset, y: cy, id: 1 },
          ],
        });
        await page.waitForTimeout(50);
      }

      // タッチ終了
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });

      await page.waitForTimeout(300);

      const pinchScale = await getZoomScale(page);
      expect(pinchScale).toBeGreaterThan(initialScale);

      await captureEvidence(page, testInfo, 'Z-11_ピンチズーム後');
    });
  });
});
