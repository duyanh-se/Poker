import { WhiteHatEngine } from './white-hat.engine';

function game(count = 6, whiteCount = 1) {
  return new WhiteHatEngine(
    Array.from({ length: count }, (_, i) => String(i)),
    {
      roleMode: 'custom',
      spyCount: 1,
      whiteCount,
      eliminationsPerRound: 1,
      civilianWord: 'Cà phê',
      spyWord: 'Trà sữa',
    },
    Date.now,
    (max) => max - 1,
  );
}
function descriptions(e: WhiteHatEngine) {
  while (e.stage === 'description') e.describe(e.actingMemberId!, `Gợi ý ${e.descriptions.length}`);
}
function expire(e: WhiteHatEngine) {
  jest.setSystemTime(e.deadlineAt!);
  e.timeout(e.roundId, e.turnId);
}
function eliminate(e: WhiteHatEngine, target: string) {
  descriptions(e);
  e.advance();
  for (const p of e.living()) {
    const alternate = e.living().find((v) => v.id !== p.id && v.id !== target)!.id;
    e.vote(p.id, [p.id === target ? alternate : target]);
  }
}
describe('WhiteHat revised description and guess rules', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10000);
  });
  afterEach(() => jest.useRealTimers());
  it('enforces 15 normalized code points without mutating a rejected turn', () => {
    const e = game();
    const turn = e.turnId,
      deadline = e.deadlineAt;
    for (const text of ['', 'x'.repeat(16), '😀'.repeat(16), 'CÀ!', 'phê sữa'])
      expect(() => e.describe('0', text)).toThrow();
    expect(e.descriptions).toHaveLength(0);
    expect(e.turnId).toBe(turn);
    expect(e.deadlineAt).toBe(deadline);
    e.describe('0', '😀'.repeat(15));
    expect(e.descriptions[0].text).toBe('😀'.repeat(15));
  });
  it('preserves accents, checks word boundaries and duplicates across rounds', () => {
    const e = game();
    e.describe('0', '  Buổi   sáng ');
    expect(() => e.describe('1', 'BUỔI SÁNG')).toThrow();
    expect(() => e.describe('1', 'CÀ')).toThrow();
    e.describe('1', 'cá càng');
    eliminate(e, '0');
    expire(e);
    e.advance();
    expect(() => e.describe(e.actingMemberId!, 'buổi sáng')).toThrow();
    expect(e.stage).toBe('description');
  });
  it.each(['description', 'discussion', 'voting', 'revote', 'tie-break', 'intermission'] as const)(
    'permits the white hat to win immediately during %s',
    (stage) => {
      const e = game();
      e.stage = stage;
      expect(e.canGuess('1')).toBe(true);
      expect(e.canGuess('2')).toBe(false);
      e.guess('1', 'CÀ PHÊ');
      expect(e.result?.winnerMemberIds).toEqual(['1']);
      expect(e.deadlineAt).toBeUndefined();
    },
  );
  it('advances the wrong guesser own description but preserves another actor deadline', () => {
    const e = game();
    const turn = e.turnId,
      deadline = e.deadlineAt;
    e.guess('1', 'sai');
    expect(e.actingMemberId).toBe('0');
    expect(e.turnId).toBe(turn);
    expect(e.deadlineAt).toBe(deadline);
    const other = game();
    other.describe('0', 'Sáng sớm');
    other.guess('1', 'sai');
    expect(other.actingMemberId).toBe('2');
  });
  it.each(['voting', 'revote', 'tie-break'] as const)(
    'cancels an unfinished %s after a wrong guess',
    (stage) => {
      const e = game();
      descriptions(e);
      e.advance();
      e.stage = stage;
      e.ballots.set('2', ['1']);
      e.selectedIds = ['3'];
      e.guess('1', 'sai');
      expect(e.stage).toBe('discussion');
      expect(e.ballots.size).toBe(0);
      expect(e.candidateIds).toEqual([]);
      expect(e.selectedIds).toEqual([]);
      e.advance();
      expect(e.candidateIds).not.toContain('1');
    },
  );
  it('skips post-vote waiting when the white hat already guessed', () => {
    const e = game();
    e.guess('1', 'sai');
    eliminate(e, '2');
    expect(e.stage).toBe('intermission');
    expect(e.deadlineAt).toBeUndefined();
  });
  it('lets a living white hat skip a window and preserves its guess', () => {
    const e = game();
    eliminate(e, '2');
    expect(e.stage).toBe('last-guess');
    expect(e.canGuess('1')).toBe(true);
    expire(e);
    expect(e.participant('1')).toMatchObject({ alive: true, guessed: false });
    expect(e.stage).toBe('intermission');
    expect(e.canGuess('1')).toBe(true);
  });
  it('gives only-white survivors exactly one final window', () => {
    const e = game(4);
    e.setup.eliminationsPerRound = 3;
    descriptions(e);
    e.advance();
    expire(e);
    expire(e);
    e.resolveTie(['0', '2', '3']);
    const deadline = e.deadlineAt!;
    expire(e);
    expect(Date.now()).toBe(deadline);
    expect(e.result?.winner).toBe('civilian');
  });
  it('ends a window when its only remaining eligible player departs', () => {
    const e = game();
    eliminate(e, '1');
    e.depart('1');
    expect(e.stage).toBe('intermission');
    expect(e.deadlineAt).toBeUndefined();
  });
  it('preserves other rights after a wrong or departed white hat', () => {
    const e = game(6, 2);
    eliminate(e, '1');
    const deadline = e.deadlineAt;
    e.guess('1', 'sai');
    expect(e.deadlineAt).toBe(deadline);
    expect(e.canGuess('2')).toBe(true);
    e.guess('2', 'Cà phê');
    expect(e.result?.winnerMemberIds).toEqual(['2']);
  });
  it('cancels during last-guess and makes old timeouts and guesses ineffective', () => {
    const e = game();
    eliminate(e, '1');
    const turn = e.turnId,
      round = e.roundId,
      deadline = e.deadlineAt!;
    e.endMatch();
    expect(e.result).toEqual({
      outcome: 'cancelled',
      winner: null,
      winnerMemberIds: [],
      reason: 'moderator-ended',
    });
    expect(e.canGuess('1')).toBe(false);
    expect(e.deadlineAt).toBeUndefined();
    expect(() => e.guess('1', 'Cà phê')).toThrow();
    jest.setSystemTime(deadline);
    expect(e.timeout(round, turn)).toBe(false);
    const won = game();
    won.guess('1', 'Cà phê');
    expect(() => won.endMatch()).toThrow();
    expect(won.result?.winner).toBe('white-hat');
  });
});
