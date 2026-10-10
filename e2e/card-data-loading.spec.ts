import { expect, test } from '@playwright/test';
const isJsonAsset = (url: URL) => url.pathname.endsWith('.json') && !url.searchParams.has('url') && !url.searchParams.has('import');
const isIndex = (url: URL) => isJsonAsset(url) && /\/index(?:-[\w-]+)?\.json$/.test(url.pathname);
const isShard = (id: string) => (url: URL) => isJsonAsset(url) && new RegExp(`/${id}(?:-[\\w-]+)?\\.json$`).test(url.pathname);

test('home loads the index without any title data, including preset introductions', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => { const url = new URL(request.url()); if (isJsonAsset(url)) requested.push(url.pathname); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'ソロで試す' })).toHaveCount(3);
  expect(requested).toHaveLength(1);
  expect(requested[0]).toMatch(/\/index(?:-[\w-]+)?\.json$/);
  await page.getByRole('link', { name: 'デッキ構築' }).click();
  await expect(page.getByRole('combobox', { name: '作品を選択' })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'デッキに追加' })).toHaveCount(0);
  expect(requested).toHaveLength(1);
  await page.getByRole('combobox', { name: '作品を選択' }).selectOption({ label: 'コードギアス 反逆のルルーシュ' });
  await expect(page.getByRole('button', { name: 'デッキに追加' }).first()).toBeVisible();
  expect(requested).toHaveLength(2);
  expect(requested[1]).toMatch(/\/CGH(?:-[\w-]+)?\.json$/);
  await page.getByRole('combobox', { name: '作品を選択' }).selectOption('');
  await page.getByRole('combobox', { name: '作品を選択' }).selectOption({ label: 'コードギアス 反逆のルルーシュ' });
  await expect(page.getByRole('button', { name: 'デッキに追加' }).first()).toBeVisible();
  expect(requested).toHaveLength(2);
});

test('a display title loads its exceptional AP shard too', async ({ page }) => {
  const shards: string[] = [];
  page.on('request', (req) => { const url = new URL(req.url()); if (isJsonAsset(url) && !isIndex(url)) shards.push(url.pathname); });
  await page.goto('/deck-builder');
  await page.getByRole('combobox', { name: '作品を選択' }).selectOption({ label: 'アイドルマスター シャイニーカラーズ' });
  await expect(page.getByRole('button', { name: 'デッキに追加' }).first()).toBeVisible();
  expect(shards).toHaveLength(2);
  expect(shards.some((path) => /\/IMS(?:-[\w-]+)?\.json$/.test(path))).toBe(true);
  expect(shards.some((path) => /\/OTHER(?:-[\w-]+)?\.json$/.test(path))).toBe(true);
});

