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
