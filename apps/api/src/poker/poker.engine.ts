import { randomInt } from 'node:crypto';

export const ranks = '23456789TJQKA'.split('');
export const suits = 'cdhs'.split('');
export type Card = string;
export type HandRank = readonly [number, ...number[]];

export interface SeatedPlayer {
  memberId: string;
  seat: number;
}

export interface HandPositions {
  buttonSeat: number;
  smallBlindMemberId: string;
  bigBlindMemberId: string;
  preflopActorMemberId: string;
  postflopActorMemberId: string;
}

export interface EvaluatedHand {
  rank: HandRank;
  name: string;
  cards: Card[];
}

export function mayRaiseAfterAction(
  hasActedAtCurrentStreet: boolean,
  lastActionWager: number,
  currentWager: number,
  lastFullRaise: number,
): boolean {
  return !hasActedAtCurrentStreet || currentWager - lastActionWager >= lastFullRaise;
}

export function assignHandPositions(
  eligiblePlayers: SeatedPlayer[],
  previousButtonSeat?: number,
  initialButtonIndex?: number,
): HandPositions {
  if (eligiblePlayers.length < 2) throw new Error('At least two eligible players are required.');
  const seats = [...eligiblePlayers].sort((left, right) => left.seat - right.seat);
  const buttonSeat =
    previousButtonSeat === undefined
      ? seats[(initialButtonIndex ?? randomInt(seats.length)) % seats.length].seat
      : (seats.find((player) => player.seat > previousButtonSeat)?.seat ?? seats[0].seat);
  const clockwise = [
    ...seats.filter((player) => player.seat >= buttonSeat),
    ...seats.filter((player) => player.seat < buttonSeat),
  ];

  if (clockwise.length === 2) {
    return {
      buttonSeat,
      smallBlindMemberId: clockwise[0].memberId,
      bigBlindMemberId: clockwise[1].memberId,
      preflopActorMemberId: clockwise[0].memberId,
      postflopActorMemberId: clockwise[1].memberId,
    };
  }

  return {
    buttonSeat,
    smallBlindMemberId: clockwise[1].memberId,
    bigBlindMemberId: clockwise[2].memberId,
    preflopActorMemberId: clockwise[3 % clockwise.length].memberId,
    postflopActorMemberId: clockwise[1].memberId,
  };
}

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => `${rank}${suit}`));
}

export function shuffleDeck(): Card[] {
  const deck = createDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

function values(cards: Card[]): number[] {
  return cards.map((card) => ranks.indexOf(card[0]) + 2).sort((a, b) => b - a);
}

function straightHigh(valuesDescending: number[]): number | undefined {
  const distinct = [...new Set(valuesDescending)];
  if (distinct.includes(14)) distinct.push(1);
  for (let index = 0; index <= distinct.length - 5; index += 1) {
    if (
      distinct.slice(index, index + 5).every((value, offset, group) => value === group[0] - offset)
    ) {
      return distinct[index] === 5 && distinct[index + 4] === 1 ? 5 : distinct[index];
    }
  }
  return undefined;
}

/** Higher tuple wins. Categories: high through straight flush are 0–8. */
export function rankFive(cards: Card[]): HandRank {
  const cardValues = values(cards);
  const groups = [
    ...new Map(
      cardValues.map((value) => [value, cardValues.filter((item) => item === value).length]),
    ),
  ]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const flush = cards.every((card) => card[1] === cards[0][1]);
  const straight = straightHigh(cardValues);
  if (flush && straight) return [8, straight];
  if (groups[0].count === 4) return [7, groups[0].value, groups[1].value];
  if (groups[0].count === 3 && groups[1].count === 2) return [6, groups[0].value, groups[1].value];
  if (flush) return [5, ...cardValues];
  if (straight) return [4, straight];
  if (groups[0].count === 3)
    return [3, groups[0].value, ...groups.slice(1).map((group) => group.value)];
  if (groups[0].count === 2 && groups[1].count === 2)
    return [2, groups[0].value, groups[1].value, groups[2].value];
  if (groups[0].count === 2)
    return [1, groups[0].value, ...groups.slice(1).map((group) => group.value)];
  return [0, ...cardValues];
}

export function compareRanks(left: HandRank, right: HandRank): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function evaluateBestHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) throw new Error('At least five cards are required.');
  let best: HandRank | undefined;
  let bestCards: Card[] | undefined;
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const candidate = rankFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareRanks(candidate, best) > 0) {
              best = candidate;
              bestCards = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            }
          }
        }
      }
    }
  }
  return { rank: best as HandRank, name: handName(best as HandRank), cards: bestCards as Card[] };
}

