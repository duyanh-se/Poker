import { test, expect } from '@playwright/test';
import type { LiarsTableSnapshot } from '../../../../packages/contracts/src';
for (const count of [2, 3, 4])
  for (const [width, height] of [
    [1440, 900],
    [844, 390],
    [667, 375],
  ]) {
    test(`Liars visual ${count} seats ${width}x${height}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      const snapshot: LiarsTableSnapshot = {
        gameType: 'liars-deck',
        version: 1,
        roomCode: 'BARTEST',
        phase: 'running',
        config: { startingLives: 10 },
        viewerMemberId: 'p0',
        hostMemberId: 'p0',
        matchId: 'match',
        roundId: 'round',
        turnId: 'turn',
        matchStatus: 'active',
        roundNumber: 2,
        tableRank: 'A',
        actingMemberId: 'p0',
        deadlineAt: Date.now() + 65000,
        players: Array.from({ length: count }, (_, seat) => ({
          memberId: `p${seat}`,
          displayName: seat === 0 ? 'Bạn chủ phòng' : 'Người chơi tên rất dài ' + seat,
          seat,
          connected: true,
          isHost: seat === 0,
          isActing: seat === 0,
          lives: 10,
          cardCount: 5,
          eliminated: false,
          ...(seat === 0
            ? {
                cards: ['A', 'K', 'Q', 'JOKER', 'A'].map((rank, i) => ({
                  id: String(i),
                  rank: rank as 'A',
                })),
              }
            : {}),
        })),
        lastPlay: { memberId: 'p1', count: 3 },
        legalActions: { canPlay: true, canChallenge: true, mustChallenge: false },
      };
      await page.route('**/api/rooms/current', (r) => r.fulfill({ json: { snapshot } }));
      await page.goto('/');
      await expect(page.locator('.liar-seat')).toHaveCount(count - 1);
      await page.getByRole('button', { name: 'Xem bài', exact: true }).click();
      await expect(page.getByLabel('Lá JOKER', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('table.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const boxes = await page
        .locator('.liar-seat, .liar-center, .liar-dock')
        .evaluateAll((nodes) =>
          nodes.map((n) => {
            const r = n.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
          }),
        );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          expect(
            Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].x, boxes[j].x) > 1 &&
              Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].y, boxes[j].y) > 1,
          ).toBe(false);
      const buttons = await page.locator('.liar-dock button').evaluateAll((nodes) =>
        nodes.map((n) => ({
          h: n.getBoundingClientRect().height,
          w: n.getBoundingClientRect().width,
        })),
      );
      expect(buttons.every((b) => b.h >= 44 && b.w >= 44)).toBe(true);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect(page.getByLabel('Lá JOKER', { exact: true })).toHaveCount(0);
      snapshot.phase = 'waiting';
      snapshot.turnId = undefined;
      snapshot.result = {
        reason: 'challenge',
        loserMemberId: 'p1',
        wasLie: true,
        revealedCards: [
          { id: 'r1', rank: 'K' },
          { id: 'r2', rank: 'JOKER' },
          { id: 'r3', rank: 'A' },
        ],
      };
      await page.reload();
      await expect(page.getByRole('status', { name: 'Kết quả vòng' })).toBeVisible();
      await page.screenshot({ path: info.outputPath('result.png'), fullPage: true });
      await expect(page.getByRole('button', { name: 'Bắt đầu vòng tiếp theo' })).toBeVisible();
    });
  }
