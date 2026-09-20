import { expect, test } from '@playwright/test';

test('connects two browsers, synchronizes a guest action, and hides the guest hand from the host', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  try {
    await hostPage.goto('/');
    await hostPage.getByRole('button', { name: 'P2P部屋を作成（Host）' }).first().click();
    await expect(hostPage).toHaveURL(/\/game\?host=true&room=/);

    const roomId = new URL(hostPage.url()).searchParams.get('room');
    expect(roomId).toBeTruthy();

    await guestPage.goto(`/game?host=false&room=${encodeURIComponent(roomId!)}`);
    await expect(hostPage.getByText('P2P接続中 (ホスト)')).toBeVisible();
    await expect(guestPage.getByText('P2P接続中 (ゲスト)')).toBeVisible();

    await guestPage.getByRole('button', { name: '① デッキを選択・セット' }).click();
    await guestPage.getByRole('button', { name: '自分のデッキにセット' }).first().click();

    await expect(guestPage.getByRole('button', { name: /手札カード:/ })).toHaveCount(7);
    await expect(guestPage.getByText(/がデッキをセットアップし、初手7枚をドローしました/)).toBeVisible();
    await expect(hostPage.getByText(/がデッキをセットアップし、初手7枚をドローしました/)).toBeVisible();

    await expect(hostPage.getByRole('button', { name: /手札カード:/ })).toHaveCount(0);
    await expect(hostPage.getByText('相手手札 (7枚)')).toBeVisible();
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
