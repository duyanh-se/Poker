import { RoomError, RoomService } from './room.service';
type TableSnapshot = ReturnType<RoomService['current']>;

function paced(service: RoomService, snapshot: TableSnapshot): TableSnapshot {
  while (snapshot.transition) {
    jest.setSystemTime(snapshot.transition.endsAt);
    snapshot = service.advanceTransition(snapshot.roomCode, snapshot.transition.id)!;
  }
  return snapshot;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function createStartedRoom(): {
  service: RoomService;
  hostSessionId: string;
  guestSessionId: string;
  hostMemberId: string;
  guestMemberId: string;
} {
  const service = new RoomService();
  const host = service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });
  const guest = service.join({
    roomCode: host.roomCode,
    password: host.password,
    displayName: 'Guest',
  });
  const hostMemberId = host.snapshot.viewerMemberId;
  const guestMemberId = guest.snapshot.viewerMemberId;

  service.grant(host.sessionId, hostMemberId, 100);
  service.grant(host.sessionId, guestMemberId, 100);

  return {
    service,
    hostSessionId: host.sessionId,
    guestSessionId: guest.sessionId,
    hostMemberId,
    guestMemberId,
  };
}

function createThreePlayerRoom(): {
  service: RoomService;
  sessions: Record<string, string>;
  memberIds: Record<string, string>;
} {
  const service = new RoomService();
  const host = service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });
  const guest = service.join({
    roomCode: host.roomCode,
    password: host.password,
    displayName: 'Guest',
  });
  const third = service.join({
    roomCode: host.roomCode,
    password: host.password,
    displayName: 'Third',
  });
  const sessions = {
    [host.snapshot.viewerMemberId]: host.sessionId,
    [guest.snapshot.viewerMemberId]: guest.sessionId,
    [third.snapshot.viewerMemberId]: third.sessionId,
  };
  for (const [memberId, sessionId] of Object.entries(sessions))
    service.grant(host.sessionId, memberId, 100);
  return {
    service,
    sessions,
    memberIds: {
      host: host.snapshot.viewerMemberId,
      guest: guest.snapshot.viewerMemberId,
      third: third.snapshot.viewerMemberId,
    },
  };
}

