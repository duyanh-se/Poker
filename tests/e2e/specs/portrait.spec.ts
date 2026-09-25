import { expect, test } from '@playwright/test';
import type { TableSnapshot, LiarsTableSnapshot } from '../../../../packages/contracts/src';

for (const [width, height] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
]) {
  for (const game of ['poker', 'liars-deck'] as const) {
    for (const count of game === 'poker' ? [2, 6, 9] : [2, 3, 4]) {
      test(`portrait ${game} ${count} ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height });
        const common = {
          version: 1,
          roomCode: 'PORTRAIT',
          phase: 'running' as const,
          viewerMemberId: 'p0',
          hostMemberId: 'p0',
          turnId: 'turn',
          deadlineAt: Date.now() + 180000,
        };
        const snapshot: TableSnapshot | LiarsTableSnapshot =
          game === 'poker'
            ? {
                ...common,
                gameType: 'poker',
                config: { smallBlind: 5, bigBlind: 10, ante: 0 },
                handId: 'hand',
                street: 'river',
                buttonSeat: 0,
                smallBlindSeat: count === 2 ? 0 : 1,
                bigBlindSeat: count === 2 ? 1 : 2,
                board: ['AS', 'KH', 'QD', 'JC', 'TS'],
                pots: [{ amount: 900 }],
                players: Array.from({ length: count }, (_, seat) => ({
                  memberId: `p${seat}`,
                  displayName: `Người chơi tên dài ${seat}`,
                  seat,
                  stack: 123456789,
                  contribution: 10,
                  streetContribution: 10,
                  connected: true,
                  folded: false,
                  allIn: false,
                  sittingOut: false,
                  isHost: seat === 0,
                  isActing: seat === 0,
                  ...(seat === 0 ? { holeCards: ['8H', '8D'] } : {}),
                })),
                legalActions: {
                  actions: ['fold', 'check', 'bet', 'all-in'],
                  callAmount: 0,
                  minRaiseTo: 10,
                  maxRaiseTo: 1000,
                },
              }
            : {
                ...common,
                gameType: 'liars-deck',
                config: { startingLives: 10 },
                matchId: 'match',
                roundId: 'round',
                matchStatus: 'active',
                roundNumber: 2,
                tableRank: 'A',
                actingMemberId: 'p0',
                players: Array.from({ length: count }, (_, seat) => ({
                  memberId: `p${seat}`,
                  displayName: `Người chơi tên dài ${seat}`,
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
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.route('**/api/rooms/current', (r) => r.fulfill({ json: { snapshot } }));
        await page.goto('/');
        const seats = page.locator(game === 'poker' ? '.seat' : '.liar-seat');
        await expect(seats).toHaveCount(game === 'poker' ? count : count - 1);
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
        if (game === 'poker') await expect(page.getByTestId('table-2d')).toBeVisible();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        const overlaps = await seats.evaluateAll((nodes) => {
          const r = nodes.map((n) => n.getBoundingClientRect());
          return r.flatMap((a, i) =>
            r
              .slice(i + 1)
              .filter(
                (b) =>
                  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
              ),
          ).length;
        });
        expect(overlaps).toBe(0);
        await page.screenshot({ path: info.outputPath('portrait.png'), fullPage: true });
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await page.getByRole('button', { name: 'Luật chơi', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        const dialog = await page.getByRole('dialog').boundingBox();
        expect(dialog!.width).toBeLessThanOrEqual(width + 1);
        expect(dialog!.height).toBeLessThanOrEqual(height * 0.9 + 2);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.setViewportSize({ width: 844, height: 390 });
        await expect(seats).toHaveCount(game === 'poker' ? count : count - 1);
        await page.setViewportSize({ width, height });
        expect(errors.filter((e) => /hydration/i.test(e))).toEqual([]);
      });
    }
  }
}
