import type { WhiteHatSetup } from '@poker/contracts';
import {
  automaticRoles,
  WhiteHatEngine,
  validateSetup,
  whiteHatText,
  wordKey,
} from './white-hat.engine';

const setup: WhiteHatSetup = {
  eliminationsPerRound: 1,
  roleMode: 'auto',
  spyCount: 1,
  whiteCount: 1,
  civilianWord: 'Cà phê',
  spyWord: 'Trà sữa',
};
function game(count = 4, changes: Partial<WhiteHatSetup> = {}) {
  return new WhiteHatEngine(
    Array.from({ length: count }, (_, i) => String(i)),
    { ...setup, ...changes },
    Date.now,
    (max) => max - 1,
  );
}
function describeAll(engine: WhiteHatEngine) {
  while (engine.stage === 'description')
    engine.describe(engine.actingMemberId!, `Gợi ý ${engine.descriptions.length}`);
}
function expire(engine: WhiteHatEngine) {
  jest.setSystemTime(engine.deadlineAt!);
  expect(engine.timeout(engine.roundId, engine.turnId)).toBe(true);
}
function eliminateOne(engine: WhiteHatEngine, target: string) {
  describeAll(engine);
  engine.advance();
  for (const p of engine.living()) {
    const alternative = engine
      .living()
      .find((other) => other.id !== p.id && other.id !== target)!.id;
    engine.vote(p.id, [p.id === target ? alternative : target]);
  }
  expect(engine.stage).toBe('last-guess');
}