export function bestRank(cards: Card[]): HandRank {
  return evaluateBestHand(cards).rank;
}

export function handName(rank: HandRank): string {
  return [
    'Mậu thầu',
    'Một đôi',
    'Hai đôi',
    'Bộ ba',
    'Sảnh',
    'Thùng',
    'Cù lũ',
    'Tứ quý',
    'Thùng phá sảnh',
  ][rank[0]];
}

export interface Contribution {
  memberId: string;
  amount: number;
  folded: boolean;
}

export interface DerivedPot {
  amount: number;
  eligibleMemberIds: string[];
}

export interface SettlementPlayer extends Contribution {
  seat: number;
  rank?: HandRank;
}

export interface SettledPot extends DerivedPot {
  winnerMemberIds: string[];
  payouts: Array<{ memberId: string; amount: number }>;
}

export interface PotSettlement {
  returned: Array<{ memberId: string; amount: number }>;
  pots: SettledPot[];
}

export function derivePots(contributions: Contribution[]): DerivedPot[] {
  const levels = [
    ...new Set(contributions.map((entry) => entry.amount).filter((amount) => amount > 0)),
  ].sort((a, b) => a - b);
  let previous = 0;
  return levels.flatMap((level) => {
    const involved = contributions.filter((entry) => entry.amount >= level);
    const amount = (level - previous) * involved.length;
    previous = level;
    if (amount === 0) return [];
    return [
      {
        amount,
        eligibleMemberIds: involved.filter((entry) => !entry.folded).map((entry) => entry.memberId),
      },
    ];
  });
}

export function settlePots(players: SettlementPlayer[], buttonSeat: number): PotSettlement {
  const levels = [
    ...new Set(players.map((player) => player.amount).filter((amount) => amount > 0)),
  ].sort((left, right) => left - right);
  let previous = 0;
  const returned: Array<{ memberId: string; amount: number }> = [];
  const pots: SettledPot[] = [];

  for (const level of levels) {
    const involved = players.filter((player) => player.amount >= level);
    const amount = (level - previous) * involved.length;
    previous = level;
    if (involved.length === 1) {
      returned.push({ memberId: involved[0].memberId, amount });
      continue;
    }
    const eligible = involved.filter((player) => !player.folded);
    if (eligible.length === 0) throw new Error('A pot must have at least one eligible player.');
    const winners = eligible.filter((player) => {
      if (eligible.length === 1) return true;
      if (!player.rank)
        throw new Error('Showdown settlement requires a rank for each eligible player.');
      return eligible.every(
        (opponent) => !opponent.rank || compareRanks(player.rank!, opponent.rank) >= 0,
      );
    });
    const base = Math.floor(amount / winners.length);
    let remainder = amount % winners.length;
    const clockwiseWinners = [...winners].sort(
      (left, right) =>
        ((left.seat - buttonSeat + 9) % 9 || 9) - ((right.seat - buttonSeat + 9) % 9 || 9),
    );
    const payouts = clockwiseWinners.map((winner) => ({
      memberId: winner.memberId,
      amount: base + (remainder-- > 0 ? 1 : 0),
    }));
    pots.push({
      amount,
      eligibleMemberIds: eligible.map((player) => player.memberId),
      winnerMemberIds: clockwiseWinners.map((player) => player.memberId),
      payouts,
    });
  }

  return { returned, pots };
}
