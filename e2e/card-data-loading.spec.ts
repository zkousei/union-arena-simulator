import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const madokaRecipe = JSON.parse(readFileSync(new URL('../src/services/__tests__/fixtures/tcg-plus-madoka-recipe.json', import.meta.url), 'utf8'));
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

for (const width of [1280, 390]) {
  test(`repairs cached promo type and printed stats in the library and saved deck at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem('UA_CUSTOM_CARDS', JSON.stringify([{
      code: 'UAPR/BTR-P-001', name: 'ロボコ', title: '僕とロボコ', titleCode: 'BTR',
      cardType: 'ACTION_POINT', color: 'COLORLESS', bp: 9999, hasBpPlus: true, apCost: 9,
      reqEnergy: 9, genEnergy: 9, traits: [], triggers: [], effectText: '',
    }])));
    await page.goto('/deck-builder');
    await page.getByRole('combobox', { name: '作品を選択' }).selectOption({ label: '僕とロボコ' });
    await page.getByPlaceholder('カード名、特徴、テキスト、レアリティで検索...').fill('UAPR/BTR-P-001');
    await expect(page.getByRole('button', { name: 'デッキに追加' })).toHaveCount(1);
    await expect(page.getByText('[ACTION_POINT]', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'デッキに追加' }).click();
    if (width === 390) await page.getByRole('button', { name: /現在のデッキ/ }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('union_arena_saved_decks') || '[]'));
    expect(stored[0].items[0].card.cardType).toBe('CHARACTER');
    expect(stored[0].items[0].card.color).toBe('YELLOW');
    expect(stored[0].items[0].card.name).toBe('ロボコ（本格SFアクションの世界線）');
    expect(stored[0].items[0].card.effectText).toContain('このカードは〈ロボコ〉としても扱う。');
    expect(stored[0].items[0].card).toMatchObject({ bp: 4000, hasBpPlus: false, apCost: 2, reqEnergy: 5, genEnergy: 1 });
    await page.screenshot({ path: test.info().outputPath('promo-type-repaired.png') });
  });

  test(`TCG+ automatically selects regular printings for the Madoka recipe at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/api/tcg-plus/**', (route) => route.fulfill({ json: route.request().url().includes('/url_code?') ?
      { success: { code: 0, game_title_id: 1, url_code: 'fixture' } } :
      { success: { code: 0, main_deck: madokaRecipe } } }));
    await page.goto('/deck-builder');
    const original = await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'));
    await page.getByRole('button', { name: '公式から取得' }).click();
    const input = page.getByPlaceholder('https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn');
    await input.fill('fixture123');
    await page.getByRole('button', { name: 'レシピを取得' }).click();
    await expect(page.getByText('レシピ取得成功 (コード: fixture123)')).toBeVisible();
    await expect(page.getByText('合計 50 枚 (15 種)')).toBeVisible();
    await expect(input).toHaveValue('fixture123');
    await expect(page.getByRole('button', { name: 'レシピを取得' })).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'))).toBe(original);
    await page.getByRole('button', { name: 'このデッキを作成', exact: true }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('union_arena_saved_decks') || '[]'));
    expect(stored[0].items).toHaveLength(15);
    expect(stored[0].items.reduce((sum: number, item: { count: number }) => sum + item.count, 0)).toBe(50);
    const codes = stored[0].items.map((item: { card: { code: string } }) => item.card.code);
    expect(codes).toContain('UA31BT/MMM-1-002');
    expect(codes).toContain('UA31BT/MMM-1-007');
    expect(codes).toContain('EX16BT/MMM-2-003');
    expect(codes.some((code: string) => code.startsWith('UAPR/'))).toBe(false);
    await page.screenshot({ path: test.info().outputPath('tcg-deck-created.png') });
  });
}

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

for (const width of [1280, 390]) {
  test(`shows and filters official multi-color requirements at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/deck-builder');
    await page.getByRole('combobox', { name: '作品を選択' }).selectOption({ label: '怪獣８号' });
    await page.getByPlaceholder('カード名、特徴、テキスト、レアリティで検索...').fill('UAPR/KJ8-P-001');
    for (const color of ['RED', 'BLUE', 'YELLOW', 'GREEN', 'PURPLE']) {
      await page.getByRole('combobox').nth(1).selectOption(color);
      await expect(page.getByRole('button', { name: 'デッキに追加' })).toHaveCount(1);
    }
    const energy = page.getByTitle('必要エナジー: 赤／青／黄／緑／紫 4');
    await expect(energy).toBeVisible();
    await energy.click();
    const dialog = page.getByRole('dialog', { name: 'カード情報詳細' });
    await expect(dialog).toContainText('必要色: 赤／青／黄／緑／紫');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('multi-color-requirement.png') });
    await dialog.getByTitle('閉じる (Esc)').click();
    await expect(dialog).toHaveCount(0);
  });

  test(`retries a failed TCG+ request without changing the deck at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    let fail = true;
    let thirdPartyRequests = 0;
    await page.route('**/api.allorigins.win/**', route => { thirdPartyRequests++; return route.abort(); });
    await page.route('**/api/tcg-plus/**', route => {
      if (fail) return route.fulfill({ status: 503, body: 'Service unavailable' });
      return route.fulfill({ json: route.request().url().includes('/url_code?') ?
        { success: { code: 200, game_title_id: 9, url_code: 'fixture!!!' } } :
        { success: { code: 200, main_deck: madokaRecipe } } });
    });
    await page.goto('/deck-builder');
    const original = await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'));
    await page.getByRole('button', { name: '公式から取得' }).click();
    await page.getByPlaceholder('https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn').fill('ejRrm86RAhAD5G6Z');
    await page.getByRole('button', { name: 'レシピを取得' }).click();
    await expect(page.getByRole('alert')).toContainText('HTTP 503');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('tcg-network-error.png') });
    await expect(page.getByRole('button', { name: 'レシピを取得' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'このデッキを作成' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'))).toBe(original);
    fail = false;
    await page.getByRole('button', { name: 'レシピを取得' }).click();
    await expect(page.getByText('合計 50 枚 (15 種)')).toBeVisible();
    expect(thirdPartyRequests).toBe(0);
  });

  test(`blocks unknown TCG+ cards and retries without changing a deck at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem('UA_CUSTOM_CARDS', JSON.stringify([{
      code: 'UAPR/NEW-1-999', name: '過去の補完カード', title: '未知の作品', titleCode: 'NEW',
      cardType: 'CHARACTER', color: 'GREEN', bp: 1000, apCost: 1,
      reqEnergy: 1, genEnergy: 1, traits: [], triggers: [], effectText: '',
    }])));
    let unknown = true;
    await page.route('**/api/tcg-plus/**', (route) => route.fulfill({ json: route.request().url().includes('/url_code?') ?
      { success: { code: 0, game_title_id: 1, url_code: 'fixture' } } :
      { success: { code: 0, main_deck: unknown ? [{ ...madokaRecipe[0], card_number: 'UAPR/NEW-1-999' }] : madokaRecipe } } }));
    await page.goto('/deck-builder');
    const original = await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'));
    await page.getByRole('button', { name: '公式から取得' }).click();
    await page.getByPlaceholder('https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn').fill('fixture123');
    await page.getByRole('button', { name: 'レシピを取得' }).click();
    await expect(page.getByRole('alert')).toContainText('UAPR/NEW-1-999');
    await expect(page.getByRole('button', { name: 'このデッキを作成' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('union_arena_saved_decks'))).toBe(original);
    unknown = false;
    await page.getByRole('button', { name: 'レシピを取得' }).click();
    await expect(page.getByText('合計 50 枚 (15 種)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'このデッキを作成' })).toBeEnabled();
  });
}
