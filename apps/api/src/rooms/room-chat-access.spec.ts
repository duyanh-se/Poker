import { RoomService } from './room.service';

describe.each(['poker', 'liars-deck'] as const)('%s chat membership', (gameType) => {
  it('allows chat during transitions without changing deadlines and revokes departed sessions', () => {
    const rooms = new RoomService();
    const host = rooms.create(
      gameType === 'poker'
        ? { displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 }
        : { displayName: 'Host', gameType },
    );
    const guest = rooms.join({
      roomCode: host.roomCode,
      password: host.password,
      displayName: 'Guest',
    });
    rooms.setConnected(host.sessionId, true);
    rooms.setConnected(guest.sessionId, true);
    if (gameType === 'poker') {
      rooms.grant(host.sessionId, host.snapshot.viewerMemberId, 100);
      rooms.grant(host.sessionId, guest.snapshot.viewerMemberId, 100);
    }
    const before = rooms.start(host.sessionId);
    rooms.sendChat(guest.sessionId, 'hello', 'during deal');
    const after = rooms.current(host.sessionId);
    expect(after.transition).toEqual(before.transition);
    expect(after.version).toBe(before.version);
    expect(after.deadlineAt).toBe(before.deadlineAt);
    rooms.close(host.sessionId, true);
    expect(() => rooms.sendChat(guest.sessionId, 'left', 'hello')).toThrow();
    expect(() => rooms.chatHistory(guest.sessionId)).toThrow();
    expect(() => rooms.chatHistory(host.sessionId)).toThrow();
  });
  it('rejects chat and history after a member leaves between games', () => {
    const rooms = new RoomService();
    const host = rooms.create(
      gameType === 'poker'
        ? { displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 }
        : { displayName: 'Host', gameType },
    );
    const guest = rooms.join({
      roomCode: host.roomCode,
      password: host.password,
      displayName: 'Guest',
    });
    rooms.leave(guest.sessionId);
    expect(() => rooms.sendChat(guest.sessionId, 'left', 'hello')).toThrow();
    expect(() => rooms.chatHistory(guest.sessionId)).toThrow();
  });
});
