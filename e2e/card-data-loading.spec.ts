import { expect, test } from '@playwright/test';

// Match the fetched asset, not Vite's ?url module used to resolve its URL.
const isCardAsset = (url: URL) => /\/officialCards(?:-[\w-]+)?\.json$/.test(url.pathname) &&
  !url.searchParams.has('url') && !url.searchParams.has('import');

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 500 }]) {
  test(`retries card loading without changing stored decks at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const backup = JSON.stringify([
      { id: 'old-official', name: '保持するデッキ', titleCode: 'CGH', items: [{ card: { code: 'UA01BT/CGH-1-001' }, count: 1 }], updatedAt: 1 },
    ]);
    await page.addInitScript((value) => localStorage.setItem('union_arena_saved_decks', value), backup);
    let requests = 0;
    await page.route(isCardAsset, (route) => {
      requests++;
      return requests === 1 ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue();
    });
    await page.goto('/deck-builder');
    await expect(page.getByRole('alert')).toContainText('起動に必要なデータを読み込めませんでした');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'))).toBe(backup);
    const retry = page.getByRole('button', { name: '再試行', exact: true });
    await expect(retry).toBeInViewport();
    await retry.click();
    if (viewport.width === 390) await page.getByRole('button', { name: /現在のデッキ/ }).click();
    await expect(page.getByPlaceholder('デッキ名を入力...')).toHaveValue('保持するデッキ', { timeout: 15_000 });
    expect(await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'))).toBe(backup);
    expect(requests).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('waits for the card asset before mounting the app and fetches it only once', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  await page.route(isCardAsset, async (route) => {
    requests++;
    await held;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('カードデータを読み込み中');
  await expect(page.getByRole('heading', { name: /Web Simulator/ })).toHaveCount(0);
  release();
  await expect(page.getByRole('banner').getByRole('heading', { name: /Web Simulator/ })).toBeVisible();
  await page.getByRole('link', { name: 'デッキ構築' }).click();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
  expect(requests).toBe(1);
});

test('can reload when the application module fails after the card asset loads', async ({ page }) => {
  let requests = 0;
  await page.route((url) => /\/(?:src\/App\.tsx|assets\/App-[\w-]+\.js)$/.test(url.pathname), (route) => {
    requests++;
    return requests === 1 ? route.abort() : route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('起動に必要なデータを読み込めませんでした');
  await page.getByRole('button', { name: '再読み込み', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('heading', { name: /Web Simulator/ })).toBeVisible();
});