for (const width of [1280, 390]) {
  test(`preserves a legacy saved deck on shard failure and retries at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 500 });
    const backup = JSON.stringify([{ id: 'old', name: '保持するデッキ', titleCode: 'WRONG', items: [{ card: { code: 'UA01BT/CGH-1-001' }, count: 1 }], updatedAt: 1 }]);
    await page.addInitScript((value) => localStorage.setItem('union_arena_saved_decks', value), backup);
    let requests = 0;
    await page.route(isShard('CGH'), (route) => ++requests === 1 ? route.fulfill({ status: 503, body: 'offline' }) : route.continue());
    await page.goto('/deck-builder');
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'))).toBe(backup);
    const retry = page.getByRole('button', { name: 'デッキ読込を再試行' });
    await expect(retry).toBeInViewport();
    await retry.click();
    if (width === 390) await page.getByRole('button', { name: /現在のデッキ/ }).click();
    await expect(page.getByPlaceholder('デッキ名を入力...')).toHaveValue('保持するデッキ');
    expect(await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'))).toBe(backup);
    expect(requests).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('index failure can be retried without changing stored decks', async ({ page }) => {
  let requests = 0;
  await page.route(isIndex, (route) => ++requests === 1 ? route.fulfill({ status: 503 }) : route.continue());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('起動に必要なデータを読み込めませんでした');
  await page.getByRole('button', { name: '再試行', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('heading', { name: /Web Simulator/ })).toBeVisible();
  expect(requests).toBe(2);
});

test('can reload when the application module cannot load', async ({ page }) => {
  let requests = 0;
  await page.route((url) => /\/(?:src\/App\.tsx|assets\/App-[\w-]+\.js)$/.test(url.pathname), (route) => ++requests === 1 ? route.abort() : route.continue());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('起動に必要なデータを読み込めませんでした');
  await page.getByRole('button', { name: '再読み込み', exact: true }).click();
  // A full reload recompiles lazy modules on the development server.
  await expect(page.getByRole('banner').getByRole('heading', { name: /Web Simulator/ })).toBeVisible({ timeout: 15_000 });
  expect(requests).toBe(2);
});

test('an incomplete all-title download stays hidden and retries only the failed shard', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => { const url = new URL(request.url()); if (isJsonAsset(url) && !isIndex(url)) requested.push(url.pathname); });
  let jjkRequests = 0;
  await page.route(isShard('JJK'), (route) => ++jjkRequests === 1 ? route.fulfill({ status: 503 }) : route.continue());
  await page.goto('/deck-builder');
  await page.getByRole('combobox', { name: '作品を選択' }).selectOption('ALL');
  await expect(page.getByRole('button', { name: '作品データを再試行' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'デッキに追加' })).toHaveCount(0);
  await page.getByRole('button', { name: '作品データを再試行' }).click();
  await expect(page.getByRole('button', { name: 'デッキに追加' }).first()).toBeVisible();
  expect(jjkRequests).toBe(2);
  expect(new Set(requested).size).toBe(63);
  expect(requested).toHaveLength(64);
});

test('a delayed previous title does not replace a newly selected title', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(isShard('CGH'), async (route) => { await held; await route.continue(); });
  await page.goto('/deck-builder');
  const selector = page.getByRole('combobox', { name: '作品を選択' });
  await selector.selectOption({ label: 'コードギアス 反逆のルルーシュ' });
  await expect(page.getByRole('status')).toContainText('選択した作品');
  await selector.selectOption({ label: 'HUNTER×HUNTER' });
  await expect(page.getByRole('button', { name: 'デッキに追加' }).first()).toBeVisible();
  const completed = page.waitForResponse((response) => isShard('CGH')(new URL(response.url())));
  release();
  await completed;
  await expect(selector).toHaveValue('HUNTER×HUNTER');
  await expect(page.getByText('扇 要', { exact: true })).toHaveCount(0);
});

test('TCG+ short card numbers load their official title before fallback mapping', async ({ page }) => {
  const shards: string[] = [];
  page.on('request', (request) => { const url = new URL(request.url()); if (isJsonAsset(url) && !isIndex(url)) shards.push(url.pathname); });
  await page.route('**/api/tcg-plus/**', (route) => route.fulfill({ json: route.request().url().includes('/url_code?') ?
    { success: { code: 0, game_title_id: 1, url_code: 'fixture' } } :
    { success: { code: 0, main_deck: [{ id: 1, code: 'fixture', card_number: 'JJK-1-001', card_name: '簡易情報を使わない', card_count: 2, image_url: '', cost: '0', color: '黄', type: 'キャラクター' }] } } }));
  await page.goto('/deck-builder');
  await page.getByRole('button', { name: '公式から取得' }).click();
  await page.getByPlaceholder('https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn').fill('fixture123');
  await page.getByRole('button', { name: 'レシピを取得' }).click();
  await expect(page.getByText('レシピ取得成功 (コード: fixture123)')).toBeVisible();
  await page.getByRole('button', { name: 'このデッキを作成', exact: true }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('union_arena_saved_decks') || '[]'));
  expect(stored[0].items[0].card.code).toBe('UA02BT/JJK-1-001');
  expect(stored[0].items[0].card.name).toBe('虎杖 悠仁');
  expect(stored[0].items[0].card.genEnergy).toBe(1);
  expect(stored[0].items[0].card.hasGenEnergyPlus).toBe(true);
  expect(stored[0].items[0].card.bp).toBe(1000);
  expect(shards).toHaveLength(1);
  expect(shards[0]).toMatch(/\/JJK(?:-[\w-]+)?\.json$/);
});

for (const width of [1280, 390]) {
  test(`HTML paste prepares a cold official card and preserves the input for retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 500 });
    let requests = 0;
    await page.route(isShard('CGH'), (route) => ++requests === 1 ? route.fulfill({ status: 503 }) : route.continue());
    await page.goto('/deck-builder');
    await page.getByRole('button', { name: '公式から取得' }).click();
    await page.getByRole('button', { name: 'HTML貼付' }).click();
    await page.getByPlaceholder('UA01BT/CGH-1-001', { exact: true }).fill('UA01BT/CGH-1-001');
    const html = '<h2 class="cardNameCol">扇 要</h2><dd class="cardDataTitleCol cgh"><img alt="コードギアス 反逆のルルーシュ"></dd><dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl><dl class="cardDataCol bpData"><dd class="cardDataContents">2500</dd></dl>';
    const input = page.getByPlaceholder('<div class="cardDetailCol">...');
    await input.fill(html);
    const add = page.getByRole('button', { name: 'HTMLをパースしてカードプールに追加' });
    await add.click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(input).toHaveValue(html);
    await expect(page.getByText(/パースして追加しました/)).toHaveCount(0);
    await add.click();
    await expect(page.getByText(/同梱の公式データを使用/)).toBeVisible();
    await expect(input).toHaveValue('');
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('combobox', { name: '作品を選択' }).selectOption({ label: 'コードギアス 反逆のルルーシュ' });
    await expect(page.getByRole('button', { name: '扇 要', exact: true }).first()).toBeVisible();
    expect(requests).toBe(2);
    const custom = await page.evaluate(() => JSON.parse(localStorage.getItem('UA_CUSTOM_CARDS') || '[]'));
    expect(custom.some((card: { code: string }) => card.code === 'UA01BT/CGH-1-001')).toBe(false);
  });
}

