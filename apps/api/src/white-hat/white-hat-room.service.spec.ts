import type { WhiteHatActionIds, WhiteHatSnapshot } from '@poker/contracts';
import type { Socket } from 'socket.io';
import { RoomService } from '../rooms/room.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WhiteHatRoomService } from './white-hat-room.service';

function room(count = 4) {
  const service = new WhiteHatRoomService();
  const host = service.create({ displayName: 'Moderator' }, () => false);
  const sessions = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const joined = service.join({
      roomCode: host.roomCode,
      password: host.password,
      displayName: `Player ${i}`,
    });
    sessions.set(joined.snapshot.viewerMemberId, joined.sessionId);
    service.setConnected(joined.sessionId, true);
  }
  service.setConnected(host.sessionId, true);
  service.configure(host.sessionId, {
    eliminationsPerRound: 1,
    roleMode: 'auto',
    spyCount: 1,
    whiteCount: 1,
    civilianWord: 'Cà phê',
    spyWord: 'Trà sữa',
  });
  return { service, host, sessions };
}
const ids = (s: WhiteHatSnapshot): WhiteHatActionIds => ({
  matchId: s.matchId!,
  roundId: s.roundId!,
  turnId: s.turnId!,
});
function describeAll(r: ReturnType<typeof room>) {
  while (r.service.current(r.host.sessionId).stage === 'description') {
    const s = r.service.current(r.host.sessionId);
    r.service.describe(
      r.sessions.get(s.actingMemberId!)!,
      ids(s),
      `Gợi ý ${s.descriptions.length}`,
    );
  }
}

