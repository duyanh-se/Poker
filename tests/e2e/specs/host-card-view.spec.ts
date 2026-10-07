import { expect, test } from '@playwright/test';
import type { TableSnapshot } from '../../../../packages/contracts/src';

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`all dealt hands remain readable at nine seats ${size.width}x${size.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Visual fixtures have no real session: block transport so a delayed server
    // rejection cannot conceal cards midway through the layout assertions.
    await page.route('**/socket.io/**', (route) => route.abort());
    const cards = [
      'AS',
      'AH',
      'KS',
      'KH',
      'QS',
      'QH',
      'JS',
      'JH',
      'TS',
      'TH',
      '9S',
      '9H',
      '8S',
      '8H',
      '7S',
      '7H',
      '6S',
      '6H',
    ];
    const snapshot: TableSnapshot = {
      gameType: 'poker',
      version: 1,
      roomCode: 'HOSTVIEW',
      handId: 'hand',
      phase: 'running',
      config: { smallBlind: 5, bigBlind: 10, ante: 0 },
      viewerMemberId: 'p0',
      hostMemberId: 'p0',
      canViewAllHoleCards: true,
      showdown: false,
      board: [],
      pots: [],
      players: Array.from({ length: 9 }, (_, seat) => ({
        memberId: `p${seat}`,
        displayName: seat === 0 ? 'Duy Anh' : `Người chơi ${seat}`,
        seat,
        stack: 100,
        contribution: 0,
        connected: true,
        folded: seat === 2 || seat === 4,
        allIn: false,
        sittingOut: false,
        isHost: seat === 0,
        isActing: false,
        holeCards: cards.slice(seat * 2, seat * 2 + 2),
      })),
    };
    await page.route('**/api/rooms/current', (route) => route.fulfill({ json: { snapshot } }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Xem tất cả bài' }).click();
    await expect(page.locator('.seats .card:not(.card-back)')).toHaveCount(18);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    const uses3D = size.width === 1440;
    await expect(page.getByTestId(uses3D ? 'table-3d' : 'table-2d')).toBeVisible();
    if (uses3D) {
      await page.locator('canvas').evaluate(async () => {
        for (let frame = 0; frame < 3; frame++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      });
    }
    if (!uses3D) {
      const stage = (await page.locator('.table-stage').boundingBox())!;
      for (const card of await page.locator('.seats .card').all()) {
        if (!(await card.isVisible())) continue;
        const box = (await card.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(stage.y);
        expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height);
      }
    }
    await page.screenshot({ path: testInfo.outputPath('nine-hands.png'), fullPage: true });
    if (size.width === 390) {
      await page.mouse.move(195, 400);
      await page.mouse.wheel(0, 350);
      await expect
        .poll(async () => {
          const card = (await page.locator('.seat[data-member="p8"] .card').first().boundingBox())!;
          const dock = (await page.locator('.play-dock').boundingBox())!;
          return card.y + card.height < dock.y;
        })
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath('nine-hands-scrolled.png'),
        fullPage: true,
      });
    }
    await page.getByRole('button', { name: 'Che tất cả bài' }).click();
    await expect(page.locator('.seats .card:not(.card-back)')).toHaveCount(0);
  });
}

test('Duy Anh host reveals all hands, conceals on blur, restores and loses access on transfer', async ({
  browser,
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const created = await page.request.post('/api/rooms', {
    data: { displayName: 'Duy Anh', smallBlind: 5, bigBlind: 10, ante: 0 },
  });
  expect(created.ok()).toBe(true);
  const { roomCode, password } = await created.json();
  const guest = await browser.newContext();
  try {
    const other = await guest.newPage();
    const joined = await other.request.post('/api/rooms/join', {
      data: { displayName: 'Khách kiểm thử', roomCode, password },
    });
    expect(joined.ok()).toBe(true);
    const guestId = (await joined.json()).snapshot.viewerMemberId;
    await other.goto('/');
    await page.goto('/');
    await expect(page.getByText('● Đã kết nối', { exact: true })).toBeVisible();
    await expect(other.getByText('● Đã kết nối', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Quản lý', exact: true }).click();
    await page.getByRole('button', { name: 'Cấp chip cho tôi', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cấp chip', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Cấp chip', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cấp chip', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Bắt đầu ván', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Xem tất cả bài' })).toBeEnabled();
    const current = async (target: typeof page): Promise<TableSnapshot> =>
      (await (await target.request.get('/api/rooms/current')).json()).snapshot;
    const hostView = await current(page);
    const guestView = await current(other);
    expect(hostView.canViewAllHoleCards).toBe(true);
    expect(hostView.players.filter((p) => p.holeCards?.length)).toHaveLength(2);
    expect(guestView.canViewAllHoleCards).toBe(false);
    expect(guestView.players.filter((p) => p.holeCards?.length)).toHaveLength(1);
    const guestCards = hostView.players.find((p) => p.memberId === guestId)!.holeCards!;
    const seat = page.locator(`.seat[data-member="${guestId}"]`);
    await expect(seat.locator('.card:not(.card-back)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem tất cả bài' }).click();
    for (const card of guestCards)
      await expect(seat.getByLabel(card, { exact: true })).toHaveCount(1);
    await expect(page.getByTestId('table-3d')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('host-3d.png'), fullPage: true });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('button', { name: 'Xem tất cả bài' })).toBeVisible();
    await expect(seat.locator('.card:not(.card-back)')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Xem tất cả bài' })).toBeEnabled();
    await expect(seat.locator('.card:not(.card-back)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem tất cả bài' }).click();
    await expect
      .poll(
        async () =>
          (await page.getByRole('button', { name: 'Bỏ bài', exact: true }).count()) +
          (await other.getByRole('button', { name: 'Bỏ bài', exact: true }).count()),
      )
      .toBe(1);
    const actor = (await page.getByRole('button', { name: 'Bỏ bài', exact: true }).count())
      ? page
      : other;
    await actor.getByRole('button', { name: 'Bỏ bài', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Bắt đầu ván', exact: true })).toBeEnabled();
    // Opening the other browser can blur the host; explicitly reveal again if needed.
    if (await page.getByRole('button', { name: 'Xem tất cả bài' }).count())
      await page.getByRole('button', { name: 'Xem tất cả bài' }).click();
    const result = await current(page);
    expect(result.showdown).toBe(false);
    for (const p of result.players) expect(p.holeCards).toHaveLength(2);
    expect((await current(other)).players.filter((p) => p.holeCards?.length)).toHaveLength(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('table-2d')).toBeVisible();
    await expect(seat.getByLabel(guestCards[0], { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('host-portrait.png'), fullPage: true });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(seat.getByLabel(guestCards[0], { exact: true })).toBeVisible();
    const cardBox = await seat.getByLabel(guestCards[0], { exact: true }).boundingBox();
    const stageBox = await page.locator('.table-stage').boundingBox();
    expect(cardBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
    await page.screenshot({ path: testInfo.outputPath('host-landscape.png'), fullPage: true });
    await page.getByRole('button', { name: 'Che tất cả bài' }).click();
    await expect(seat.locator('.card:not(.card-back)')).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Quản lý', exact: true }).click();
    await page.getByRole('button', { name: 'Chuyển chủ', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Xác nhận thao tác' })
      .getByRole('button', { name: 'Xác nhận', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Xem tất cả bài' })).toHaveCount(0);
    expect((await current(page)).canViewAllHoleCards).toBe(false);
    expect(
      (await current(page)).players.find((p) => p.memberId === guestId)?.holeCards,
    ).toBeUndefined();
  } finally {
    await guest.close();
  }
});
