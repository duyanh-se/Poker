import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import type { WhiteHatSnapshot } from '../../../packages/contracts/src';
async function state(p: Page): Promise<WhiteHatSnapshot> {
  return (await (await p.request.get('/api/rooms/current')).json()).snapshot;
}
async function fits(p: Page) {
  const snapshot = await state(p);
  await p.screenshot({
    path: test
      .info()
      .outputPath(
        `fit-${snapshot.stage}-${snapshot.matchId?.slice(0, 4) ?? 'lobby'}-${snapshot.viewerMemberId}.png`,
      ),
  });
  expect(
    await p.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  const bounds = await p.locator('.wh-player, .wh-sidebar, .wh-header').evaluateAll((nodes) =>
    nodes.every((n) => {
      const r = n.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    }),
  );
  expect(bounds).toBe(true);
}
test('WhiteHat revised controls: validation, proactive guess, avatars, skipped wait and early ending', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const contexts: BrowserContext[] = [];
  await page.setViewportSize({ width: 1280, height: 720 });
  const created = await page.request.post('/api/rooms', {
    data: { gameType: 'white-hat', displayName: 'Quản trò' },
  });
  const { roomCode, password } = await created.json();
  await page.goto('/');
  const players: Array<{ id: string; page: Page }> = [];
  try {
    for (let i = 0; i < 4; i++) {
      const c = await browser.newContext({
        baseURL: new URL('/', page.url()).href,
        viewport: { width: 1280, height: 720 },
      });
      contexts.push(c);
      const joined = await c.request.post('/api/rooms/join', {
        data: { roomCode, password, displayName: `Người chơi ${i + 1}` },
      });
      const guest = await c.newPage();
      await guest.goto('/');
      players.push({ id: (await joined.json()).snapshot.viewerMemberId, page: guest });
    }
    await expect
      .poll(async () => (await state(page)).players.filter((p) => p.connected).length)
      .toBe(5);
    await fits(page);
    async function start() {
      await page.getByLabel('Từ dân thường', { exact: true }).fill('Cà phê');
      await page.getByLabel('Từ gián điệp', { exact: true }).fill('Trà sữa');
      await page.getByRole('button', { name: 'Lưu cấu hình và từ' }).click();
      await expect(page.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' })).toBeEnabled();
      await page.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' }).click();
      await expect.poll(async () => (await state(page)).stage).toBe('description');
      return state(page);
    }
    let s = await start();
    const actor = players.find((p) => p.id === s.actingMemberId)!.page;
    await fits(actor);
    await actor.getByLabel('Mô tả của bạn').fill('x'.repeat(16));
    await expect(actor.getByRole('button', { name: 'Gửi mô tả' })).toBeDisabled();
    await actor.getByLabel('Mô tả của bạn').fill('CÀ!');
    await actor.getByRole('button', { name: 'Gửi mô tả' }).click();
    await expect(actor.locator('#wh-description-error')).toContainText('không được phép');
    expect((await state(page)).turnId).toBe(s.turnId);
    await actor.getByLabel('Mô tả của bạn').fill('Buổi sáng');
    await actor.getByRole('button', { name: 'Gửi mô tả' }).click();
    await expect.poll(async () => (await state(page)).descriptions.length).toBe(1);
    s = await state(page);
    const next = players.find((p) => p.id === s.actingMemberId)!.page;
    await next.getByLabel('Mô tả của bạn').fill(' BUỔI   SÁNG ');
    await expect(next.getByRole('button', { name: 'Gửi mô tả' })).toBeDisabled();
    const member = players[0];
    const beforeAvatar = await state(member.page);
    await member.page.getByRole('button', { name: 'Nhân vật', exact: true }).click();
    await member.page.getByRole('button', { name: 'Nhân vật 12', exact: true }).click();
    await member.page.getByRole('button', { name: 'Lưu nhân vật' }).click();
    await expect
      .poll(async () => (await state(page)).players.find((p) => p.memberId === member.id)?.avatarId)
      .toBe(11);
    expect((await state(member.page)).deadlineAt).toBe(beforeAvatar.deadlineAt);
    await expect(page.locator(`[data-member="${member.id}"] .wh-avatar`)).toHaveAttribute(
      'data-avatar',
      '11',
    );
    await member.page.reload();
    await expect(member.page.locator('.wh-game')).toBeVisible();
    expect((await state(member.page)).players.find((p) => p.memberId === member.id)?.avatarId).toBe(
      11,
    );
    const white = players.find(
      (p) => p.id === s.moderator!.roles.find((r) => r.role === 'white-hat')!.memberId,
    )!;
    // This guess occurs while descriptions are still in progress.
    const hasInput = await white.page
      .getByRole('textbox', { name: 'Đoán từ dân thường', exact: true })
      .count();
    if (!hasInput)
      await white.page.getByRole('button', { name: 'Lộ diện và đoán', exact: true }).click();
    await white.page
      .getByRole('textbox', { name: 'Đoán từ dân thường', exact: true })
      .fill('Cà phê');
    await white.page.getByRole('button', { name: 'Lộ diện và đoán', exact: true }).last().click();
    await white.page.getByRole('button', { name: 'Xác nhận lộ diện và đoán' }).click();
    await expect.poll(async () => (await state(page)).result?.winner).toBe('white-hat');
    await fits(page);
    s = await start();
    const white2 = players.find(
      (p) => p.id === s.moderator!.roles.find((r) => r.role === 'white-hat')!.memberId,
    )!;
    if (
      !(await white2.page.getByRole('textbox', { name: 'Đoán từ dân thường', exact: true }).count())
    )
      await white2.page.getByRole('button', { name: 'Lộ diện và đoán', exact: true }).click();
    await white2.page.getByRole('textbox', { name: 'Đoán từ dân thường', exact: true }).fill('sai');
    await white2.page.getByRole('button', { name: 'Lộ diện và đoán', exact: true }).last().click();
    await white2.page.getByRole('button', { name: 'Xác nhận lộ diện và đoán' }).click();
    await expect.poll(async () => (await state(page)).guesses.length).toBe(1);
    while ((s = await state(page)).stage === 'description') {
      const p = players.find((p) => p.id === s.actingMemberId)!;
      await p.page.getByLabel('Mô tả của bạn').fill(`Gợi ý ${s.descriptions.length}`);
      await p.page.getByRole('button', { name: 'Gửi mô tả' }).click();
      const count = s.descriptions.length;
      await expect.poll(async () => (await state(page)).descriptions.length).toBe(count + 1);
    }
    await page.getByRole('button', { name: 'Mở bỏ phiếu' }).click();
    s = await state(page);
    const target = s.moderator!.roles.find((r) => r.role === 'spy')!.memberId;
    const living = s.players.filter((p) => !p.isModerator && !p.eliminated);
    for (const p of living) {
      const voter = players.find((v) => v.id === p.memberId)!;
      const chosen =
        p.memberId === target
          ? living.find((v) => v.memberId !== p.memberId)!
          : living.find((v) => v.memberId === target)!;
      await voter.page.getByRole('checkbox', { name: chosen.displayName, exact: true }).check();
      await voter.page.getByRole('button', { name: 'Gửi phiếu', exact: true }).click();
    }
    await expect.poll(async () => (await state(page)).stage).toBe('finished');
    expect((await state(page)).result?.winner).toBe('civilian');
    await start();
    await page.getByRole('button', { name: 'Kết thúc ván', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Kết thúc ván sớm' })).toContainText(
      'không có phe thắng',
    );
    expect((await state(page)).matchStatus).toBe('active');
    await page.getByRole('button', { name: 'Xác nhận kết thúc ván' }).click();
    await expect.poll(async () => (await state(page)).result?.outcome).toBe('cancelled');
    await expect(page.getByRole('status', { name: 'Kết quả ván' })).toContainText(
      'Không có phe thắng',
    );
    await fits(page);
    await page.screenshot({ path: test.info().outputPath('cancelled-1280x720.png') });
    await start();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
