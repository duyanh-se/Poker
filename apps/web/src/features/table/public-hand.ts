export const ranks = '23456789TJQKA'.split('');
export type Card = string;
export type HandRank = readonly [number, ...number[]];
export interface EvaluatedHand {
  rank: HandRank;
  name: string;
  cards: Card[];
}
// Presentation only: operates exclusively on cards already public to this viewer.
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

export function describeCombination(cards: string[]): { made: string; kickers: string } {
  const normalized = cards.map((card) => card[0].toUpperCase() + card.slice(-1).toLowerCase());
  const hand = evaluateBestHand(normalized);
  const category = hand.rank[0];
  const mainRanks =
    category === 1 || category === 3 || category === 7
      ? [hand.rank[1]]
      : category === 2
        ? [hand.rank[1], hand.rank[2]]
        : [];
  const main = hand.cards.filter(
    (card) => !mainRanks.length || mainRanks.includes(ranks.indexOf(card[0]) + 2),
  );
  const others = hand.cards.filter((card) => !main.includes(card));
  const name = (card: string) =>
    `${({ A: 'Át', K: 'Già', Q: 'Đầm', J: 'Bồi', T: '10' } as Record<string, string>)[card[0]] ?? card[0]} ${({ d: 'rô', h: 'cơ', s: 'bích', c: 'tép' } as Record<string, string>)[card[1]]}`;
  return { made: main.map(name).join(', '), kickers: others.map(name).join(', ') };
}