describe('RoomService administration', () => {
  it('holds dealing without a deadline and rejects early or repeated transition callbacks', () => {
    const room = createStartedRoom();
    const dealing = room.service.start(room.hostSessionId);
    expect(dealing.transition?.kind).toBe('deal');
    expect(dealing.transition!.endsAt - dealing.transition!.startedAt).toBe(1800);
    expect(dealing.deadlineAt).toBeUndefined();
    expect(dealing.actingMemberId).toBeUndefined();
    const id = dealing.transition!.id;
    expect(room.service.advanceTransition(dealing.roomCode, id)).toBeUndefined();
    expect(() => room.service.start(room.hostSessionId)).toThrow('Đang chuyển tiếp');
    expect(() => room.service.action(room.hostSessionId, dealing.handId!, '', 'fold')).toThrow(
      'Đang chuyển tiếp',
    );
    jest.setSystemTime(dealing.transition!.endsAt);
    const ready = room.service.advanceTransition(dealing.roomCode, id)!;
    expect(ready.deadlineAt).toBe(Date.now() + 180_000);
    expect(room.service.advanceTransition(dealing.roomCode, id)).toBeUndefined();
    expect(room.service.timeout(ready.roomCode, ready.handId!, ready.turnId!)).toBeUndefined();
    const reconnect = room.service.setConnected(room.hostSessionId, true);
    expect(reconnect.deadlineAt).toBe(ready.deadlineAt);
  });

  it('reveals each all-in street, then cards, winners and conserved payouts in separate stages', () => {
    const room = createStartedRoom();
    let snapshot = paced(room.service, room.service.start(room.hostSessionId));
    const session = (id?: string) =>
      id === room.hostMemberId ? room.hostSessionId : room.guestSessionId;
    snapshot = paced(
      room.service,
      room.service.action(
        session(snapshot.actingMemberId),
        snapshot.handId!,
        snapshot.turnId!,
        'all-in',
      ),
    );
    snapshot = room.service.action(
      session(snapshot.actingMemberId),
      snapshot.handId!,
      snapshot.turnId!,
      'call',
    );
    const advance = () => {
      const current = snapshot.transition!;
      jest.setSystemTime(current.endsAt);
      snapshot = room.service.advanceTransition(snapshot.roomCode, current.id)!;
    };
    for (const length of [3, 4, 5]) {
      expect(snapshot.board).toHaveLength(length);
      expect(snapshot.transition?.kind).toBe('street');
      expect(snapshot.transition!.endsAt - snapshot.transition!.startedAt).toBe(900);
      expect(snapshot.deadlineAt).toBeUndefined();
      expect(snapshot.pots).toEqual([]);
      expect(snapshot.players.filter((p) => p.holeCards)).toHaveLength(1);
      advance();
    }
    expect(snapshot.transition?.kind).toBe('showdown-reveal');
    expect(snapshot.players.filter((p) => p.holeCards)).toHaveLength(2);
    expect(snapshot.pots).toEqual([]);
    const total = () => snapshot.players.reduce((sum, p) => sum + Number(p.stack), 0);
    expect(total()).toBe(0);
    advance();
    expect(snapshot.transition?.kind).toBe('showdown-verdict');
    expect(snapshot.pots).toHaveLength(1);
    expect(total()).toBe(0);
    expect(() => room.service.grant(room.hostSessionId, room.hostMemberId, 1)).toThrow(
      'Đang chuyển tiếp',
    );
    const verdict = snapshot.transition!;
    advance();
    expect(snapshot.transition?.kind).toBe('payout');
    expect(total()).toBe(200);
    expect(snapshot.players.every((p) => p.contribution === 0)).toBe(true);
    expect(room.service.advanceTransition(snapshot.roomCode, verdict.id)).toBeUndefined();
    advance();
    expect(snapshot.phase).toBe('waiting');
    expect(total()).toBe(200);
  });

  it('keeps fold-win cards private and invalidates callbacks after forced closure', () => {
    const room = createStartedRoom();
    const ready = paced(room.service, room.service.start(room.hostSessionId));
    const actor =
      ready.actingMemberId === room.hostMemberId ? room.hostSessionId : room.guestSessionId;
    const result = room.service.action(actor, ready.handId!, ready.turnId!, 'fold');
    expect(result.transition?.kind).toBe('fold-win');
    expect(result.players.filter((p) => p.holeCards)).toHaveLength(1);
    expect(result.players.reduce((sum, p) => sum + Number(p.stack), 0)).toBe(200);
    room.service.close(room.hostSessionId, true);
    jest.setSystemTime(result.transition!.endsAt);
    expect(room.service.advanceTransition(result.roomCode, result.transition!.id)).toBeUndefined();
  });

  it('does not give a lone player a betting turn against short all-in blinds', () => {
    const service = new RoomService();
    const host = service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });
    const guest = service.join({
      roomCode: host.roomCode,
      password: host.password,
      displayName: 'Guest',
    });
    service.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    service.grant(host.sessionId, guest.snapshot.viewerMemberId, 3);
    const dealing = service.start(host.sessionId);
    jest.setSystemTime(dealing.transition!.endsAt);
    const flop = service.advanceTransition(dealing.roomCode, dealing.transition!.id)!;
    expect(flop.board).toHaveLength(3);
    expect(flop.actingMemberId).toBeUndefined();
    const settled = paced(service, flop);
    expect(settled.players.reduce((sum, p) => sum + Number(p.stack), 0)).toBe(103);
  });

  it('rejects invalid fixed blind and ante configuration', () => {
    const service = new RoomService();

    expect(() =>
      service.create({ displayName: 'Host', smallBlind: 10, bigBlind: 10, ante: 0 }),
    ).toThrow(RoomError);
    expect(() =>
      service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: -1 }),
    ).toThrow(RoomError);
  });

  it('rejects pause during an active hand', () => {
    const room = createStartedRoom();
    const started = room.service.start(room.hostSessionId);
    expect(started.phase).toBe('running');

    expect(() => room.service.pause(room.hostSessionId, true)).toThrow(RoomError);
  });

  it('transfers ownership only to a connected member', () => {
    const room = createStartedRoom();

    const transferred = room.service.transferHost(room.hostSessionId, room.guestMemberId);
    expect(transferred.hostMemberId).toBe(room.guestMemberId);

    room.service.setConnected(room.hostSessionId, false);
    expect(() => room.service.transferHost(room.guestSessionId, room.hostMemberId)).toThrow(
      RoomError,
    );
  });

  it('limits administration to the host and rejects it during a hand', () => {
    const room = createStartedRoom();
    expect(() => room.service.grant(room.guestSessionId, room.hostMemberId, 1)).toThrow(RoomError);
    expect(() => room.service.pause(room.guestSessionId, true)).toThrow(RoomError);

    const started = room.service.start(room.hostSessionId);
    expect(() => room.service.grant(room.hostSessionId, room.guestMemberId, 10)).toThrow(RoomError);
    expect(() => room.service.kick(room.hostSessionId, room.guestMemberId)).toThrow(RoomError);
    expect(() => room.service.transferHost(room.hostSessionId, room.guestMemberId)).toThrow(
      RoomError,
    );
    expect(() => room.service.close(room.hostSessionId)).toThrow(RoomError);
  });

  it('does not permit kicking an all-in member during a hand', () => {
    const room = createStartedRoom();
    let snapshot = paced(room.service, room.service.start(room.hostSessionId));

    if (snapshot.actingMemberId !== room.guestMemberId) {
      snapshot = paced(
        room.service,
        room.service.action(room.hostSessionId, snapshot.handId!, snapshot.turnId!, 'call'),
      );
    }
    snapshot = room.service.action(
      room.guestSessionId,
      snapshot.handId!,
      snapshot.turnId!,
      'all-in',
    );

    expect(() => room.service.kick(room.hostSessionId, room.guestMemberId)).toThrow(RoomError);
    expect(room.service.current(room.guestSessionId).players).toHaveLength(2);
  });

  it('does not permit kicking a non-all-in player during a hand', () => {
    const room = createThreePlayerRoom();
    let snapshot = room.service.start(room.sessions[room.memberIds.host]);
    expect(() =>
      room.service.kick(room.sessions[room.memberIds.host], room.memberIds.third),
    ).toThrow(RoomError);
    expect(snapshot.phase).toBe('running');
  });

  it('does not allow chip totals to exceed the safe integer limit', () => {
    const service = new RoomService();
    const host = service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });

    service.grant(host.sessionId, host.snapshot.viewerMemberId, Number.MAX_SAFE_INTEGER);
    expect(() => service.grant(host.sessionId, host.snapshot.viewerMemberId, 1)).toThrow(RoomError);
  });

  it('keeps a short blind contribution non-negative and marks that player all-in', () => {
    const service = new RoomService();
    const host = service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });
    const guest = service.join({
      roomCode: host.roomCode,
      password: host.password,
      displayName: 'Guest',
    });
    service.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    service.grant(host.sessionId, guest.snapshot.viewerMemberId, 3);

    const started = service.start(host.sessionId);
    const shortPlayer = started.players.find(
      (player) => player.memberId === guest.snapshot.viewerMemberId,
    ) as { stack: number; contribution: number; allIn: boolean };

    expect(shortPlayer).toMatchObject({ stack: 0, contribution: 3, allIn: true });
    expect(started.players.every((player) => (player as { stack: number }).stack >= 0)).toBe(true);
  });

  it('runs out and settles when no player has a betting decision', () => {
    const service = new RoomService();
    const host = service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });
    const guest = service.join({
      roomCode: host.roomCode,
      password: host.password,
      displayName: 'Guest',
    });
    service.grant(host.sessionId, host.snapshot.viewerMemberId, 3);
    service.grant(host.sessionId, guest.snapshot.viewerMemberId, 3);

    const settled = paced(service, service.start(host.sessionId));

    expect(settled.phase).toBe('waiting');
    expect(settled.board).toHaveLength(5);
    expect(
      settled.players.every((player) => (player as { holeCards: string[] }).holeCards.length === 2),
    ).toBe(true);
    expect(settled.pots).toHaveLength(1);
    expect(
      settled.players.reduce((total, player) => total + (player as { stack: number }).stack, 0),
    ).toBe(6);
  });

  it('rejects an ordinary raise smaller than the last full raise', () => {
    const room = createStartedRoom();
    const started = paced(room.service, room.service.start(room.hostSessionId));
    const actorSessionId =
      started.actingMemberId === room.hostMemberId ? room.hostSessionId : room.guestSessionId;

    expect(() =>
      room.service.action(actorSessionId, started.handId!, started.turnId!, 'raise', 15),
    ).toThrow(RoomError);
    expect(() =>
      room.service.action(actorSessionId, started.handId!, started.turnId!, 'raise', 20),
    ).not.toThrow();
  });

  it('projects only the legal actions for the acting player', () => {
    const room = createStartedRoom();
    const started = paced(room.service, room.service.start(room.hostSessionId));
    const actorSessionId =
      started.actingMemberId === room.hostMemberId ? room.hostSessionId : room.guestSessionId;
    const actorSnapshot = room.service.current(actorSessionId);

    expect(actorSnapshot.legalActions).toMatchObject({
      actions: expect.arrayContaining(['fold', 'call', 'raise']),
    });
    expect(actorSnapshot.legalActions?.actions).not.toContain('check');
    expect(actorSnapshot.legalActions?.actions).not.toContain('bet');
    expect(actorSnapshot.legalActions?.minRaiseTo).toBe(20);
  });

  it('keeps the big blind option and advances to the flop after the big blind checks', () => {
    const room = createStartedRoom();
    const started = paced(room.service, room.service.start(room.hostSessionId));
    const firstSessionId =
      started.actingMemberId === room.hostMemberId ? room.hostSessionId : room.guestSessionId;
    const afterCall = paced(
      room.service,
      room.service.action(firstSessionId, started.handId!, started.turnId!, 'call'),
    );
    const bigBlindSessionId =
      afterCall.actingMemberId === room.hostMemberId ? room.hostSessionId : room.guestSessionId;

    const flop = room.service.action(
      bigBlindSessionId,
      afterCall.handId!,
      afterCall.turnId!,
      'check',
    );
    expect(flop).toMatchObject({ street: 'flop', board: expect.any(Array) });
    expect(flop.board).toHaveLength(3);
    expect(flop.handInfo?.cards).toHaveLength(5);
    expect(flop.handInfo?.name).toBeTruthy();
  });

  it('projects private cards only to their owner until showdown', () => {
    const room = createStartedRoom();
    room.service.start(room.hostSessionId);
    const hostView = room.service.current(room.hostSessionId);
    const guestView = room.service.current(room.guestSessionId);
    const hostInGuestView = guestView.players.find(
      (player) => player.memberId === room.hostMemberId,
    ) as Record<string, unknown>;
    const guestInHostView = hostView.players.find(
      (player) => player.memberId === room.guestMemberId,
    ) as Record<string, unknown>;

    expect(hostInGuestView.holeCards).toBeUndefined();
    expect(guestInHostView.holeCards).toBeUndefined();
    expect(
      (
        hostView.players.find((player) => player.memberId === room.hostMemberId) as {
          holeCards: string[];
        }
      ).holeCards,
    ).toHaveLength(2);
    expect(
      (
        guestView.players.find((player) => player.memberId === room.guestMemberId) as {
          holeCards: string[];
        }
      ).holeCards,
    ).toHaveLength(2);
  });

  it('sits a player out after a timeout until they explicitly return', () => {
    const room = createStartedRoom();
    const started = paced(room.service, room.service.start(room.hostSessionId));
    const timedOutSessionId =
      started.actingMemberId === room.hostMemberId ? room.hostSessionId : room.guestSessionId;

    jest.setSystemTime(started.deadlineAt!);
    const settled = paced(
      room.service,
      room.service.timeout(started.roomCode, started.handId!, started.turnId!)!,
    );
    expect(settled.phase).toBe('waiting');
    expect(() => room.service.start(room.hostSessionId)).toThrow(RoomError);

    room.service.returnToTable(timedOutSessionId);
    expect(room.service.start(room.hostSessionId).phase).toBe('running');
  });

  it('closes the room when its host leaves without transferring ownership', () => {
    const service = new RoomService();
    const host = service.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });

    service.leave(host.sessionId);

    expect(() => service.current(host.sessionId)).toThrow(RoomError);
  });
});
