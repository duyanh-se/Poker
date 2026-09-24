import { describe, expect, it } from 'vitest';
import { compareRanks, evaluateBestHand, describeCombination } from './public-hand';
describe('public showdown explanation', () => {
  it('names the exact pair and separates kickers using Vietnamese suit names', () => {
    expect(describeCombination(['8d', '8h', 'AS', 'KC', '2h'])).toEqual({
      made: '8 rô, 8 cơ',
      kickers: 'Át bích, Già tép, 2 cơ',
    });
    expect(describeCombination(['8d', '8h', 'AS', 'AC', '2h']).made).toBe(
      '8 rô, 8 cơ, Át bích, Át tép',
    );
    expect(describeCombination(['2d', '3h', '4S', '5C', '6h']).kickers).toBe('');
  });
  it('recognizes a board-only tie and wheel', () => {
    const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
    expect(
      compareRanks(
        evaluateBestHand([...board, '2h', '3h']).rank,
        evaluateBestHand([...board, '4c', '5c']).rank,
      ),
    ).toBe(0);
    expect(evaluateBestHand(['As', '2h', '3c', '4d', '5s', 'Kh', 'Qc']).rank).toEqual([4, 5]);
  });
  it('explains pair kickers in comparison order', () => {
    const better = evaluateBestHand(['As', 'Ah', 'Kc', '9d', '4s', '3h', '2c']);
    const lower = evaluateBestHand(['As', 'Ah', 'Qc', '9d', '4s', '3h', '2c']);
    expect(better.name).toBe('Một đôi');
    expect(compareRanks(better.rank, lower.rank)).toBe(1);
  });
});
