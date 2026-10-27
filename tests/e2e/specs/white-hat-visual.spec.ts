import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { WhiteHatSnapshot } from '../../../packages/contracts/src';

async function state(page: Page): Promise<WhiteHatSnapshot> {
  return (await (await page.request.get('/api/rooms/current')).json()).snapshot;
}

test('Secret Party: twelve players, long names, keyboard voting and reduced motion', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const contexts: BrowserContext[] = [];
  await page.setViewportSize({ width: 1440, height: 1000 });
  const created = await page.request.post('/api/rooms', {
    data: { gameType: 'white-hat', displayName: 'Quản trò cả hội' },
  });
  expect(created.ok()).toBe(true);
  const { roomCode, password } = await created.json();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MŨ TRẮNG', exact: true })).toBeVisible();
  const baseURL = new URL('/', page.url()).href;
  const players: Array<{ id: string; name: string; page: Page }> = [];
  try {
    for (let i = 0; i < 12; i++) {
      const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
      contexts.push(context);
      const name = `Nguyễn Hoàng Minh Anh ${i + 1}`;
      const response = await context.request.post('/api/rooms/join', {
        data: { roomCode, password, displayName: name },
      });
      expect(response.ok()).toBe(true);
      const joined = await response.json();
      const guest = await context.newPage();
      await guest.goto('/');
      await expect(guest.locator('.wh-game')).toBeVisible();
      players.push({ id: joined.snapshot.viewerMemberId, name, page: guest });
    }
    await expect
      .poll(async () => (await state(page)).players.filter((p) => p.connected).length)
      .toBe(13);
    await expect(page.locator('.wh-player')).toHaveCount(12);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(
        () =>
          page
            .locator('.wh-player .wh-avatar img')
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  (image as HTMLImageElement).complete &&
                  (image as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        { timeout: 15000 },
      )
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath('twelve-lobby-1440.png'),
      fullPage: true,
    });
    await page.getByLabel('Từ dân thường').fill('Máy bay');
    await page.getByLabel('Từ gián điệp').fill('Tàu hỏa');
    await page.getByRole('button', { name: 'Lưu cấu hình và từ' }).click();
    await expect(page.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' })).toBeEnabled();
    await page.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' }).click();
    for (let turn = 0; turn < 12; turn++) {
      await expect.poll(async () => (await state(page)).descriptions.length).toBe(turn);
      const current = await state(page);
      const actor = players.find((p) => p.id === current.actingMemberId)!;
      await actor.page.getByLabel('Mô tả của bạn').fill(`Đi xa ${turn + 1}`);
      await actor.page.getByRole('button', { name: 'Gửi mô tả', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Mở bỏ phiếu', exact: true }).click();
    const voter = players[0].page;
    await expect(voter.getByRole('button', { name: 'Gửi phiếu', exact: true })).toBeVisible();
    await voter.emulateMedia({ reducedMotion: 'reduce' });
    const candidate = voter.getByRole('checkbox', { name: players[1].name, exact: true });
    await candidate.focus();
    await voter.keyboard.press('Space');
    await expect(candidate).toBeChecked();
    await expect(voter.getByRole('button', { name: 'Gửi phiếu', exact: true })).toBeEnabled();
    const identityCount = await voter
      .locator('.wh-player .wh-avatar')
      .evaluateAll((nodes) => new Set(nodes.map((n) => n.getAttribute('data-avatar'))).size);
    expect(identityCount).toBe(12);
    for (const width of [320, 390, 430, 1280, 1440]) {
      await voter.setViewportSize({ width, height: 900 });
      await expect
        .poll(
          () =>
            voter
              .locator('.wh-player .wh-avatar img')
              .evaluateAll((images) =>
                images.every(
                  (image) =>
                    (image as HTMLImageElement).complete &&
                    (image as HTMLImageElement).naturalWidth > 0,
                ),
              ),
          { timeout: 15000 },
        )
        .toBe(true);
      await expect(voter.locator('.wh-player')).toHaveCount(12);
      expect(await voter.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const overlaps = await voter.locator('.wh-player').evaluateAll((nodes) => {
        const boxes = nodes.map((node) => node.getBoundingClientRect());
        return boxes.some((a, i) =>
          boxes
            .slice(i + 1)
            .some(
              (b) =>
                Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
            ),
        );
      });
      expect(overlaps).toBe(false);
      const submit = voter.getByRole('button', { name: 'Gửi phiếu', exact: true });
      await submit.scrollIntoViewIfNeeded();
      expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const transition = await submit.evaluate((el) => getComputedStyle(el).transitionDuration);
      expect(transition.split(',').every((duration) => parseFloat(duration) === 0)).toBe(true);
      await voter.evaluate(() => window.scrollTo(0, 0));
      await voter.screenshot({
        path: test.info().outputPath(`twelve-vote-${width}.png`),
        fullPage: true,
      });
      if (width <= 430) {
        await voter.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const inputBox = await voter
          .getByRole('textbox', { name: 'Tin nhắn', exact: true })
          .boundingBox();
        const dock = await voter.locator('.wh-action-dock').boundingBox();
        expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(dock!.y);
      }
    }
    await voter.getByRole('button', { name: 'Gửi phiếu', exact: true }).click();
    await expect(voter.getByRole('heading', { name: 'Phiếu đã gửi!' })).toBeVisible();
    expect((await state(voter)).ownBallot).toEqual([players[1].id]);
    await voter.getByRole('button', { name: 'Lời mời', exact: true }).click();
    await expect(voter.getByRole('dialog', { name: 'Lời mời', exact: true })).toBeVisible();
    await voter.keyboard.press('Escape');
    await expect(voter.getByRole('dialog')).toHaveCount(0);
    await expect(voter.getByRole('button', { name: 'Lời mời', exact: true })).toBeFocused();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
