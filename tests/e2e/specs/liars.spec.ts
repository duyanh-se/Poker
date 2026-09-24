import { expect, test } from '@playwright/test';

test('two players start a Bài nói dối round and publish a face-down claim', async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
  await page.getByRole('button', { name: /Bài nói dối/ }).click();
  await page.getByLabel('Tên hiển thị').fill('Chủ nói dối');
  await page.getByLabel('Số mạng ban đầu').fill('2');
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/api/rooms') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo phòng →', exact: true }).click();
  const { roomCode, password } = await (await created).json();

  const guestContext = await browser.newContext({ viewport: { width: 844, height: 390 } });
  try {
    const guest = await guestContext.newPage();
    await guest.goto('/');
    await guest.getByLabel('Tên hiển thị').fill('Khách nói dối');
    await guest.getByLabel('Mã phòng').fill(roomCode);
    await guest.getByLabel('Mật khẩu').fill(password);
    await guest.getByRole('button', { name: 'Vào bàn →', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Bắt đầu trận', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Bắt đầu trận', exact: true }).click();
    const dealing = (await (await page.request.get('/api/rooms/current')).json()).snapshot;
    expect(dealing.transition.kind).toBe('deal');
    expect(dealing.deadlineAt).toBeUndefined();
    const guestDealing = (await (await guest.request.get('/api/rooms/current')).json()).snapshot;
    expect(guestDealing.transition.id).toBe(dealing.transition.id);
    await page.reload();
    await expect(page.getByText(/^Bài bàn:/)).toBeVisible();
    await expect(guest.getByText(/^Bài bàn:/)).toBeVisible();

    await expect
      .poll(
        async () =>
          (await page.getByText(/LƯỢT CỦA BẠN/).count()) +
          (await guest.getByText(/LƯỢT CỦA BẠN/).count()),
      )
      .toBe(1);

    const actor = (await page.getByText(/LƯỢT CỦA BẠN/).count()) ? page : guest;
    const live = (await (await actor.request.get('/api/rooms/current')).json()).snapshot;
    expect(live.deadlineAt - live.serverTime).toBeGreaterThan(175000);
    await actor.getByRole('button', { name: 'Xem bài' }).click();
    await actor.locator('.liar-fan .liar-card:not([disabled])').first().click();
    await actor.getByRole('button', { name: /^Đánh úp 1 lá/ }).click();
    await expect(page.getByText(/tuyên bố 1 lá/)).toBeVisible();
    await expect(guest.getByText(/tuyên bố 1 lá/)).toBeVisible();
    const challenger = actor === page ? guest : page;
    await challenger.getByRole('button', { name: 'NÓI DỐI!', exact: true }).click();
    const announced = (await (await challenger.request.get('/api/rooms/current')).json()).snapshot;
    expect(announced.transition.kind).toBe('challenge');
    expect(announced.result).toBeUndefined();
    expect(announced.challengeReveal).toBeUndefined();
    await expect(page.getByRole('status', { name: 'Kết quả vòng' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bắt đầu vòng tiếp theo' })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Bắt đầu vòng tiếp theo' })).toBeEnabled();
    await page.getByRole('button', { name: 'Lời mời', exact: true }).click();
    await expect(page.getByText(password, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    await expect(page.getByText(password, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Lời mời', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Bắt đầu vòng tiếp theo' }).click();
    await expect(page.getByRole('status', { name: 'Kết quả vòng' })).toHaveCount(0);
  } finally {
    await guestContext.close();
  }
});
