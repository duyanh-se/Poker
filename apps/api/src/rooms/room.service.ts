import { Injectable } from '@nestjs/common';

import { LiarsRoomService } from '../liars-deck/liars-room.service';
import { PokerRoomService, type PokerTableSnapshot } from './poker-room.service';
import { RoomError } from './room-error';

export { RoomError } from './room-error';

type CreateRoom = {
  displayName: string;
  gameType?: 'poker' | 'liars-deck';
  smallBlind?: number;
  bigBlind?: number;
  ante?: number;
  startingLives?: number;
};

type JoinRoom = { roomCode: string; password: string; displayName: string };

/** Owns the two in-memory engines for the lifetime of this Nest singleton. */
@Injectable()
export class RoomService {
  private readonly poker = new PokerRoomService();
  private readonly liars = new LiarsRoomService();

  create(request: CreateRoom): {
    roomCode: string;
    password: string;
    sessionId: string;
    snapshot: PokerTableSnapshot;
  } {
    if (request.gameType === 'liars-deck')
      return this.liars.create(request, (code) => this.poker.hasRoom(code)) as never;
    if (request.gameType && request.gameType !== 'poker')
      throw new RoomError('INVALID_CONFIG', 'Loại game không hợp lệ.');
    if (request.startingLives !== undefined)
      throw new RoomError('INVALID_CONFIG', 'Poker không dùng cấu hình số mạng.');
    return this.poker.create(
      request as { displayName: string; smallBlind: number; bigBlind: number; ante: number },
    );
  }

  join(request: JoinRoom): { sessionId: string; snapshot: PokerTableSnapshot } {
    return this.byRoom(request.roomCode).join(request) as never;
  }

  current(sessionId: string): PokerTableSnapshot {
    return this.bySession(sessionId).current(sessionId) as never;
  }

  session(sessionId: string): { roomCode: string; memberId: string } {
    return this.bySession(sessionId).session(sessionId);
  }

  snapshots(roomCode: string): Array<{ memberId: string; snapshot: PokerTableSnapshot }> {
    return this.byRoom(roomCode).snapshots(roomCode) as never;
  }

  setConnected(sessionId: string, connected: boolean): PokerTableSnapshot {
    return this.bySession(sessionId).setConnected(sessionId, connected) as never;
  }

  pause(sessionId: string, paused: boolean): PokerTableSnapshot {
    return this.bySession(sessionId).pause(sessionId, paused) as never;
  }

  transferHost(sessionId: string, targetId: string): PokerTableSnapshot {
    return this.bySession(sessionId).transferHost(sessionId, targetId) as never;
  }

  kick(sessionId: string, targetId: string): PokerTableSnapshot {
    return this.bySession(sessionId).kick(sessionId, targetId) as never;
  }

  close(sessionId: string, force = false): void {
    this.bySession(sessionId).close(sessionId, force);
  }

  leave(sessionId: string): void {
    this.bySession(sessionId).leave(sessionId);
  }

  grant(sessionId: string, targetId: string, amount: number): PokerTableSnapshot {
    return this.bySession(sessionId).grant(sessionId, targetId, amount) as never;
  }

  start(sessionId: string): PokerTableSnapshot {
    return this.bySession(sessionId).start(sessionId) as never;
  }

  returnToTable(sessionId: string): PokerTableSnapshot {
    return this.bySession(sessionId).returnToTable(sessionId) as never;
  }

  action(
    sessionId: string,
    handId: string,
    turnId: string,
    action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in',
    amount?: number,
  ): PokerTableSnapshot {
    return this.pokerOnly(sessionId).action(sessionId, handId, turnId, action, amount);
  }

  timeout(roomCode: string, actionId: string, turnId: string): PokerTableSnapshot | undefined {
    const service = this.byRoom(roomCode);
    if (service instanceof LiarsRoomService) {
      const snapshot = service.snapshots(roomCode)[0]?.snapshot;
      if (!snapshot?.deadlineAt || Date.now() < snapshot.deadlineAt) return undefined;
    }
    return service.timeout(roomCode, actionId, turnId) as never;
  }

  advanceTransition(roomCode: string, transitionId: string): PokerTableSnapshot | undefined {
    try {
      return this.byRoom(roomCode).advanceTransition(roomCode, transitionId) as never;
    } catch (error) {
      if (error instanceof RoomError && error.code === 'ROOM_NOT_FOUND') return undefined;
      throw error;
    }
  }

  play(
    sessionId: string,
    matchId: string,
    roundId: string,
    turnId: string,
    cardIds: string[],
  ): PokerTableSnapshot {
    return this.liarsOnly(sessionId).play(sessionId, matchId, roundId, turnId, cardIds) as never;
  }

  challenge(
    sessionId: string,
    matchId: string,
    roundId: string,
    turnId: string,
  ): PokerTableSnapshot {
    return this.liarsOnly(sessionId).challenge(sessionId, matchId, roundId, turnId) as never;
  }

  private byRoom(roomCode: string): PokerRoomService | LiarsRoomService {
    if (this.poker.hasRoom(roomCode)) return this.poker;
    if (this.liars.hasRoom(roomCode)) return this.liars;
    throw new RoomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại.');
  }

  private bySession(sessionId: string): PokerRoomService | LiarsRoomService {
    if (this.poker.hasSession(sessionId)) return this.poker;
    if (this.liars.hasSession(sessionId)) return this.liars;
    throw new RoomError('NO_SESSION', 'Phiên chơi không còn tồn tại.');
  }

  private pokerOnly(sessionId: string): PokerRoomService {
    const service = this.bySession(sessionId);
    if (!(service instanceof PokerRoomService))
      throw new RoomError('WRONG_GAME', 'Lệnh này chỉ dùng cho Poker.');
    return service;
  }

  private liarsOnly(sessionId: string): LiarsRoomService {
    const service = this.bySession(sessionId);
    if (!(service instanceof LiarsRoomService))
      throw new RoomError('WRONG_GAME', 'Lệnh này chỉ dùng cho Bài nói dối.');
    return service;
  }
}