for (const width of [1280, 390]) {
  for (const recovery of ['select', 'new', 'import'] as const) {
    test(`recovers from a blocked first saved deck via ${recovery} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 500 });
      const decks = [
        { id: 'blocked', name: '取得失敗のデッキ', titleCode: 'CGH', items: [{ card: { code: 'UA01BT/CGH-1-001' }, count: 1 }], updatedAt: 1 },
        { id: 'ready', name: '別の空デッキ', titleCode: 'JJK', items: [], updatedAt: 2 },
      ];
      await page.addInitScript((value) => localStorage.setItem('union_arena_saved_decks', value), JSON.stringify(decks));
      await page.route(isShard('CGH'), (route) => route.fulfill({ status: 503 }));
      await page.goto('/deck-builder');
      await expect(page.getByRole('alert')).toBeVisible();
      let expectedName = '新規デッキ';
      if (recovery === 'select') {
        await page.getByRole('button', { name: '別の保存デッキを選択' }).click();
        await page.getByText('別の空デッキ', { exact: true }).click();
        expectedName = '別の空デッキ';
      } else if (recovery === 'new') {
        await page.getByRole('button', { name: '新規デッキ作成', exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'JSONインポート' }).click();
        expectedName = 'インポートした空デッキ';
        const dialog = page.getByRole('dialog', { name: 'デッキJSONインポート' });
        await dialog.getByRole('textbox').fill(JSON.stringify({ name: expectedName, titleCode: 'JJK', items: [] }));
        await dialog.getByRole('button', { name: 'インポート', exact: true }).click();
      }
      if (width === 390) await page.getByRole('button', { name: /現在のデッキ/ }).click();
      await expect(page.getByPlaceholder('デッキ名を入力...')).toHaveValue(expectedName);
      await expect(page.getByRole('alert')).toHaveCount(0);
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('union_arena_saved_decks')!));
      expect(stored.find((deck: { id: string }) => deck.id === 'blocked')).toEqual(decks[0]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  }
}

for (const width of [1280, 390]) {
  test(`changing deck-picker tabs cancels a slow preset and allows another selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    let release!: () => void;
    let arrived!: () => void;
    const requested = new Promise<void>((resolve) => { arrived = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route(isShard('CGH'), async (route) => { arrived(); await held; await route.continue(); });
    try {
      await page.goto('/game?mode=solo');
      await page.getByRole('button', { name: 'デッキ選択・セット', exact: true }).click();
      await page.getByRole('button', { name: 'あなたにセット', exact: true }).first().click();
      await requested;
      await page.getByRole('button', { name: /保存済みマイデッキ/ }).click();
      await expect(page.getByRole('status')).toHaveCount(0);
      await page.getByRole('button', { name: /^公式プリセット\s+\d+$/ }).click();
      await page.getByRole('button', { name: 'あなたにセット', exact: true }).nth(1).click();
      await expect(page.getByRole('button', { name: /手札カード:/ })).toHaveCount(7);
      if (width === 390) await page.getByTitle('ログを開く').click();
      const commits = page.getByText(/がデッキをセットアップし、初手7枚をドローしました/);
      await expect(commits).toHaveCount(1);
      const response = page.waitForResponse((response) => isShard('CGH')(new URL(response.url())));
      release();
      await (await response).finished();
      await expect(commits).toHaveCount(1);
      if (width === 390) await page.getByTitle('ログを閉じる').click();
      await page.getByRole('button', { name: 'デッキ選択・セット', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    } finally { release(); }
  });
}
