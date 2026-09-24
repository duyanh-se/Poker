import { RoomError } from '../rooms/room-error';
import { LiarsRoomService } from './liars-room.service';

function advance(service: LiarsRoomService, sessionId: string) {
  const state = service.current(sessionId);
  if (!state.transition) throw new Error('Expected transition');
  jest.setSystemTime(state.transition.endsAt);
  service.advanceTransition(state.roomCode, state.transition.id);
  return service.current(sessionId);
}
function settle(service: LiarsRoomService, sessionId: string) {
  while (service.current(sessionId).transition) advance(service, sessionId);
  return service.current(sessionId);
}

function readyRoom(startingLives = 3) {
  const service = new LiarsRoomService();
  const created = service.create({ displayName: 'Chu phong', startingLives }, () => false);
  const joined = service.join({
    roomCode: created.roomCode,
    password: created.password,
    displayName: 'Nguoi choi',
  });
  service.setConnected(created.sessionId, true);
  service.setConnected(joined.sessionId, true);
  service.start(created.sessionId);
  advance(service, created.sessionId);
  return { service, created, joined };
}

describe('LiarsRoomService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000000);
  });
  afterEach(() => jest.useRealTimers());
  it.each(['A', 'K', 'JOKER'] as const)(
    'stages deterministic %s claims without an early or duplicate penalty',
    (rank) => {
      const { service, created, joined } = readyRoom();
      const first = service.current(created.sessionId);
      const actorSession =
        first.actingMemberId === first.viewerMemberId ? created.sessionId : joined.sessionId;
      const otherSession =
        actorSession === created.sessionId ? joined.sessionId : created.sessionId;
      const rooms = (
        service as unknown as {
          rooms: Map<
            string,
            {
              tableRank: string;
              members: Array<{ id: string; cards: Array<{ id: string; rank: string }> }>;
            }
          >;
        }
      ).rooms;
      const room = rooms.get(created.roomCode)!;
      room.tableRank = 'A';
      const card = room.members.find((m) => m.id === first.actingMemberId)!.cards[0];
      card.rank = rank;
      service.play(actorSession, first.matchId!, first.roundId!, first.turnId!, [card.id]);
      advance(service, actorSession);
      const turn = service.current(otherSession);
      service.challenge(otherSession, turn.matchId!, turn.roundId!, turn.turnId!);
      expect(service.current(otherSession).result).toBeUndefined();
      advance(service, otherSession);
      const verdict = advance(service, otherSession);
      expect(verdict.result?.wasLie).toBe(rank === 'K');
      expect(verdict.players.every((p) => p.lives === 3)).toBe(true);
      const id = verdict.transition!.id;
      const penalty = advance(service, otherSession);
      expect(penalty.players.filter((p) => p.lives === 2)).toHaveLength(1);
      expect(service.advanceTransition(created.roomCode, id)).toBeUndefined();
      expect(settle(service, otherSession).players.filter((p) => p.lives === 2)).toHaveLength(1);
    },
  );
  it('starts a full deadline after dealing, rejects early actions and ignores stale callbacks', () => {
    const service = new LiarsRoomService();
    const created = service.create({ displayName: 'Host' }, () => false);
    const joined = service.join({
      roomCode: created.roomCode,
      password: created.password,
      displayName: 'Guest',
    });
    service.setConnected(created.sessionId, true);
    service.setConnected(joined.sessionId, true);
    const dealing = service.start(created.sessionId);
    expect(dealing.transition?.endsAt! - dealing.transition?.startedAt!).toBe(1800);
    expect(dealing.actingMemberId).toBeUndefined();
    expect(dealing.deadlineAt).toBeUndefined();
    expect(dealing.legalActions).toBeUndefined();
    expect(service.advanceTransition(created.roomCode, dealing.transition!.id)).toBeUndefined();
    expect(() =>
      service.play(created.sessionId, dealing.matchId!, dealing.roundId!, 'old', []),
    ).toThrow(expect.objectContaining({ code: 'TRANSITION_IN_PROGRESS' }));
    service.setConnected(joined.sessionId, false);
    service.setConnected(joined.sessionId, true);
    expect(service.current(joined.sessionId).transition).toEqual(dealing.transition);
    const turn = advance(service, created.sessionId);
    expect(turn.deadlineAt).toBe(Date.now() + 180000);
    expect(service.advanceTransition(created.roomCode, dealing.transition!.id)).toBeUndefined();
    expect(service.current(created.sessionId).turnId).toBe(turn.turnId);
    service.leave(created.sessionId);
    expect(service.advanceTransition(created.roomCode, dealing.transition!.id)).toBeUndefined();
  });

  it('forfeit cancels an in-flight deal and cannot revive a departed player turn', () => {
    const { service, created, joined } = readyRoom();
    const state = service.current(created.sessionId);
    const activeSession =
      state.actingMemberId === state.viewerMemberId ? created.sessionId : joined.sessionId;
    const active = service.current(activeSession);
    const card = active.players.find((player) => player.memberId === active.viewerMemberId)!
      .cards![0];
    const played = service.play(activeSession, active.matchId!, active.roundId!, active.turnId!, [
      card.id,
    ]);
    service.leave(joined.sessionId);
    jest.setSystemTime(played.transition!.endsAt);
    expect(service.advanceTransition(created.roomCode, played.transition!.id)).toBeUndefined();
    const done = settle(service, created.sessionId);
    expect(done.actingMemberId).toBeUndefined();
    expect(done.result?.reason).toBe('forfeit');
    expect(done.winnerMemberId).toBe(created.snapshot.viewerMemberId);
  });
  it('deals private cards only to their owner', () => {
    const { service, created, joined } = readyRoom();
    const host = service.current(created.sessionId);
    const guest = service.current(joined.sessionId);

    expect(host.gameType).toBe('liars-deck');
    expect(host.tableRank).toMatch(/[AKQ]/);
    expect(
      host.players.find((player) => player.memberId === host.viewerMemberId)?.cards,
    ).toHaveLength(5);
    expect(
      host.players.find((player) => player.memberId === guest.viewerMemberId)?.cards,
    ).toBeUndefined();
    expect(
      guest.players.find((player) => player.memberId === host.viewerMemberId)?.cards,
    ).toBeUndefined();
  });

  it('resolves a challenge from the actual cards and removes one life', () => {
    const { service, created, joined } = readyRoom();
    const first = service.current(created.sessionId);
    const actorSession =
      first.actingMemberId === first.viewerMemberId ? created.sessionId : joined.sessionId;
    const challengerSession =
      actorSession === created.sessionId ? joined.sessionId : created.sessionId;
    const actor = service.current(actorSession);
    const card = actor.players.find((player) => player.memberId === actor.viewerMemberId)
      ?.cards?.[0];
    expect(card).toBeDefined();

    service.play(actorSession, actor.matchId!, actor.roundId!, actor.turnId!, [card!.id]);
    advance(service, actorSession);
    const challenger = service.current(challengerSession);
    const announcement = service.challenge(
      challengerSession,
      challenger.matchId!,
      challenger.roundId!,
      challenger.turnId!,
    );
    const lied = card!.rank !== first.tableRank && card!.rank !== 'JOKER';

    expect(announcement.transition?.kind).toBe('challenge');
    expect(announcement.result).toBeUndefined();
    expect(announcement.challengeReveal).toBeUndefined();
    expect(announcement.deadlineAt).toBeUndefined();
    expect(() => service.start(created.sessionId)).toThrow(
      expect.objectContaining({ code: 'TRANSITION_IN_PROGRESS' }),
    );
    const reveal = advance(service, challengerSession);
    expect(reveal.challengeReveal?.cards).toEqual([card]);
    expect(reveal.result).toBeUndefined();
    expect(reveal.players.every((p) => p.lives === 3)).toBe(true);
    const verdict = advance(service, challengerSession);
    expect(verdict.result?.wasLie).toBe(lied);
    expect(verdict.players.every((p) => p.lives === 3)).toBe(true);
    const oldId = verdict.transition!.id;
    const lifeLoss = advance(service, challengerSession);
    expect(lifeLoss.transition?.kind).toBe('life-loss');
    expect(service.advanceTransition(created.roomCode, oldId)).toBeUndefined();
    const result = advance(service, challengerSession);

    expect(result.result?.wasLie).toBe(lied);
    expect(result.result?.loserMemberId).toBe(
      lied ? actor.viewerMemberId : challenger.viewerMemberId,
    );
    expect(
      result.players.find((player) => player.memberId === result.result?.loserMemberId)?.lives,
    ).toBe(2);
    expect(result.phase).toBe('waiting');
  });

  it('locks the roster during a match and ends a timed-out round', () => {
    const { service, created, joined } = readyRoom();
    expect(() =>
      service.join({
        roomCode: created.roomCode,
        password: created.password,
        displayName: 'Nguoi thu ba',
      }),
    ).toThrow(expect.objectContaining<Partial<RoomError>>({ code: 'MATCH_IN_PROGRESS' }));

    const current = service.current(created.sessionId);
    expect(service.timeout(created.roomCode, current.roundId!, current.turnId!)).toBeUndefined();
    jest.setSystemTime(current.deadlineAt!);
    service.timeout(created.roomCode, current.roundId!, current.turnId!);
    const result = advance(service, created.sessionId);
    expect(result?.result?.reason).toBe('timeout');
    expect(result?.result?.loserMemberId).toBe(current.actingMemberId);
    expect(result?.phase).toBe('waiting');
    expect(service.current(joined.sessionId).players.some((player) => player.lives === 2)).toBe(
      true,
    );
  });

  it('declares the surviving player winner when the loser has no lives', () => {
    const { service, created, joined } = readyRoom(1);
    const first = service.current(created.sessionId);
    const actorSession =
      first.actingMemberId === first.viewerMemberId ? created.sessionId : joined.sessionId;
    const challengerSession =
      actorSession === created.sessionId ? joined.sessionId : created.sessionId;
    const actor = service.current(actorSession);
    const card = actor.players.find((player) => player.memberId === actor.viewerMemberId)
      ?.cards?.[0];
    service.play(actorSession, actor.matchId!, actor.roundId!, actor.turnId!, [card!.id]);
    advance(service, actorSession);
    const challenger = service.current(challengerSession);
    service.challenge(
      challengerSession,
      challenger.matchId!,
      challenger.roundId!,
      challenger.turnId!,
    );
    const result = settle(service, challengerSession);

    expect(result.matchStatus).toBe('finished');
    expect(result.winnerMemberId).toBe(
      result.result?.loserMemberId === actor.viewerMemberId
        ? challenger.viewerMemberId
        : actor.viewerMemberId,
    );
  });

  it('treats a departure during an active match as a forfeit and ends the round', () => {
    const { service, created, joined } = readyRoom();

    service.leave(joined.sessionId);

    const pending = service.current(created.sessionId);
    expect(pending.transition?.kind).toBe('forfeit');
    expect(pending.result?.loserDisplayName).toBe('Nguoi choi');
    expect(() => service.start(created.sessionId)).toThrow(
      expect.objectContaining({ code: 'TRANSITION_IN_PROGRESS' }),
    );
    const host = advance(service, created.sessionId);
    expect(host.phase).toBe('waiting');
    expect(host.matchStatus).toBe('finished');
    expect(host.result).toMatchObject({ reason: 'forfeit' });
    expect(() => service.current(joined.sessionId)).toThrow(
      expect.objectContaining<Partial<RoomError>>({ code: 'NO_SESSION' }),
    );
  });
});
