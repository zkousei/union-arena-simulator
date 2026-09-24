import { expect, test } from '@playwright/test';

test('connects two browsers, synchronizes a guest action, and hides the guest hand from the host', async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  const spectatorPage = await spectatorContext.newPage();

  try {
    await hostPage.addInitScript(() => {
      let copiedText = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => { copiedText = text; },
          readText: async () => copiedText,
        },
      });
    });
    await hostPage.goto('/');
    await hostPage.getByRole('button', { name: 'P2P部屋を作成（Host）' }).first().click();
    await expect(hostPage).toHaveURL(/\/game\?host=true&room=/);

    const roomId = new URL(hostPage.url()).searchParams.get('room');
    expect(roomId).toMatch(/^[A-Z2-9]{6}$/);

    await hostPage.getByRole('button', { name: 'ルームコードをコピー' }).click();
    expect(await hostPage.evaluate(() => navigator.clipboard.readText())).toBe(roomId);

    await guestPage.goto('/');
    await guestPage.getByLabel('対戦ルームコード').fill(roomId!);
    await guestPage.getByRole('button', { name: '対戦に参加' }).click();
    await expect(guestPage).toHaveURL(new RegExp(`/game\\?host=false&room=${roomId}`));
    await expect(hostPage.getByText('P2P接続中 (ホスト)')).toBeVisible({ timeout: 15_000 });
    await expect(guestPage.getByText('P2P接続中 (ゲスト)')).toBeVisible({ timeout: 15_000 });

    await spectatorPage.goto('/');
    await spectatorPage.getByLabel('観戦ルームコード').fill(roomId!);
    await spectatorPage.getByRole('button', { name: '観戦を開始' }).click();
    await expect(spectatorPage).toHaveURL(new RegExp(`/game\\?spectator=true&room=${roomId}`));
    await expect(spectatorPage.getByText(/観戦中/)).toBeVisible({ timeout: 15_000 });
    await expect(spectatorPage.getByText('P2P接続中 (観戦)')).toBeVisible({ timeout: 15_000 });
    await expect(hostPage.getByTitle('ルームコードと観戦受付を管理')).toContainText('観戦者 1 / 8', {
      timeout: 15_000,
    });

    await guestPage.getByRole('button', { name: '① デッキを選択・セット' }).click();
    await guestPage.getByRole('button', { name: '自分のデッキにセット' }).first().click();

    await expect(guestPage.getByRole('button', { name: /手札カード:/ })).toHaveCount(7);
    await expect(guestPage.getByText(/がデッキをセットアップし、初手7枚をドローしました/)).toBeVisible();
    await expect(hostPage.getByText(/がデッキをセットアップし、初手7枚をドローしました/)).toBeVisible();

    await expect(hostPage.getByRole('button', { name: /手札カード:/ })).toHaveCount(0);
    await expect(hostPage.getByText('相手手札 (7枚)')).toBeVisible();
    await expect(hostPage.getByRole('button', { name: '手札を見る' })).toHaveCount(0);
    await expect(spectatorPage.getByRole('button', { name: /手札カード:/ })).toHaveCount(0);
    await expect(spectatorPage.getByText('相手手札 (7枚)')).toBeVisible();
  } finally {
    await hostContext.close();
    await guestContext.close();
    await spectatorContext.close();
  }
});

test('switches an active host to a guest from the top menu', async ({ browser }) => {
  test.setTimeout(60_000);

  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await firstPage.goto('/');
    await firstPage.getByRole('button', { name: 'P2P部屋を作成（Host）' }).first().click();
    await expect(firstPage).toHaveURL(/\/game\?host=true&room=/);

    await secondPage.goto('/');
    await secondPage.getByRole('button', { name: 'P2P部屋を作成（Host）' }).first().click();
    await expect(secondPage).toHaveURL(/\/game\?host=true&room=/);
    const destinationRoomId = new URL(secondPage.url()).searchParams.get('room');
    expect(destinationRoomId).toMatch(/^[A-Z2-9]{6}$/);

    await firstPage.getByRole('button', { name: '対戦メニュー' }).click();
    await firstPage.getByPlaceholder('ルームID（例: ABC123）').fill(destinationRoomId!);
    await firstPage.getByRole('button', { name: '参加', exact: true }).click();

    await expect(firstPage).toHaveURL(new RegExp(`/game\\?host=false&room=${destinationRoomId}`));
    await expect(firstPage.getByText('P2P接続中 (ゲスト)')).toBeVisible({ timeout: 15_000 });
    await expect(secondPage.getByText('P2P接続中 (ホスト)')).toBeVisible({ timeout: 15_000 });
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