describe('WhiteHatRoomService privacy and lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10000);
  });
  afterEach(() => jest.useRealTimers());
  it('keeps moderator out of allocation and sends no role labels or other words to players', () => {
    const r = room();
    const state = r.service.start(r.host.sessionId);
    expect(state.moderator!.roles).toHaveLength(4);
    expect(state.privateWord).toBeUndefined();
    for (const [memberId, session] of r.sessions) {
      const s = r.service.current(session);
      const role = state.moderator!.roles.find((p) => p.memberId === memberId)!.role;
      expect(s.privateWord).toBe(
        role === 'white-hat' ? null : role === 'spy' ? 'Trà sữa' : 'Cà phê',
      );
      expect(s.moderator).toBeUndefined();
      expect(s.result).toBeUndefined();
      expect(s.players.every((p) => p.role === undefined)).toBe(true);
      expect(s.legalActions.canGuess).toBe(role === 'white-hat');
    }
    expect(() => r.service.describe(r.host.sessionId, ids(state), 'x')).toThrow();
  });
  it('rejects changes/joins/kicks/transfer during play, restores deadlines and protects host setup', () => {
    const r = room();
    const state = r.service.start(r.host.sessionId);
    const session = [...r.sessions.values()][0];
    expect(() => r.service.configure(session, state.moderator!)).toThrow();
    expect(() => r.service.configure(r.host.sessionId, state.moderator!)).toThrow();
    expect(() =>
      r.service.join({ roomCode: r.host.roomCode, password: r.host.password, displayName: 'New' }),
    ).toThrow();
    expect(() => r.service.kick(r.host.sessionId, state.actingMemberId!)).toThrow();
    expect(() => r.service.transferHost(r.host.sessionId, state.actingMemberId!)).toThrow();
    r.service.setConnected(session, false);
    jest.advanceTimersByTime(1000);
    const restored = r.service.setConnected(session, true);
    expect(restored.deadlineAt).toBe(state.deadlineAt);
    expect(restored.turnId).toBe(state.turnId);
    expect(restored.moderator).toBeUndefined();
  });
  it('exposes only own ballot before close, then all ballots, but never eliminated role counts', () => {
    const r = room();
    r.service.start(r.host.sessionId);
    describeAll(r);
    const voting = r.service.advance(r.host.sessionId, ids(r.service.current(r.host.sessionId)));
    const roles = voting.moderator!.roles;
    const target = roles.find((p) => p.role === 'civilian')!.memberId;
    const first = [...r.sessions].find(([id]) => id !== target)!;
    r.service.vote(first[1], ids(voting), [target]);
    expect(r.service.current(first[1]).ownBallot).toEqual([target]);
    expect(r.service.current(r.host.sessionId).ownBallot).toBeUndefined();
    expect(r.service.current(r.host.sessionId).ballotResults).toEqual([]);
    for (const [memberId, session] of r.sessions)
      if (memberId !== first[0])
        r.service.vote(session, ids(voting), [
          memberId === target ? roles.find((p) => p.memberId !== memberId)!.memberId : target,
        ]);
    const dead = r.service.current(r.sessions.get(target)!);
    expect(dead.stage).toBe('last-guess');
    expect(dead.ballotResults[0].ballots).toHaveLength(4);
    expect(dead.players.find((p) => p.memberId === target)!.role).toBeUndefined();
    expect(dead.legalActions).toMatchObject({
      canChat: false,
      canDescribe: false,
      canVote: false,
      canGuess: false,
    });
    expect(dead.config).toEqual(voting.config);
    expect(r.service.timeout(voting.roomCode, voting.roundId!, voting.turnId!)).toBeUndefined();
  });
  it('reveals everyone on a correct guess and requires fresh setup for another match', () => {
    const r = room();
    const start = r.service.start(r.host.sessionId);
    describeAll(r);
    const white = start.moderator!.roles.find((p) => p.role === 'white-hat')!.memberId;
    const finished = r.service.guess(
      r.sessions.get(white)!,
      ids(r.service.current(r.host.sessionId)),
      'CÀ PHÊ',
    );
    expect(finished.players.filter((p) => !p.isModerator).every((p) => p.role)).toBe(true);
    expect(finished.result).toMatchObject({
      winner: 'white-hat',
      civilianWord: 'Cà phê',
      spyWord: 'Trà sữa',
      winnerMemberIds: [white],
    });
    expect(() => r.service.start(r.host.sessionId)).toThrow();
    r.service.transferHost(r.host.sessionId, white);
    const nextHost = r.service.current(r.sessions.get(white)!);
    expect(nextHost.moderator).toMatchObject({ civilianWord: '', spyWord: '', roles: [] });
    expect(r.service.current(r.host.sessionId).moderator).toBeUndefined();
  });
  it('limits seats, handles duplicate names and revokes departing sessions without rejoin resets', () => {
    const r = room(12);
    expect(() =>
      r.service.join({ roomCode: r.host.roomCode, password: r.host.password, displayName: '13' }),
    ).toThrow();
    r.service.start(r.host.sessionId);
    const [memberId, session] = [...r.sessions][0];
    r.service.leave(session);
    expect(() => r.service.current(session)).toThrow();
    expect(
      r.service.current(r.host.sessionId).players.find((p) => p.memberId === memberId),
    ).toMatchObject({ departed: true, eliminated: true });
    expect(() =>
      r.service.join({
        roomCode: r.host.roomCode,
        password: r.host.password,
        displayName: 'Again',
      }),
    ).toThrow();
    r.service.close(r.host.sessionId);
    expect(() => r.service.current([...r.sessions.values()][1])).toThrow();
    const other = room();
    expect(() =>
      other.service.join({
        roomCode: other.host.roomCode,
        password: other.host.password,
        displayName: ' PLAYER 0 ',
      }),
    ).toThrow();
  });
  it('stores self-selected avatars across reconnect, new matches and moderator transfer without resetting turns', () => {
    const r = room();
    const start = r.service.start(r.host.sessionId);
    const [member, session] = [...r.sessions][0];
    for (const value of [-1, 12, 1.5, '2', null, NaN])
      expect(() => r.service.setAvatar(session, value)).toThrow();
    const changed = r.service.setAvatar(session, 11);
    expect(changed.turnId).toBe(start.turnId);
    expect(changed.deadlineAt).toBe(start.deadlineAt);
    expect(changed.players.find((p) => p.memberId === member)?.avatarId).toBe(11);
    expect(
      r.service.current(r.host.sessionId).players.find((p) => p.memberId === member)?.avatarId,
    ).toBe(11);
    r.service.setConnected(session, false);
    expect(
      r.service.setConnected(session, true).players.find((p) => p.memberId === member)?.avatarId,
    ).toBe(11);
    r.service.endMatch(r.host.sessionId, ids(start));
    r.service.configure(r.host.sessionId, start.moderator!);
    const next = r.service.start(r.host.sessionId);
    expect(next.players.find((p) => p.memberId === member)?.avatarId).toBe(11);
    r.service.endMatch(r.host.sessionId, ids(next));
    const transfer = r.service.transferHost(r.host.sessionId, member);
    expect(transfer.players.find((p) => p.memberId === member)?.avatarId).toBe(11);
  });
  it('allows only the moderator to end a current match, even at an expired deadline, and keeps the room', () => {
    const r = room();
    const start = r.service.start(r.host.sessionId);
    const session = [...r.sessions.values()][0];
    expect(() => r.service.endMatch(session, ids(start))).toThrow();
    expect(() => r.service.endMatch(r.host.sessionId, { ...ids(start), matchId: 'old' })).toThrow();
    jest.setSystemTime(start.deadlineAt!);
    const ended = r.service.endMatch(r.host.sessionId, ids(start));
    expect(ended.result).toMatchObject({
      outcome: 'cancelled',
      winner: null,
      winnerMemberIds: [],
      civilianWord: 'Cà phê',
      spyWord: 'Trà sữa',
    });
    expect(ended.stage).toBe('finished');
    expect(ended.deadlineAt).toBeUndefined();
    const guest = r.service.current(session);
    expect(guest.players.filter((p) => !p.isModerator).every((p) => p.role)).toBe(true);
    expect(guest.legalActions.canGuess).toBe(false);
    expect(() => r.service.guess(session, ids(start), 'Cà phê')).toThrow();
    expect(r.service.timeout(start.roomCode, start.roundId!, start.turnId!)).toBeUndefined();
    expect(() => r.service.start(r.host.sessionId)).toThrow();
    r.service.configure(r.host.sessionId, start.moderator!);
    const next = r.service.start(r.host.sessionId);
    expect(next.matchId).not.toBe(start.matchId);
    expect(() => r.service.endMatch(r.host.sessionId, ids(start))).toThrow();
  });
});

