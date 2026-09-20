import { expect, test } from '@playwright/test';

const setPresetDeck = async (page: import('@playwright/test').Page, playerName: string) => {
  await page.getByRole('button', { name: 'デッキ選択・セット' }).click();
  await page.getByRole('button', { name: `${playerName}にセット` }).first().click();
};

const startSoloGame = async (page: import('@playwright/test').Page) => {
  await setPresetDeck(page, 'あなた');
  await setPresetDeck(page, '対戦相手');

  const keepButtons = page.getByRole('button', { name: 'キープ' });
  await keepButtons.first().click();
  await keepButtons.first().click();
  await page.getByRole('button', { name: /両者のライフ7枚を一括配置/ }).click();
  await page.getByRole('button', { name: /対戦開始/ }).click();
};

const expectNoHorizontalOverflow = async (page: import('@playwright/test').Page) => {
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
};

const expectFieldSlotsWithinViewport = async (page: import('@playwright/test').Page) => {
  const firstSlot = await page.locator('#slot-player-1-frontLine-0').boundingBox();
  const lastSlot = await page.locator('#slot-player-1-frontLine-3').boundingBox();
  const viewport = page.viewportSize();

  expect(firstSlot).not.toBeNull();
  expect(lastSlot).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(firstSlot!.x).toBeGreaterThanOrEqual(0);
  expect(lastSlot!.x + lastSlot!.width).toBeLessThanOrEqual(viewport!.width);
};

const expectCompactHeader = async (page: import('@playwright/test').Page) => {
  const header = await page.locator('header').boundingBox();

  expect(header).not.toBeNull();
  expect(header!.height).toBeLessThanOrEqual(64);
};

const expectDialogWithinViewport = async (
  page: import('@playwright/test').Page,
  dialog: import('@playwright/test').Locator
) => {
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
};

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'portrait tablet', width: 768, height: 1024 },
]) {
  test(`keeps the preparing board usable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/game?mode=solo');

    await expect(page.getByTitle('ログを開く')).toBeVisible();
    await expectCompactHeader(page);
    await expectFieldSlotsWithinViewport(page);
    await expectNoHorizontalOverflow(page);
  });
}

test('keeps the existing desktop log layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/game?mode=solo');

  await expect(page.getByTitle('ログを閉じる')).toBeVisible();
  await expectCompactHeader(page);
  await expectFieldSlotsWithinViewport(page);
  await expectNoHorizontalOverflow(page);
});

test('uses the desktop-style board on a landscape tablet', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/game?mode=solo');

  await expect(page.getByTitle('ログを閉じる')).toBeVisible();
  await expectCompactHeader(page);
  await expectFieldSlotsWithinViewport(page);
  await expectNoHorizontalOverflow(page);
});

test('opens the action log as a drawer on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/game?mode=solo');

  await page.getByTitle('ログを開く').click();
  await expect(page.getByTitle('ログを閉じる')).toBeVisible();
  await expect(page.getByText('行動ログ')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByTitle('ログを閉じる').click();
  await expect(page.getByTitle('ログを開く')).toBeVisible();
});

test('plays a card and completes the first turn on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/game?mode=solo');

  await startSoloGame(page);

  await expect(page.getByText('TURN 1')).toBeVisible();
  for (const phaseName of ['スタート', '移動', 'メイン', 'アタック (不可)', 'エンド']) {
    const phaseButton = page.getByRole('button', { name: phaseName, exact: true });
    const phaseBox = await phaseButton.boundingBox();
    expect(phaseBox).not.toBeNull();
    expect(phaseBox!.height).toBeLessThanOrEqual(36);
  }
  const advanceButton = page.getByRole('button', { name: /移動へ/ });
  await expect(advanceButton).toBeVisible();
  await advanceButton.click();
  await page.getByRole('button', { name: /メインへ/ }).click();

  const ownHand = page.getByRole('region', { name: 'あなた の手札' });
  const characterCard = ownHand.getByRole('button', {
    name: /手札カード: .+ \(キャラクター\)/,
  }).first();
  const cardLabel = await characterCard.getAttribute('aria-label');
  const cardName = cardLabel?.match(/^手札カード: (.+) \(キャラクター\)$/)?.[1];
  expect(cardName).toBeTruthy();

  await characterCard.click();
  await expect(page.getByText('手札選択中:')).toBeVisible();
  await page.getByRole('button', { name: 'あなた: エナジーライン 枠 1' }).click();

  const placedSlot = page.locator('#slot-player-1-energyLine-0');
  await expect(placedSlot.getByAltText(cardName!)).toBeVisible();
  const restToggle = placedSlot.getByTitle(/(レスト|アクティブ)にする/);
  const toggleTitle = await restToggle.getAttribute('title');
  await restToggle.click();
  if (toggleTitle?.startsWith('アクティブ')) {
    await expect(placedSlot.getByText('REST')).toBeHidden();
  } else {
    await expect(placedSlot.getByText('REST')).toBeVisible();
  }

  await page.getByRole('button', { name: /エンドへ/ }).click();
  await page.getByRole('button', { name: /ターン終了/ }).click();
  await expect(page.getByText('TURN 2')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('keeps the main game dialogs reachable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/game?mode=solo');
  await startSoloGame(page);

  const ownHand = page.getByRole('region', { name: 'あなた の手札' });
  await ownHand.getByTitle('カード詳細を確認 (拡大表示)').first().click();
  const cardDialog = page.getByRole('dialog', { name: 'カード情報詳細' });
  await expect(cardDialog).toBeVisible();
  await expectDialogWithinViewport(page, cardDialog);
  await cardDialog.getByRole('button', { name: /閉じる/ }).first().click();

  await page.getByRole('button', { name: '上を見る' }).last().click();
  const topDeckMenu = page.getByRole('dialog', { name: '上から確認メニュー' });
  await expect(topDeckMenu).toBeVisible();
  await topDeckMenu.getByRole('button', { name: '3枚', exact: true }).click();
  const topDeckDialog = page.getByRole('dialog', { name: /山札の上から確認中/ });
  await expect(topDeckDialog).toBeVisible();
  await expectDialogWithinViewport(page, topDeckDialog);
  await topDeckDialog.getByRole('button', { name: '完了（そのまま閉じる）' }).click();

  await page.getByTitle('クリックでライフ一覧・選択モーダルを開く').last().click();
  const lifeDialog = page.getByRole('dialog', { name: /自分ライフの選択・操作/ });
  await expect(lifeDialog).toBeVisible();
  await expectDialogWithinViewport(page, lifeDialog);
  await lifeDialog.getByRole('button', { name: /閉じる/ }).click();

  await expectNoHorizontalOverflow(page);
});
