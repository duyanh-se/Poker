import {
  assignHandPositions,
  bestRank,
  compareRanks,
  createDeck,
  derivePots,
  evaluateBestHand,
  mayRaiseAfterAction,
  rankFive,
  settlePots,
} from './poker.engine';

describe('poker engine', () => {
  it('creates a complete deck without duplicates', () => {
    expect(new Set(createDeck()).size).toBe(52);
  });

  it('assigns button, blinds and action order for heads-up play', () => {
    expect(
      assignHandPositions(
        [
          { memberId: 'a', seat: 0 },
          { memberId: 'b', seat: 4 },
        ],
        undefined,
        1,
      ),
    ).toEqual({
      buttonSeat: 4,
      smallBlindMemberId: 'b',
      bigBlindMemberId: 'a',
      preflopActorMemberId: 'b',
      postflopActorMemberId: 'a',
    });
  });

  it('moves the button clockwise among eligible players', () => {
    expect(
      assignHandPositions(
        [
          { memberId: 'a', seat: 0 },
          { memberId: 'b', seat: 3 },
          { memberId: 'c', seat: 7 },
        ],
        3,
      ),
    ).toMatchObject({
      buttonSeat: 7,
      smallBlindMemberId: 'a',
      bigBlindMemberId: 'b',
      preflopActorMemberId: 'c',
      postflopActorMemberId: 'a',
    });
  });

  it('does not reopen raising for a short all-in until a full increase is faced', () => {
    expect(mayRaiseAfterAction(true, 100, 150, 100)).toBe(false);
    expect(mayRaiseAfterAction(true, 100, 200, 100)).toBe(true);
    expect(mayRaiseAfterAction(false, 100, 150, 100)).toBe(true);
  });

  it('ranks a wheel below a six-high straight', () => {
    expect(
      compareRanks(
        rankFive(['As', '2d', '3h', '4c', '5s']),
        rankFive(['2s', '3d', '4h', '5c', '6s']),
      ),
    ).toBeLessThan(0);
  });

  it.each([
    [['As', 'Ks', 'Qs', 'Js', 'Ts'], 8],
    [['As', 'Ad', 'Ah', 'Ac', '2s'], 7],
    [['As', 'Ad', 'Ah', 'Ks', 'Kd'], 6],
    [['As', 'Js', '8s', '4s', '2s'], 5],
    [['9s', '8d', '7h', '6c', '5s'], 4],
    [['As', 'Ad', 'Ah', 'Ks', '2d'], 3],
    [['As', 'Ad', 'Ks', 'Kd', '2s'], 2],
    [['As', 'Ad', 'Ks', 'Qs', '2d'], 1],
    [['As', 'Kd', 'Qs', '8c', '2s'], 0],
  ])('assigns the expected category', (cards, category) => {
    expect(rankFive(cards as string[])[0]).toBe(category);
  });

  it('uses kickers and permits every player to play the board', () => {
    expect(
      compareRanks(
        rankFive(['As', 'Ad', 'Ks', 'Qs', '2d']),
        rankFive(['Ah', 'Ac', 'Js', 'Ts', '2c']),
      ),
    ).toBeGreaterThan(0);

    const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
    expect(compareRanks(bestRank([...board, '2d', '3c']), bestRank([...board, '9d', '8c']))).toBe(
      0,
    );
  });

  it('returns the winning five cards for a hand explanation', () => {
    expect(evaluateBestHand(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c'])).toEqual({
      rank: [8, 14],
      name: 'Thùng phá sảnh',
      cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    });
  });

  it('chooses the best five of seven cards', () => {
    expect(bestRank(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c'])[0]).toBe(8);
  });

  it('derives main and side pots while excluding folded winners', () => {
    expect(
      derivePots([
        { memberId: 'a', amount: 100, folded: false },
        { memberId: 'b', amount: 300, folded: false },
        { memberId: 'c', amount: 300, folded: true },
      ]),
    ).toEqual([
      { amount: 300, eligibleMemberIds: ['a', 'b'] },
      { amount: 400, eligibleMemberIds: ['b'] },
    ]);
  });

  it('settles side pots, excludes folded players and awards odd chips clockwise from the button', () => {
    const rank = rankFive(['As', 'Kd', 'Qs', 'Jh', '9c']);
    const lowerRank = rankFive(['Ks', 'Qd', 'Js', 'Th', '8c']);
    expect(
      settlePots(
        [
          { memberId: 'a', seat: 0, amount: 100, folded: false, rank },
          { memberId: 'b', seat: 1, amount: 300, folded: false, rank: lowerRank },
          { memberId: 'c', seat: 2, amount: 300, folded: true },
        ],
        0,
      ),
    ).toEqual({
      returned: [],
      pots: [
        {
          amount: 300,
          eligibleMemberIds: ['a', 'b'],
          winnerMemberIds: ['a'],
          payouts: [{ memberId: 'a', amount: 300 }],
        },
        {
          amount: 400,
          eligibleMemberIds: ['b'],
          winnerMemberIds: ['b'],
          payouts: [{ memberId: 'b', amount: 400 }],
        },
      ],
    });

    const tied = settlePots(
      [
        { memberId: 'a', seat: 1, amount: 50, folded: false, rank },
        { memberId: 'b', seat: 2, amount: 50, folded: false, rank },
        { memberId: 'c', seat: 3, amount: 1, folded: true },
      ],
      0,
    );
    expect(
      Object.fromEntries(
        tied.pots
          .flatMap((pot) => pot.payouts)
          .reduce<
            Map<string, number>
          >((totals, payout) => totals.set(payout.memberId, (totals.get(payout.memberId) ?? 0) + payout.amount), new Map()),
      ),
    ).toEqual({ a: 51, b: 50 });
  });

  it('returns a lone unmatched contribution before payout', () => {
    const rank = rankFive(['As', 'Kd', 'Qs', 'Jh', '9c']);
    expect(
      settlePots(
        [
          { memberId: 'a', seat: 0, amount: 100, folded: false, rank },
          {
            memberId: 'b',
            seat: 1,
            amount: 300,
            folded: false,
            rank: rankFive(['Ks', 'Qd', 'Js', 'Th', '8c']),
          },
        ],
        0,
      ),
    ).toEqual({
      returned: [{ memberId: 'b', amount: 200 }],
      pots: [
        {
          amount: 200,
          eligibleMemberIds: ['a', 'b'],
          winnerMemberIds: ['a'],
          payouts: [{ memberId: 'a', amount: 200 }],
        },
      ],
    });
  });
});
