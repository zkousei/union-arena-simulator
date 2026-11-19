import { expect, test } from '@playwright/test';

const setPresetDeck = async (page: import('@playwright/test').Page, playerName: string) => {
  await page.getByRole('button', { name: 'デッキ選択・セット' }).click();
  await page.getByRole('button', { name: `${playerName}にセット` }).first().click();
};

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`moves a face-down marker after separating its parent at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/game?mode=solo');
    await setPresetDeck(page, 'あなた');
    const hand = page.getByRole('region', { name: 'あなた の手札' });
    const characters = hand.getByRole('button', { name: /手札カード: .+ \(キャラクター\)/ });
    const slot = page.locator('#slot-player-1-energyLine-0');
    await characters.first().click();
    await page.getByRole('button', { name: 'あなた: エナジーライン 枠 1' }).click();
    await characters.first().click();
    await slot.click();
    await page.getByRole('button', { name: /【マーカー配置】裏向きで下に置く/ }).click();
    await slot.getByTitle('クリックで下敷きカード（マーカー）を確認・操作').click();
    await page.getByTitle('上のカードを手札に戻す').click();

    await expect(slot.getByText('UA', { exact: true })).toBeVisible();
    await expect(slot.locator('img')).toHaveCount(0);
    await expect(slot.locator('[draggable="true"]')).toHaveCount(1);

    let movedSlot = slot;
    if (viewport.width > 390) {
      movedSlot = page.locator('#slot-player-1-energyLine-1');
      await slot.locator('[draggable="true"]').dragTo(movedSlot);
      await expect(slot.locator('[draggable="true"]')).toHaveCount(0);
      await expect(movedSlot.getByText('UA', { exact: true })).toBeVisible();
      await expect(movedSlot.locator('img')).toHaveCount(0);
      await movedSlot.locator('[draggable="true"]').click({ button: 'right' });
    } else {
      await movedSlot.getByTitle('裏向きカードの移動メニュー').click();
    }
    await expect(page.getByText('裏向きカード', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '手札に戻す', exact: true }).click();
    await expect(movedSlot.locator('[draggable="true"]')).toHaveCount(0);
    await expect(hand.locator('[draggable="true"]')).toHaveCount(7);
  });
}

test('opens the main SPA routes directly', async ({ page }) => {
  await page.goto('/deck-builder');
  await expect(page).toHaveURL(/\/deck-builder$/);
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible();

  await page.goto('/game?mode=solo');
  await expect(page).toHaveURL(/\/game\?mode=solo$/);
  await expect(page.getByRole('button', { name: /対戦開始/ })).toBeDisabled();
});

test('shows a recovery screen when the deck-builder module cannot load', async ({ page }) => {
  await page.route('**/src/pages/DeckBuilder.tsx*', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('link', { name: 'デッキ構築' }).click();

  await expect(page).toHaveURL(/\/deck-builder$/);
  await expect(page.getByRole('alert')).toContainText('デッキビルダーを表示できませんでした');
  await expect(page.getByRole('button', { name: '再読み込み' })).toBeVisible();
});

test('completes solo setup with both preset decks and starts the game', async ({ page }) => {
  await page.goto('/game?mode=solo');

  await setPresetDeck(page, 'あなた');
  await setPresetDeck(page, '対戦相手');

  const keepButtons = page.getByRole('button', { name: 'キープ' });
  await expect(keepButtons).toHaveCount(2);
  await keepButtons.first().click();
  await keepButtons.first().click();

  await page.getByRole('button', { name: /両者のライフ7枚を一括配置/ }).click();
  const startButton = page.getByRole('button', { name: /対戦開始/ });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  await expect(page.getByText('TURN 1')).toBeVisible();
  await expect(page.getByText(/ゲームが開始されました/)).toBeVisible();
});

test('opens and closes the top-deck viewer without changing deck count', async ({ page }) => {
  await page.goto('/game?mode=solo');
  await setPresetDeck(page, 'あなた');

  await page.getByRole('button', { name: '上を見る' }).last().click();
  const topDeckMenu = page.getByRole('dialog', { name: '上から確認メニュー' });
  await expect(topDeckMenu).toBeVisible();
  await topDeckMenu.getByRole('button', { name: '3枚', exact: true }).click();
  await expect(page.getByRole('heading', { name: '山札の上から確認中 (3 枚)' })).toBeVisible();
  await page.getByRole('button', { name: '完了（そのまま閉じる）' }).click();

  await expect(page.getByRole('heading', { name: /山札の上から確認中/ })).toHaveCount(0);
  await expect(page.getByText('43 枚').last()).toBeVisible();
});