describe('WhiteHatEngine', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(100000);
  });
  afterEach(() => jest.useRealTimers());
  it.each([
    [4, 1],
    [5, 1],
    [6, 2],
    [8, 2],
    [9, 3],
    [12, 3],
  ])('balances %i players', (count, spies) => {
    const engine = game(count);
    expect(automaticRoles(count).spyCount).toBe(spies);
    expect(engine.participants.filter((p) => p.role === 'spy')).toHaveLength(spies);
    expect(engine.participants.filter((p) => p.role === 'white-hat')).toHaveLength(1);
  });
  it('accepts multiple white hats and rejects unbalanced/custom/malformed setups', () => {
    expect(
      game(6, { roleMode: 'custom', spyCount: 1, whiteCount: 2 }).participants.filter(
        (p) => p.role === 'white-hat',
      ),
    ).toHaveLength(2);
    for (const changes of [
      { spyCount: 2 },
      { whiteCount: 0 },
      { whiteCount: 3 },
      { eliminationsPerRound: 4 },
    ])
      expect(() => game(4, { ...changes, roleMode: 'custom' })).toThrow();
    expect(() => game(3)).toThrow();
    expect(() => validateSetup({ ...setup, spyWord: ' CÀ  PHÊ ' }, 4)).toThrow();
    expect(() => whiteHatText({})).toThrow();
    expect(() => whiteHatText('x'.repeat(81))).toThrow();
    expect(wordKey('CÀ   PHÊ')).toBe(wordKey('cà phê'));
    expect(wordKey('ca phe')).not.toBe(wordKey('cà phê'));
  });
  it('locks descriptions, skips timeouts, rejects stale/deadline commands and rotates starters', () => {
    const engine = game();
    const ids = { matchId: engine.matchId, roundId: engine.roundId, turnId: engine.turnId };
    expect(() => engine.describe('2', 'sai lượt')).toThrow();
    expect(() => engine.describe('0', ' ')).toThrow();
    expect(engine.timeout(engine.roundId, engine.turnId)).toBe(false);
    expire(engine);
    expect(engine.descriptions[0].text).toBeNull();
    expect(() => engine.assertCurrent(ids)).toThrow();
    const current = { ...ids, turnId: engine.turnId };
    jest.setSystemTime(engine.deadlineAt!);
    expect(() => engine.assertCurrent(current)).toThrow();
    engine.timeout(engine.roundId, engine.turnId);
    describeAll(engine);
    engine.advance();
    for (const p of engine.living()) engine.vote(p.id, [p.id === '0' ? '2' : '0']);
    expire(engine);
    engine.advance();
    expect(engine.actingMemberId).toBe('1');
    expect(engine.roundNumber).toBe(2);
  });
  it('validates ballots, preserves submissions and waits for a living white hat', () => {
    const engine = game();
    describeAll(engine);
    engine.advance();
    expect(() => engine.vote('0', ['0'])).toThrow();
    expect(() => engine.vote('0', [])).toThrow();
    expect(() => engine.vote('0', ['unknown'])).toThrow();
    engine.vote('0', ['2']);
    expect(() => engine.vote('0', ['3'])).toThrow();
    for (const p of engine.living().slice(1)) engine.vote(p.id, [p.id === '2' ? '3' : '2']);
    expect(engine.stage).toBe('last-guess');
    expect(engine.deadlineAt).toBe(Date.now() + 30000);
    expect(engine.ballotResults[0].ballots).toHaveLength(4);
    expect(engine.participant('2').alive).toBe(false);
    expect(engine.result).toBeUndefined();
    expire(engine);
    expect(engine.stage).toBe('intermission');
  });
  it('holds cutoff winners through one runoff and only permits the moderator tie group', () => {
    const engine = game(6, { eliminationsPerRound: 2 });
    describeAll(engine);
    engine.advance();
    // Expired ballots with no submissions give everyone zero, requiring one runoff.
    expire(engine);
    expect(engine.stage).toBe('revote');
    expect(engine.ballotSize).toBe(2);
    engine.vote('0', ['1', '2']);
    engine.vote('1', ['2', '3']);
    engine.vote('2', ['1', '3']);
    expire(engine);
    expect(engine.stage).toBe('tie-break');
    expect(() => engine.resolveTie(['0', '1'])).toThrow();
    engine.resolveTie(['1', '2']);
    expect(engine.lastEliminatedIds).toEqual(['1', '2']);
    expect(engine.living()).toHaveLength(4);
  });
  it('keeps clear first-ballot selections while narrowing runoff slots', () => {
    const engine = game(5, { eliminationsPerRound: 2 });
    describeAll(engine);
    engine.advance();
    engine.vote('0', ['1', '2']);
    engine.vote('1', ['0', '2']);
    engine.vote('2', ['0', '1']);
    engine.vote('3', ['0', '4']);
    engine.vote('4', ['0', '3']);
    expect(engine.stage).toBe('revote');
    expect(engine.selectedIds).toEqual(['0']);
    expect(engine.candidateIds).toEqual(['1', '2']);
    expect(engine.ballotSize).toBe(1);
    expire(engine);
    expect(engine.stage).toBe('tie-break');
    engine.resolveTie(['1']);
    expect(engine.lastEliminatedIds).toEqual(['0', '1']);
  });
  it('grants a voted white hat a correct last guess before faction victory', () => {
    const engine = game(4, { eliminationsPerRound: 3 });
    describeAll(engine);
    engine.advance();
    expire(engine);
    expire(engine);
    engine.resolveTie(['1', '2', '3']); // Leaves only a spy, but white hat must get its guess.
    expect(engine.result).toBeUndefined();
    expect(engine.canGuess('1')).toBe(true);
    engine.guess('1', '  CÀ   PHÊ ');
    expect(engine.result).toEqual({ winner: 'white-hat', winnerMemberIds: ['1'] });
    expect(() => engine.guess('1', 'Cà phê')).toThrow();
  });
  it('awards spies after an expired last guess, never twice on an old timeout', () => {
    const engine = game(4, { eliminationsPerRound: 3 });
    describeAll(engine);
    engine.advance();
    expire(engine);
    expire(engine);
    engine.resolveTie(['1', '2', '3']);
    const round = engine.roundId,
      turn = engine.turnId;
    expire(engine);
    expect(engine.result?.winner).toBe('spy');
    expect(engine.timeout(round, turn)).toBe(false);
  });
  it('accepts voluntary guesses throughout play and wrong guesses eliminate immediately', () => {
    const engine = game();
    expect(engine.canGuess('1')).toBe(true);
    describeAll(engine);
    expect(engine.canGuess('1')).toBe(true);
    expect(() => engine.guess('2', 'Cà phê')).toThrow();
    engine.guess('1', 'ca phe');
    expect(engine.participant('1')).toMatchObject({ alive: false, revealed: true });
    expect(engine.result).toBeUndefined();
    expect(() => engine.guess('1', 'Cà phê')).toThrow();
    const second = game();
    eliminateOne(second, '0');
    expire(second);
    expect(second.stage).toBe('intermission');
    second.guess('1', 'Cà phê');
    expect(second.result?.winner).toBe('white-hat');
  });
  it('only awards the first correct guesser among multiple white hats', () => {
    const engine = game(6, { roleMode: 'custom', spyCount: 1, whiteCount: 2 });
    describeAll(engine);
    engine.guess('2', 'Cà phê');
    expect(engine.result?.winnerMemberIds).toEqual(['2']);
    expect(() => engine.guess('1', 'Cà phê')).toThrow();
  });
  it('gives sole white survivors a final window and awards even dead civilians on failure', () => {
    const engine = game(4, { eliminationsPerRound: 3 });
    describeAll(engine);
    engine.advance();
    expire(engine);
    expire(engine);
    engine.resolveTie(['0', '2', '3']);
    expect(engine.stage).toBe('last-guess');
    expect(engine.canGuess('1')).toBe(true);
    expire(engine);
    expect(engine.result).toEqual({ winner: 'civilian', winnerMemberIds: ['2', '3'] });
  });
  it('cancels unclosed voting on departure, revokes guesses and caps K to survivors', () => {
    const engine = game(6, { eliminationsPerRound: 5 });
    describeAll(engine);
    engine.advance();
    engine.depart('5');
    expect(engine.stage).toBe('discussion');
    expect(engine.ballots.size).toBe(0);
    engine.advance();
    expect(engine.ballotSize).toBe(4);
    engine.depart('2'); // white hat in six-player automatic allocation
    expect(engine.canGuess('2')).toBe(false);
    expect(() => engine.describe('2', 'x')).toThrow();
  });
  it('preserves other last-guess rights when a surviving player leaves', () => {
    const engine = game();
    eliminateOne(engine, '1');
    const deadline = engine.deadlineAt;
    engine.depart('2');
    expect(engine.deadlineAt).toBe(deadline);
    expect(engine.result).toBeUndefined();
    engine.guess('1', 'Cà phê');
    expect(engine.result?.winner).toBe('white-hat');
  });
});
