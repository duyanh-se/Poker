import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, video: 'on' });
async function menu(page: Page, name: string) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}
for (const game of ['poker', 'liars-deck']) {
  test(`portrait two-client ${game} round and reload`, async ({ page, browser }, info) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
    if (game === 'liars-deck') await page.getByRole('button', { name: /Bài nói dối/ }).click();
    await page.getByLabel('Tên hiển thị').fill('Chủ mobile');
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/rooms') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Tạo phòng →' }).click();
    const { roomCode, password } = await (await response).json();
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
    try {
      const guest = await context.newPage();
      await guest.goto('/');
      await guest.getByLabel('Tên hiển thị').fill('Khách mobile');
      await guest.getByLabel('Mã phòng').fill(roomCode);
      await guest.getByLabel('Mật khẩu').fill(password);
      await guest.getByRole('button', { name: 'Vào bàn →' }).click();
      await expect(page.getByText('● Đã kết nối', { exact: true })).toBeVisible();
      await expect(guest.getByText('● Đã kết nối', { exact: true })).toBeVisible();
      await menu(page, 'Chat');
      await page.getByLabel('Tin nhắn', { exact: true }).fill('<b>Xin chào</b>');
      await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
      await expect(page.getByText('<b>Xin chào</b>', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await guest.getByRole('button', { name: 'Menu', exact: true }).click();
      await guest.getByRole('button', { name: /^Chat/ }).click();
      await expect(guest.getByText('<b>Xin chào</b>', { exact: true })).toBeVisible();
      await expect(guest.getByRole('dialog', { name: 'Chat phòng' })).toHaveCSS('opacity', '1');
      await guest.screenshot({ path: info.outputPath('chat.png'), fullPage: true });
      await guest.keyboard.press('Escape');
      if (game === 'poker') {
        await menu(page, 'Quản lý');
        await page.getByRole('button', { name: 'Cấp chip cho tôi', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Cấp chip', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: 'Cấp chip', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Cấp chip', exact: true })).toBeEnabled();
        await page.keyboard.press('Escape');
      }
      await page.reload();
      await menu(page, 'Chat');
      await expect(page.getByText('<b>Xin chào</b>', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', {
          name: game === 'poker' ? 'Bắt đầu ván' : 'Bắt đầu trận',
          exact: true,
        }),
      ).toBeEnabled();
      await page
        .getByRole('button', {
          name: game === 'poker' ? 'Bắt đầu ván' : 'Bắt đầu trận',
          exact: true,
        })
        .click();
      await expect
        .poll(async () => {
          const s = (await (await page.request.get('/api/rooms/current')).json()).snapshot;
          return !!s.deadlineAt;
        })
        .toBe(true);
      const state = (await (await page.request.get('/api/rooms/current')).json()).snapshot;
      const actor = (
        game === 'poker' ? state.legalActions : state.actingMemberId === state.viewerMemberId
      )
        ? page
        : guest;
      await actor.screenshot({ path: info.outputPath('turn.png'), fullPage: true });
      if (game === 'poker') {
        const toggle = await actor
          .getByRole('button', { name: 'Xem bài riêng', exact: true })
          .boundingBox();
        const handName = await actor.locator('.private-hand-name').boundingBox();
        expect(toggle).not.toBeNull();
        expect(handName).not.toBeNull();
        expect(toggle!.x + toggle!.width).toBeLessThanOrEqual(handName!.x + 1);
        await actor
          .locator('.action-buttons')
          .getByRole('button', { name: /^(Cược|Tăng lên)/ })
          .click();
        await expect(actor.getByRole('dialog', { name: 'Cược / Tăng' })).toBeVisible();
        const initial = Number(await actor.getByLabel('Mức cược', { exact: true }).inputValue());
        await actor.getByRole('button', { name: '+5', exact: true }).click();
        await actor.getByRole('button', { name: '+20', exact: true }).click();
        await expect(actor.getByLabel('Mức cược', { exact: true })).toHaveValue(
          String(initial + 25),
        );
        await actor.screenshot({ path: info.outputPath('wager.png'), fullPage: true });
        await actor.getByRole('button', { name: 'Xác nhận cược', exact: true }).click();
        const opponent = actor === page ? guest : page;
        await expect(opponent.getByRole('button', { name: 'Bỏ bài', exact: true })).toBeEnabled();
        await opponent.getByRole('button', { name: 'Bỏ bài', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Bắt đầu ván', exact: true })).toBeEnabled();
      } else {
        await actor.getByRole('button', { name: 'Xem bài', exact: true }).click();
        await actor.locator('.liar-fan .liar-card:not([disabled])').first().click();
        await actor.getByRole('button', { name: /^Đánh úp 1 lá/ }).click();
        const challenger = actor === page ? guest : page;
        await expect(
          challenger.getByRole('button', { name: 'NÓI DỐI!', exact: true }),
        ).toBeEnabled();
        await challenger.getByRole('button', { name: 'NÓI DỐI!', exact: true }).click();
        await expect(
          page.getByRole('button', { name: 'Bắt đầu vòng tiếp theo', exact: true }),
        ).toBeEnabled({ timeout: 15000 });
        await page.screenshot({ path: info.outputPath('result.png'), fullPage: true });
        await page.getByRole('button', { name: 'Bắt đầu vòng tiếp theo', exact: true }).click();
      }
      await menu(page, 'Lời mời');
      await expect(page.getByText(password, { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).click();
      await expect(page.getByText(password, { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
    } finally {
      await context.close();
    }
  });
}
