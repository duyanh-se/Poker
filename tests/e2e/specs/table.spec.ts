import { expect, test } from '@playwright/test';
import type { TableSnapshot } from '../../../../packages/contracts/src';

test('two browsers play, wait for host, and restore host invitation without hydration errors', async ({
  browser,
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
  await page.getByLabel('Tên hiển thị').fill('Chủ E2E');
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/api/rooms') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo phòng →', exact: true }).click();
  const { roomCode, password } = await (await created).json();
  await expect(page.getByText('● Đã kết nối', { exact: true })).toBeVisible();
  const guest = await browser.newContext();
  try {
    const other = await guest.newPage();
    other.on('pageerror', (error) => errors.push(error.message));
    await other.goto('/');
    await other.getByLabel('Tên hiển thị').fill('Khách E2E');
    await other.getByLabel('Mã phòng').fill(roomCode);
    await other.getByLabel('Mật khẩu').fill(password);
    await other.getByRole('button', { name: 'Vào bàn →' }).click();
    await expect(other.getByText('● Đã kết nối', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Quản lý', exact: true }).click();
    await page.getByRole('button', { name: 'Cấp chip cho tôi', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cấp chip', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Cấp chip', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cấp chip', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByText('● Đã kết nối', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Lời mời', exact: true }).click();
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    await expect(page.getByText(password, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Bắt đầu ván', exact: true }).click();
    await expect(page.locator('.seat-roles .dealer')).toHaveCount(1);
    await expect(page.locator('.seat-roles .small-blind')).toHaveCount(1);
    await expect(page.locator('.seat-roles .big-blind')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('live-table.png'), fullPage: true });
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
    await expect(other.getByText('Đang chờ chủ phòng bắt đầu', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kết quả ván', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await guest.close();
  }
});

for (const count of [2, 6, 9]) {
  for (const fallback of [true, false]) {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 844, height: 390 },
      { width: 667, height: 375 },
    ]) {
      test(`${fallback ? 'fallback' : '3D'} layout ${count} seats ${size.width}x${size.height}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(size);
        if (fallback)
          await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (
              ...args: Parameters<typeof original>
            ) {
              if (String(args[0]).includes('webgl')) return null;
              return original.apply(this, args);
            } as typeof original;
          });
        const snapshot: TableSnapshot = {
          gameType: 'poker',
          roomCode: 'VISUAL',
          version: 1,
          phase: 'running',
          config: { smallBlind: 5, bigBlind: 10, ante: 0 },
          viewerMemberId: 'p0',
          hostMemberId: 'p0',
          handId: 'hand',
          turnId: 'turn',
          street: 'flop',
          buttonSeat: 0,
          smallBlindSeat: count === 2 ? 0 : 1,
          bigBlindSeat: count === 2 ? 1 : 2,
          board: ['AS', 'KH', 'QD'],
          pots: [{ amount: count * 10 }],
          players: Array.from({ length: count }, (_, seat) => ({
            memberId: `p${seat}`,
            displayName: `Người chơi ${seat + 1}`,
            seat,
            stack: 990,
            contribution: 10,
            connected: true,
            folded: false,
            allIn: false,
            sittingOut: false,
            isHost: seat === 0,
            isActing: seat === 0,
            ...(seat === 0 ? { holeCards: ['JS', 'TS'] } : {}),
          })),
          legalActions: {
            actions: ['fold', 'check', 'bet', 'all-in'],
            callAmount: 0,
            minRaiseTo: 10,
            maxRaiseTo: 990,
          },
        };
        await page.route('**/api/rooms/current', (route) => route.fulfill({ json: { snapshot } }));
        await page.goto('/');
        await expect(page.locator('.seat')).toHaveCount(count);
        const uses3D = !fallback && size.width >= 1024 && size.height >= 600;
        await expect(page.getByTestId(uses3D ? 'table-3d' : 'table-2d')).toBeVisible();
        if (uses3D) await expect(page.locator('canvas')).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Check — không thêm chip', exact: true }),
        ).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);
        await page.screenshot({ path: testInfo.outputPath('table.png'), fullPage: true });
        const overlaps = await page.locator('.seat').evaluateAll((seats) => {
          const boxes = seats.map((seat) => seat.getBoundingClientRect());
          return boxes.flatMap((box, i) =>
            boxes
              .slice(i + 1)
              .filter(
                (other) =>
                  Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 &&
                  Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1,
              ),
          );
        });
        expect(overlaps).toHaveLength(0);
        if (uses3D) {
          await page
            .locator('canvas')
            .evaluate((canvas) =>
              canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
            );
          await expect(page.getByTestId('table-2d')).toBeVisible();
        }
      });
    }
  }
}