describe('White-hat facade and gateway integrity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10000);
  });
  afterEach(() => jest.useRealTimers());
  it('routes all games, rejects mixed config and blocks eliminated chat', () => {
    const service = new RoomService();
    expect(() =>
      service.create({ displayName: 'H', gameType: 'white-hat', smallBlind: 1 }),
    ).toThrow();
    expect(() =>
      service.create({ displayName: 'H', gameType: 'liars-deck', eliminationsPerRound: 1 }),
    ).toThrow();
    const host = service.create({ displayName: 'H', gameType: 'white-hat' });
    const sessions = new Map<string, string>();
    for (let i = 0; i < 4; i++) {
      const p = service.join({
        roomCode: host.roomCode,
        password: host.password,
        displayName: `P${i}`,
      });
      sessions.set(p.snapshot.viewerMemberId, p.sessionId);
      service.setConnected(p.sessionId, true);
    }
    service.setConnected(host.sessionId, true);
    service.configureWhiteHat(host.sessionId, {
      eliminationsPerRound: 1,
      roleMode: 'auto',
      spyCount: 1,
      whiteCount: 1,
      civilianWord: 'Cà phê',
      spyWord: 'Trà',
    });
    service.start(host.sessionId);
    let s = service.current(host.sessionId) as unknown as WhiteHatSnapshot;
    while (s.stage === 'description') {
      service.whiteHatAction(
        sessions.get(s.actingMemberId!)!,
        'describe',
        ids(s),
        `Gợi ý ${s.descriptions.length}`,
      );
      s = service.current(host.sessionId) as unknown as WhiteHatSnapshot;
    }
    const white = s.moderator!.roles.find((p) => p.role === 'white-hat')!.memberId;
    service.whiteHatAction(sessions.get(white)!, 'guess', ids(s), 'sai');
    expect(() => service.sendChat(sessions.get(white)!, 'blocked', 'Tiết lộ')).toThrow();
    expect(service.sendChat(host.sessionId, 'ok', 'Cùng thảo luận').message.text).toBe(
      'Cùng thảo luận',
    );
    expect(() => service.play(host.sessionId, 'x', 'x', 'x', [])).toThrow();
    expect(() => service.action(host.sessionId, 'x', 'x', 'check')).toThrow();
    service.close(host.sessionId);
  });
  it('applies duplicate commands once, rejects replaced controllers and cleans timers on host expiry', () => {
    const rooms = new RoomService();
    const gateway = new RealtimeGateway(rooms);
    const server = {
      sockets: new Map<string, Socket>(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
    gateway.afterInit(server as never);
    const host = rooms.create({ gameType: 'white-hat', displayName: 'H' });
    function socket(sessionId: string): Socket {
      const socket = {
        id: `${sessionId}:${Math.random()}`,
        data: {},
        handshake: { headers: { cookie: `poker_session=${sessionId}` } },
        join: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;
      server.sockets.set(socket.id, socket);
      gateway.handleConnection(socket);
      return socket;
    }
    const hostSocket = socket(host.sessionId);
    const sockets = new Map<string, Socket>();
    for (let i = 0; i < 4; i++) {
      const p = rooms.join({
        roomCode: host.roomCode,
        password: host.password,
        displayName: `P${i}`,
      });
      sockets.set(p.snapshot.viewerMemberId, socket(p.sessionId));
    }
    expect(
      gateway.configureWhiteHat(hostSocket, {
        commandId: 'config',
        setup: {
          eliminationsPerRound: 1,
          roleMode: 'auto',
          spyCount: 1,
          whiteCount: 1,
          civilianWord: 'Cà phê',
          spyWord: 'Trà',
        },
      }).ok,
    ).toBe(true);
    expect(gateway.start(hostSocket, { commandId: 'start' }).ok).toBe(true);
    const state = rooms.current(host.sessionId) as unknown as WhiteHatSnapshot;
    const actor = sockets.get(state.actingMemberId!)!;
    const replacement = socket(actor.data.sessionId);
    expect(gateway.describeWhiteHat(actor, { ...ids(state), commandId: 'old', text: 'x' }).ok).toBe(
      false,
    );
    const body = { ...ids(state), commandId: 'describe', text: 'Đồ uống' };
    expect(gateway.describeWhiteHat(replacement, body).ok).toBe(true);
    expect(gateway.describeWhiteHat(replacement, body).ok).toBe(true);
    expect(
      (rooms.current(host.sessionId) as unknown as WhiteHatSnapshot).descriptions,
    ).toHaveLength(1);
    expect(gateway.describeWhiteHat(replacement, { ...body, commandId: 'stale' }).ok).toBe(false);
    expect(gateway.setWhiteHatAvatar(actor, { commandId: 'old-avatar', avatarId: 3 }).ok).toBe(
      false,
    );
    expect(
      gateway.setWhiteHatAvatar(replacement, { commandId: 'bad-avatar', avatarId: 12 }).ok,
    ).toBe(false);
    expect(gateway.setWhiteHatAvatar(replacement, { commandId: 'avatar', avatarId: 3 }).ok).toBe(
      true,
    );
    const version = rooms.current(host.sessionId).version;
    expect(gateway.setWhiteHatAvatar(replacement, { commandId: 'avatar', avatarId: 3 }).ok).toBe(
      true,
    );
    expect(rooms.current(host.sessionId).version).toBe(version);
    const current = rooms.current(host.sessionId) as unknown as WhiteHatSnapshot;
    const end = { ...ids(current), commandId: 'end-match' };
    expect(gateway.endWhiteHat(replacement, end).ok).toBe(false);
    expect(gateway.endWhiteHat(hostSocket, end).ok).toBe(true);
    expect(gateway.endWhiteHat(hostSocket, end).ok).toBe(true);
    expect(
      (rooms.current(host.sessionId) as unknown as WhiteHatSnapshot).result?.winner,
    ).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    gateway.handleDisconnect(hostSocket);
    jest.advanceTimersByTime(180000);
    expect(() => rooms.current(host.sessionId)).toThrow();
    gateway.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
