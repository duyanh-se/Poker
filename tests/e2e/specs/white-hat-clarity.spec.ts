import { test, expect, type Page } from '@playwright/test';

async function contrast(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const rgb = (v: string) => v.match(/[\d.]+/g)!.map(Number);
      let bg = [255, 255, 255];
      let current: Element | null = el;
      while (current) {
        const c = rgb(getComputedStyle(current).backgroundColor);
        if ((c[3] ?? 1) === 1) {
          bg = c;
          break;
        }
        current = current.parentElement;
      }
      const lum = (c: number[]) => {
        const n = c
          .slice(0, 3)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
      };
      const a = lum(rgb(getComputedStyle(el).color)),
        b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
}
test('WhiteHat clarity: usable portraits, light dialog headers, readable chat and draft persistence', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const response = await page.request.post('/api/rooms', {
    data: { gameType: 'white-hat', displayName: 'Quản trò' },
  });
  const { roomCode, password } = await response.json();
  await page.goto('/');
  const context = await browser.newContext({
    baseURL: new URL('/', page.url()).href,
    viewport: { width: 390, height: 844 },
  });
  try {
    await context.request.post('/api/rooms/join', {
      data: { roomCode, password, displayName: 'Minh Anh' },
    });
    const guest = await context.newPage();
    await guest.goto('/');
    await page.getByRole('button', { name: 'Nhân vật', exact: true }).click();
    const chooser = page.getByRole('dialog', { name: 'Chọn nhân vật' });
    await expect(chooser.locator('.wh-avatar-option')).toHaveCount(12);
    const portraits = await chooser.locator('.wh-avatar-option .wh-avatar').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return [r.width, r.height];
      }),
    );
    expect(portraits.every(([w, h]) => w >= 64 && h >= 64)).toBe(true);
    expect(
      await chooser.locator('.panel-content').evaluate((n) => n.scrollHeight <= n.clientHeight + 1),
    ).toBe(true);
    await page.getByRole('button', { name: 'Nhân vật 12', exact: true }).click();
    await expect(chooser.getByRole('heading', { name: 'Nhân vật 12', exact: true })).toBeVisible();
    await expect(
      chooser.locator('.wh-avatar-option[aria-pressed="true"] .wh-avatar-tag'),
    ).toHaveText('Đang chọn');
    await page.getByRole('button', { name: 'Lưu nhân vật' }).click();
    await expect(chooser).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByRole('button', { name: 'Nhân vật', exact: true }).click();
    await page.getByRole('button', { name: 'Nhân vật 4', exact: true }).click();
    const last = page.getByRole('button', { name: 'Nhân vật 12', exact: true });
    await last.focus();
    await last.scrollIntoViewIfNeeded();
    const lastBox = await last.boundingBox(),
      footer = await page.locator('.wh-avatar-footer').boundingBox();
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(footer!.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const save = await page.getByRole('button', { name: 'Lưu nhân vật' }).boundingBox();
    expect(save!.y + save!.height).toBeLessThanOrEqual(740);
    await page.keyboard.press('Escape');
    await expect(chooser).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('button', { name: /^Chat/ }).click();
    await page.getByRole('textbox', { name: 'Tin nhắn', exact: true }).fill('Tin của quản trò');
    await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Tin nhắn', exact: true })).toHaveValue('');
    await guest.getByRole('button', { name: /^Chat/ }).click();
    await guest.getByRole('textbox', { name: 'Tin nhắn', exact: true }).fill('Cả nhóm đã sẵn sàng');
    await guest.getByRole('button', { name: 'Gửi tin', exact: true }).click();
    await expect(page.locator('.wh-chat-message[data-own="false"] p')).toHaveText(
      'Cả nhóm đã sẵn sàng',
    );
    await expect(page.locator('.wh-chat-message[data-own="true"] p')).toHaveText(
      'Tin của quản trò',
    );
    expect(await contrast(page, '.wh-chat > header h2')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page, '.wh-chat-message[data-own="true"] p')).toBeGreaterThanOrEqual(4.5);
    expect(
      await page
        .locator('.wh-chat-message p')
        .first()
        .evaluate((n) => parseFloat(getComputedStyle(n).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await expect(page.locator('.wh-chat-meta time').first()).toHaveAttribute('datetime', /T/);
    await page.setViewportSize({ width: 320, height: 740 });
    const input = page.getByRole('textbox', { name: 'Tin nhắn', exact: true });
    expect(
      await input.evaluate((n) => parseFloat(getComputedStyle(n).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    const inputBounds = await input.boundingBox();
    expect(inputBounds!.y + inputBounds!.height).toBeLessThanOrEqual(740);
    await input.fill('Bản nháp được giữ lại');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: /^Chat/ }).click();
    await expect(input).toHaveValue('Bản nháp được giữ lại');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Lịch sử', exact: true }).click();
    expect(await contrast(page, '.wh-history > header h2')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page, '.wh-history > header .wh-kicker')).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});
