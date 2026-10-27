import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { WhiteHatSnapshot } from '../../../packages/contracts/src';

async function snapshot(page: Page): Promise<WhiteHatSnapshot> {
  return (await (await page.request.get('/api/rooms/current')).json()).snapshot;
}
async function portraitsReady(page: Page) {
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
}

test('Mũ Trắng: private words, full runoff, last guess, reload and small screens', async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  const contexts: BrowserContext[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
  await page.getByRole('button', { name: /Mũ Trắng/ }).click();
  await page.getByLabel('Tên hiển thị').fill('Quản trò');
  await expect(page.getByLabel('Số người bị loại mỗi vòng')).toHaveValue('1');
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/rooms') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo phòng →', exact: true }).click();
  const { roomCode, password } = await (await created).json();
  try {
    const players: Array<{ id: string; name: string; page: Page }> = [];
    const baseURL = new URL('/', page.url()).href;
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 740 } });
      contexts.push(context);
      const guest = await context.newPage();
      const name = `Người chơi ${i + 1}`;
      if (i === 0) {
        await guest.goto('/');
        await guest.getByLabel('Tên hiển thị').fill(name);
        await guest.getByLabel('Mã phòng').fill(roomCode);
        await guest.getByLabel('Mật khẩu').fill(password);
        await guest.getByRole('button', { name: 'Vào bàn →', exact: true }).click();
        await expect(guest.getByRole('heading', { name: 'MŨ TRẮNG', exact: true })).toBeVisible();
      } else {
        const response = await context.request.post('/api/rooms/join', {
          data: { roomCode, password, displayName: name },
        });
        expect(response.ok()).toBe(true);
        await guest.goto('/');
      }
      await expect(guest.getByText('Đã kết nối', { exact: true })).toBeAttached();
      players.push({ id: (await snapshot(guest)).viewerMemberId, name, page: guest });
    }
    await page.evaluate(() => document.fonts.ready);
    await portraitsReady(page);
    await page.screenshot({
      path: test.info().outputPath('secret-party-lobby-390.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await portraitsReady(page);
    await page.screenshot({
      path: test.info().outputPath('secret-party-lobby-1440.png'),
      fullPage: true,
    });
    await page.getByLabel('Từ dân thường').fill('Cà phê');
    await page.getByLabel('Từ gián điệp').fill('Trà sữa');
    await page.getByRole('button', { name: 'Lưu cấu hình và từ' }).click();
    await expect(page.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' })).toBeEnabled();
    await page.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' }).click();
    await expect.poll(async () => (await snapshot(page)).stage).toBe('description');
    const started = await snapshot(page);
    expect(started.moderator!.roles).toHaveLength(4);
    const whiteId = started.moderator!.roles.find((p) => p.role === 'white-hat')!.memberId;
    const white = players.find((p) => p.id === whiteId)!;
    for (const player of players) {
      const state = await snapshot(player.page);
      expect(state.moderator).toBeUndefined();
      expect(state.players.every((p) => !p.role)).toBe(true);
      expect(await player.page.getByText('Cà phê', { exact: true }).count()).toBe(0);
    }
    for (let turn = 0; turn < 4; turn++) {
      const current = await snapshot(page);
      const actor = players.find((p) => p.id === current.actingMemberId)!;
      await expect(actor.page.getByRole('button', { name: 'Gửi mô tả' })).toBeEnabled();
      await actor.page.getByLabel('Mô tả của bạn').fill(`Hương vị ${turn + 1}`);
      if (turn === 0)
        await actor.page.screenshot({
          path: test.info().outputPath('secret-party-description.png'),
          fullPage: true,
        });
      await actor.page.getByRole('button', { name: 'Gửi mô tả' }).click();
      await expect.poll(async () => (await snapshot(page)).descriptions.length).toBe(turn + 1);
    }
    await page.getByRole('button', { name: 'Mở bỏ phiếu' }).click();
    for (let ballot = 0; ballot < 2; ballot++) {
      await expect
        .poll(async () => (await snapshot(page)).stage)
        .toBe(ballot ? 'revote' : 'voting');
      if (ballot === 0) {
        for (const width of [320, 360, 390, 430, 1280]) {
          await players[0].page.setViewportSize({ width, height: 844 });
          await portraitsReady(players[0].page);
          expect(
            await players[0].page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          if (width === 320 || width === 1280)
            await players[0].page.screenshot({
              path: test.info().outputPath(`white-vote-${width}.png`),
              fullPage: true,
            });
        }
      }
      for (let i = 0; i < players.length; i++) {
        const voter = players[i];
        const target = players[(i + 1) % players.length];
        await voter.page.getByRole('checkbox', { name: target.name, exact: true }).check();
        await voter.page.getByRole('button', { name: 'Gửi phiếu', exact: true }).click();
        if (i === 0) {
          const own = await snapshot(voter.page);
          expect(own.ownBallot).toEqual([target.id]);
          expect((await snapshot(page)).ballotResults).toHaveLength(ballot);
        }
      }
    }
    await expect.poll(async () => (await snapshot(page)).stage).toBe('tie-break');
    await page.getByRole('checkbox', { name: white.name, exact: true }).check();
    await page.getByRole('button', { name: 'Chốt người bị loại' }).click();
    await expect.poll(async () => (await snapshot(page)).stage).toBe('last-guess');
    const before = await snapshot(white.page);
    expect(before.players.find((p) => p.memberId === whiteId)!.role).toBeUndefined();
    expect(before.legalActions.canChat).toBe(false);
    expect(before.ballotResults).toHaveLength(2);
    await white.page.reload();
    await expect(white.page.getByRole('heading', { name: 'Cơ hội đoán cuối' })).toBeVisible();
    expect((await snapshot(white.page)).deadlineAt).toBe(before.deadlineAt);
    await white.page.screenshot({
      path: test.info().outputPath('secret-party-last-guess.png'),
      fullPage: true,
    });
    await expect(white.page.getByRole('button', { name: 'Gửi tin', exact: true })).toBeDisabled();
    await white.page.getByLabel('Đoán từ dân thường').fill('  CÀ   PHÊ  ');
    await white.page.getByRole('button', { name: 'Lộ diện và đoán', exact: true }).click();
    await expect(white.page.getByRole('dialog', { name: 'Xác nhận đoán từ' })).toBeVisible();
    await white.page.screenshot({
      path: test.info().outputPath('secret-party-guess-dialog.png'),
      fullPage: false,
      animations: 'disabled',
    });
    await white.page.getByRole('button', { name: 'Xác nhận lộ diện và đoán' }).click();
    await expect(page.getByRole('status', { name: 'Kết quả ván' })).toContainText(
      `${white.name} thắng!`,
    );
    const finished = await snapshot(page);
    expect(finished.result!.winnerMemberIds).toEqual([whiteId]);
    expect(finished.players.filter((p) => !p.isModerator).every((p) => p.role)).toBe(true);
    await expect(page.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' })).toBeDisabled();
    await page.screenshot({ path: test.info().outputPath('white-result.png'), fullPage: true });
    await page.getByRole('button', { name: 'Luật chơi', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Luật Mũ Trắng' })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('secret-party-rules.png'),
      fullPage: false,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
