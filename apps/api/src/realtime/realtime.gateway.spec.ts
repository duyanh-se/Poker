import type { Socket } from 'socket.io';

import { RoomService } from '../rooms/room.service';
import { RealtimeGateway } from './realtime.gateway';

type GatewayInternals = { activeSockets: Map<string, string> };

function socket(id: string, sessionId: string): Socket {
  return {
    id,
    data: { sessionId, memberKey: '' },
    handshake: { headers: { cookie: `poker_session=${sessionId}` } },
    join: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as Socket;
}

function setupGateway() {
  const rooms = new RoomService();
  const host = rooms.create({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 });
  const guest = rooms.join({
    roomCode: host.roomCode,
    password: host.password,
    displayName: 'Guest',
  });
  const gateway = new RealtimeGateway(rooms);
  const server = {
    sockets: new Map<string, Socket>(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
  gateway.afterInit(server as never);
  return { rooms, host, guest, gateway, server };
}

describe('RealtimeGateway connection lifecycle', () => {
  afterEach(() => jest.useRealTimers());

  it('rearms an early transition callback instead of leaving the table waiting forever', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    gateway.start(socket('host', host.sessionId), { commandId: 'start' });
    const transition = rooms.current(host.sessionId).transition!;
    const now = jest.spyOn(Date, 'now').mockReturnValue(transition.endsAt - 1);
    jest.advanceTimersByTime(1800);
    now.mockRestore();
    expect(rooms.current(host.sessionId).transition?.id).toBe(transition.id);
    jest.advanceTimersByTime(1);
    const live = rooms.current(host.sessionId);
    expect(live.transition).toBeUndefined();
    expect(live.turnId).toBeDefined();
    expect(live.deadlineAt).toBe(Date.now() + 180000);
    gateway.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not schedule host closure when sockets disconnect during shutdown', () => {
    jest.useFakeTimers();
    const { host, gateway } = setupGateway();
    const hostSocket = socket('host', host.sessionId);
    gateway.handleConnection(hostSocket);
    gateway.onModuleDestroy();
    gateway.handleDisconnect(hostSocket);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rearms an early action deadline and still applies timeout exactly once', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    gateway.start(socket('host', host.sessionId), { commandId: 'start' });
    jest.advanceTimersByTime(1800);
    const before = rooms.current(host.sessionId);
    const timeout = jest.spyOn(rooms, 'timeout');
    const now = jest.spyOn(Date, 'now').mockReturnValue(before.deadlineAt! - 1);
    jest.advanceTimersByTime(180000);
    now.mockRestore();
    expect(timeout).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(rooms.current(host.sessionId).turnId).not.toBe(before.turnId);
    gateway.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps only the newest control socket for a member', () => {
    const { rooms, host, gateway, server } = setupGateway();
    const first = socket('first', host.sessionId);
    const second = socket('second', host.sessionId);
    server.sockets.set(first.id, first);

    gateway.handleConnection(first);
    gateway.handleConnection(second);
    gateway.handleDisconnect(first);

    expect(first.disconnect).toHaveBeenCalledWith(true);
    expect(
      rooms
        .current(host.sessionId)
        .players.find((player) => player.memberId === host.snapshot.viewerMemberId),
    ).toMatchObject({
      connected: true,
    });
  });

  it('rejects a browser socket from an unapproved origin', () => {
    const { host, gateway } = setupGateway();
    const untrusted = socket('untrusted', host.sessionId);
    untrusted.handshake.headers.origin = 'https://untrusted.example';

    gateway.handleConnection(untrusted);

    expect(untrusted.disconnect).toHaveBeenCalledWith(true);
  });

  it('marks the host disconnected and closes the room after 180 seconds', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    const hostSocket = socket('host', host.sessionId);
    const memberKey = `${host.roomCode}:${host.snapshot.viewerMemberId}`;
    hostSocket.data.memberKey = memberKey;
    (gateway as unknown as GatewayInternals).activeSockets.set(memberKey, hostSocket.id);

    gateway.handleDisconnect(hostSocket);
    expect(
      rooms
        .current(guest.sessionId)
        .players.find((player) => player.memberId === host.snapshot.viewerMemberId),
    ).toMatchObject({
      connected: false,
    });

    jest.advanceTimersByTime(180_000);
    expect(() => rooms.current(host.sessionId)).toThrow();
  });

  it('cancels host closure when the host reconnects before the deadline', () => {
    jest.useFakeTimers();
    const { rooms, host, gateway, server } = setupGateway();
    const disconnected = socket('old-host', host.sessionId);
    const memberKey = `${host.roomCode}:${host.snapshot.viewerMemberId}`;
    disconnected.data.memberKey = memberKey;
    (gateway as unknown as GatewayInternals).activeSockets.set(memberKey, disconnected.id);
    gateway.handleDisconnect(disconnected);

    const reconnected = socket('new-host', host.sessionId);
    gateway.handleConnection(reconnected);
    jest.advanceTimersByTime(180_000);

    expect(rooms.current(host.sessionId).roomCode).toBe(host.roomCode);
    expect(server.to).toHaveBeenCalled();
  });

  it('notifies room members when the host closes the room', () => {
    const { rooms, host, gateway, server } = setupGateway();
    const hostSocket = socket('host', host.sessionId);

    expect(gateway.close(hostSocket, { commandId: 'close-room' })).toEqual({ ok: true });
    expect(() => rooms.current(host.sessionId)).toThrow();
    expect(server.to).toHaveBeenCalledWith(`member:${host.snapshot.viewerMemberId}`);
  });

  it('accepts a command identifier at most once and rejects a stale action', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    gateway.start(socket('host', host.sessionId), { commandId: 'start' });
    jest.advanceTimersByTime(1800);
    const started = rooms.current(host.sessionId);
    const actorSessionId =
      started.actingMemberId === host.snapshot.viewerMemberId ? host.sessionId : guest.sessionId;
    const actorMemberId = started.actingMemberId!;
    const actorSocket = socket('actor', actorSessionId);
    const command = {
      commandId: 'call-once',
      handId: started.handId!,
      turnId: started.turnId!,
      action: 'call' as const,
    };

    expect(gateway.action(actorSocket, command)).toEqual({ ok: true });
    const stackAfterFirstCall = rooms
      .current(actorSessionId)
      .players.find((player) => player.memberId === actorMemberId) as { stack: number };
    expect(gateway.action(actorSocket, command)).toEqual({ ok: true });
    expect(
      rooms.current(actorSessionId).players.find((player) => player.memberId === actorMemberId),
    ).toMatchObject({ stack: stackAfterFirstCall.stack });
    jest.advanceTimersByTime(450);
    expect(
      gateway.action(actorSocket, { ...command, commandId: 'stale', handId: 'old-hand' }),
    ).toEqual({ ok: false, code: 'STALE_ACTION' });
    gateway.onModuleDestroy();
  });

  it('does not grant chips twice when a host retries the same command', () => {
    const { rooms, host, guest, gateway } = setupGateway();
    const hostSocket = socket('host', host.sessionId);
    const command = {
      commandId: 'grant-once',
      memberId: guest.snapshot.viewerMemberId,
      amount: 50,
    };

    expect(gateway.grant(hostSocket, command)).toEqual({ ok: true });
    expect(gateway.grant(hostSocket, command)).toEqual({ ok: true });
    expect(
      rooms
        .current(guest.sessionId)
        .players.find((player) => player.memberId === guest.snapshot.viewerMemberId),
    ).toMatchObject({ stack: 50 });
  });

  it('keeps a completed hand visible until the host starts the next hand', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    const hostSocket = socket('host', host.sessionId);
    const guestSocket = socket('guest', guest.sessionId);

    expect(gateway.start(hostSocket, { commandId: 'start' })).toEqual({ ok: true });
    jest.advanceTimersByTime(1800);
    const started = rooms.current(host.sessionId);
    const actorSocket =
      started.actingMemberId === host.snapshot.viewerMemberId ? hostSocket : guestSocket;
    expect(
      gateway.action(actorSocket, {
        commandId: 'fold-to-finish',
        handId: started.handId as string,
        turnId: started.turnId as string,
        action: 'fold',
      }),
    ).toEqual({ ok: true });
    jest.advanceTimersByTime(1200);
    expect(rooms.current(host.sessionId)).toMatchObject({
      phase: 'waiting',
      handId: started.handId,
    });

    jest.advanceTimersByTime(8_000);
    expect(rooms.current(host.sessionId)).toMatchObject({
      phase: 'waiting',
      handId: started.handId,
    });
    gateway.onModuleDestroy();
  });

  it('rejects pause commands while a hand is running', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    const hostSocket = socket('host', host.sessionId);
    const guestSocket = socket('guest', guest.sessionId);

    gateway.start(hostSocket, { commandId: 'start' });
    jest.advanceTimersByTime(1800);
    expect(gateway.pause(hostSocket, { commandId: 'pause-during-hand', paused: true })).toEqual({
      ok: false,
      code: 'HAND_IN_PROGRESS',
    });
    const started = rooms.current(host.sessionId);
    const actorSocket =
      started.actingMemberId === host.snapshot.viewerMemberId ? hostSocket : guestSocket;
    gateway.action(actorSocket, {
      commandId: 'fold-to-waiting',
      handId: started.handId as string,
      turnId: started.turnId as string,
      action: 'fold',
    });
    jest.advanceTimersByTime(1200);

    expect(rooms.current(host.sessionId).phase).toBe('waiting');
    jest.advanceTimersByTime(8_000);
    expect(rooms.current(host.sessionId).phase).toBe('waiting');
    gateway.onModuleDestroy();
  });

  it('synchronizes dealing, rejects early actions and gives a full deadline after reconnect', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    const hostSocket = socket('host', host.sessionId);
    gateway.handleConnection(hostSocket);
    gateway.start(hostSocket, { commandId: 'start' });
    const initial = rooms.current(host.sessionId);
    expect(initial.transition?.kind).toBe('deal');
    expect(rooms.current(guest.sessionId).transition).toEqual(initial.transition);
    expect(initial.deadlineAt).toBeUndefined();
    expect(gateway.start(hostSocket, { commandId: 'early-start' })).toEqual({
      ok: false,
      code: 'TRANSITION_IN_PROGRESS',
    });
    jest.advanceTimersByTime(900);
    gateway.handleConnection(socket('reloaded', host.sessionId));
    expect(rooms.current(host.sessionId).transition).toEqual(initial.transition);
    jest.advanceTimersByTime(900);
    const live = rooms.current(host.sessionId);
    expect(live.transition).toBeUndefined();
    expect(live.deadlineAt).toBe(Date.now() + 180000);
    gateway.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels a pending transition on shutdown without advancing or awarding anything', () => {
    jest.useFakeTimers();
    const { rooms, host, guest, gateway } = setupGateway();
    rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
    rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    gateway.start(socket('host', host.sessionId), { commandId: 'start' });
    const before = rooms.current(host.sessionId);
    gateway.onModuleDestroy();
    jest.advanceTimersByTime(10000);
    expect(rooms.current(host.sessionId).transition).toEqual(before.transition);
    expect(jest.getTimerCount()).toBe(0);
  });
});
