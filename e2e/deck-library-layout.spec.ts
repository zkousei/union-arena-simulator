import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`keeps the library geometry stable with and without cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/deck-builder');
    const title = page.getByRole('combobox', { name: '作品を選択' });
    const library = title.locator('xpath=../../..');
    const availableArea = library.locator('..');
    const search = page.getByPlaceholder('カード名、特徴、テキスト、レアリティで検索...');
    await expect(title).toBeVisible();
    const area = (await availableArea.boundingBox())!;
    const initial = (await library.boundingBox())!;
    expect(Math.abs(initial.width - area.width)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath('library-empty.png') });
    const assertStable = async () => {
      const current = (await library.boundingBox())!;
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(current[key] - initial[key]), key).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    };
    await title.selectOption({ label: 'コードギアス 反逆のルルーシュ' });
    await expect(page.getByRole('button', { name: 'デッキに追加' }).first()).toBeVisible();
    await assertStable();
    await page.screenshot({ path: test.info().outputPath('library-cards.png') });
    await search.fill('no-matching-card-for-layout-check');
    await expect(page.getByText('条件に一致するカードがありません')).toBeVisible();
    await assertStable();
    await search.fill('');
    await title.selectOption('');
    await expect(page.getByRole('button', { name: 'デッキに追加' })).toHaveCount(0);
    await assertStable();
  });
}
