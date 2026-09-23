import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

const expectNoHorizontalOverflow = async (page: import('@playwright/test').Page) => {
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
};

test('switches between the card library and current deck on mobile', async ({ page }) => {
  await page.goto('/deck-builder');

  await expect(page.getByRole('link', { name: 'デッキ構築' })).toBeVisible();
  await expect(page.getByRole('button', { name: '対戦メニュー' })).toBeVisible();

  const libraryTab = page.getByRole('button', { name: 'カード一覧' });
  const deckTab = page.getByRole('button', { name: /現在のデッキ/ });
  const searchInput = page.getByPlaceholder('カード名、特徴、テキスト、レアリティで検索...');

  await expect(libraryTab).toBeVisible();
  await expect(deckTab).toBeVisible();
  await expect(searchInput).toBeVisible();
  await expect(page.getByRole('button', { name: '保存' })).toBeHidden();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'デッキに追加' }).first().click();
  await deckTab.click();

  await expect(searchInput).toBeHidden();
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
  await expect(page.getByText('1 / 50 枚')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('saves and restores a deck from the mobile deck pane', async ({ page }) => {
  await page.goto('/deck-builder');
  await page.getByRole('button', { name: /現在のデッキ/ }).click();

  const deckName = page.getByPlaceholder('デッキ名を入力...');
  await deckName.fill('モバイル保存テスト');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('デッキを保存しました！')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /現在のデッキ/ }).click();
  await expect(deckName).toHaveValue('モバイル保存テスト');
});

test('opens with incomplete saved cards and preserves a backup of skipped decks', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('union_arena_saved_decks', JSON.stringify([
      { id: 'old-official', name: '旧デッキ', titleCode: 'CGH', items: [{ card: { code: 'UA01BT/CGH-1-001' }, count: 1 }], updatedAt: 1 },
      { id: 'broken-custom', name: '不完全なデッキ', titleCode: 'TEST', items: [{ card: { code: 'CUSTOM-1' }, count: 1 }], updatedAt: 1 },
    ]));
  });
  await page.goto('/deck-builder');

  await expect(page.getByRole('alert')).toContainText('保存データの一部を読み込めませんでした');
  await page.getByRole('button', { name: /現在のデッキ/ }).click();
  await expect(page.getByPlaceholder('デッキ名を入力...')).toHaveValue('旧デッキ');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '元データをバックアップ' }).click();
  expect((await download).suggestedFilename()).toBe('union-arena-saved-decks-backup.json');
  await page.getByRole('button', { name: '保存' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('union_arena_saved_decks')!));
  expect(saved.some((deck: { id: string }) => deck.id === 'broken-custom')).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByPlaceholder('カード名、特徴、テキスト、レアリティで検索...')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('uses corrected official triggers for a previously cached card', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('UA_CUSTOM_CARDS', JSON.stringify([{
      code: 'UA01BT/CGH-1-003', name: '紅月 カレン', title: 'コードギアス 反逆のルルーシュ', titleCode: 'CGH',
      cardType: 'CHARACTER', color: 'PURPLE', bp: 2000, apCost: 1, reqEnergy: 1, genEnergy: 1,
      traits: ['黒の騎士団'], triggers: ['ACTIVE', 'COLOR'], effectText: '',
    }]));
  });
  await page.goto('/deck-builder');
  await page.getByPlaceholder('カード名、特徴、テキスト、レアリティで検索...').fill('UA01BT/CGH-1-003');

  await expect(page.getByText('カラー', { exact: true })).toBeVisible();
  await expect(page.getByText('アクティブ', { exact: true })).toHaveCount(0);
});

test('rejects invalid JSON and persists a valid imported deck on mobile', async ({ page }) => {
  await page.goto('/deck-builder');
  await page.getByRole('button', { name: /現在のデッキ/ }).click();
  await page.getByRole('button', { name: '一覧', exact: true }).click();
  await page.getByRole('button', { name: 'JSONインポート' }).click();

  const importDialog = page.getByRole('dialog', { name: 'デッキJSONインポート' });
  const jsonInput = importDialog.getByPlaceholder('{"name": "...", "items": [...]}');
  await expect(importDialog).toBeVisible();

  await jsonInput.fill('{broken');
  await importDialog.getByRole('button', { name: 'インポート', exact: true }).click();
  await expect(importDialog.getByRole('alert')).toHaveText('JSONの解析に失敗しました。');

  await jsonInput.fill(JSON.stringify({ name: '不正デッキ', titleCode: 'TEST', items: [{ count: 1 }] }));
  await importDialog.getByRole('button', { name: 'インポート', exact: true }).click();
  await expect(importDialog.getByRole('alert')).toHaveText('無効なデッキJSONフォーマットです');

  const validDeck = {
    name: 'モバイルインポートテスト',
    titleCode: 'TEST',
    items: [
      {
        count: 1,
        card: {
          code: 'TEST-001',
          name: 'インポートカード',
          title: 'テスト作品',
          titleCode: 'TEST',
          cardType: 'CHARACTER',
          color: 'PURPLE',
          bp: 1000,
          apCost: 1,
          reqEnergy: 1,
          genEnergy: 1,
          traits: [],
          triggers: [],
          effectText: '',
        },
      },
    ],
  };
  await jsonInput.fill(JSON.stringify(validDeck));
  await importDialog.getByRole('button', { name: 'インポート', exact: true }).click();

  await expect(importDialog).toBeHidden();
  await expect(page.getByPlaceholder('デッキ名を入力...')).toHaveValue('モバイルインポートテスト');
  await expect(page.getByText('1 / 50 枚')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /現在のデッキ/ }).click();
  await expect(page.getByPlaceholder('デッキ名を入力...')).toHaveValue('モバイルインポートテスト');

  await page.getByRole('button', { name: '一覧', exact: true }).click();
  await page.getByRole('button', { name: 'JSONインポート' }).click();
  await expect(page.getByRole('dialog', { name: 'デッキJSONインポート' }).getByPlaceholder('{"name": "...", "items": [...]}')).toHaveValue('');
});
