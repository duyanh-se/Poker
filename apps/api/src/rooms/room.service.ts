import { Injectable } from '@nestjs/common';

import { LiarsRoomService } from '../liars-deck/liars-room.service';
import { PokerRoomService, type PokerTableSnapshot } from './poker-room.service';
import { RoomError } from './room-error';
import { RoomChat } from './room-chat';
import { WhiteHatRoomService } from '../white-hat/white-hat-room.service';
import type { WhiteHatActionIds, WhiteHatSetup } from '@poker/contracts';

export { RoomError } from './room-error';

type CreateRoom = {
  displayName: string;
  gameType?: 'poker' | 'liars-deck' | 'white-hat';
  smallBlind?: number;
  bigBlind?: number;
  ante?: number;
  startingLives?: number;
  eliminationsPerRound?: number;
};

type JoinRoom = { roomCode: string; password: string; displayName: string };

/** Owns the in-memory game services for the lifetime of this Nest singleton. */
@Injectable()
export class RoomService {
  private readonly chat = new RoomChat();

  chatHistory(sessionId: string) {
    const snapshot = this.current(sessionId);
    return this.chat.history(snapshot.roomCode);
  }

  sendChat(sessionId: string, commandId: unknown, text: unknown) {
    const snapshot = this.current(sessionId);
    if (
      this.whiteHat.hasSession(sessionId) &&
      !this.whiteHat.current(sessionId).legalActions.canChat
    )
      throw new RoomError('FORBIDDEN', 'Người bị loại chỉ được xem trong ván này.');
    const member = snapshot.players.find((p) => p.memberId === snapshot.viewerMemberId);
    if (!member || member.departing)
      throw new RoomError('NOT_MEMBER', 'Bạn không còn trong phòng.');
    return {
      roomCode: snapshot.roomCode,
      ...this.chat.send(
        snapshot.roomCode,
        snapshot.viewerMemberId,
        String(member.displayName),
        commandId,
        text,
      ),
    };
  }
  private readonly poker = new PokerRoomService();
  private readonly liars = new LiarsRoomService();
  private readonly whiteHat = new WhiteHatRoomService();

  isWhiteHatSession(sessionId: string): boolean {
    return this.whiteHat.hasSession(sessionId);
  }

  create(request: CreateRoom): {
    roomCode: string;
    password: string;
    sessionId: string;
    snapshot: PokerTableSnapshot;
  } {
    if (request.gameType === 'white-hat') {
      if (
        [request.smallBlind, request.bigBlind, request.ante, request.startingLives].some(
          (v) => v !== undefined,
        )
      )
        throw new RoomError('INVALID_CONFIG', 'Mũ Trắng không dùng cấu hình bài hoặc chip.');
      return this.whiteHat.create(
        request,
        (code) => this.poker.hasRoom(code) || this.liars.hasRoom(code),
      ) as never;
    }
    if (request.eliminationsPerRound !== undefined)
      throw new RoomError('INVALID_CONFIG', 'Chỉ Mũ Trắng dùng cấu hình số người bị loại.');
    if (request.gameType === 'liars-deck')
      return this.liars.create(
        request,
        (code) => this.poker.hasRoom(code) || this.whiteHat.hasRoom(code),
      ) as never;
    if (request.gameType && request.gameType !== 'poker')
      throw new RoomError('INVALID_CONFIG', 'Loại game không hợp lệ.');
    if (request.startingLives !== undefined)
      throw new RoomError('INVALID_CONFIG', 'Poker không dùng cấu hình số mạng.');
    return this.poker.create(
      request as { displayName: string; smallBlind: number; bigBlind: number; ante: number },
      (code) => this.liars.hasRoom(code) || this.whiteHat.hasRoom(code),
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
    const code = this.session(sessionId).roomCode;
    this.bySession(sessionId).close(sessionId, force);
    this.chat.close(code);
  }

  leave(sessionId: string): void {
    const before = this.current(sessionId);
    this.bySession(sessionId).leave(sessionId);
    if (before.hostMemberId === before.viewerMemberId) this.chat.close(before.roomCode);
  }

  grant(sessionId: string, targetId: string, amount: number): PokerTableSnapshot {
    return this.bySession(sessionId).grant(sessionId, targetId, amount) as never;
  }

  start(sessionId: string): PokerTableSnapshot {
    return this.bySession(sessionId).start(sessionId) as never;
  }

  configureWhiteHat(sessionId: string, setup: WhiteHatSetup): PokerTableSnapshot {
    return this.whiteHatOnly(sessionId).configure(sessionId, setup) as never;
  }
  whiteHatAction(
    sessionId: string,
    action: 'describe' | 'vote' | 'guess' | 'advance' | 'resolve-tie' | 'end-match',
    ids: WhiteHatActionIds,
    value?: unknown,
  ): PokerTableSnapshot {
    const service = this.whiteHatOnly(sessionId);
    if (action === 'end-match') return service.endMatch(sessionId, ids) as never;
    if (action === 'advance') return service.advance(sessionId, ids) as never;
    if (action === 'resolve-tie') return service.resolveTie(sessionId, ids, value) as never;
    if (action === 'vote') return service.vote(sessionId, ids, value) as never;
    if (action === 'guess') return service.guess(sessionId, ids, value) as never;
    return service.describe(sessionId, ids, value) as never;
  }
  setWhiteHatAvatar(sessionId: string, avatarId: unknown): PokerTableSnapshot {
    return this.whiteHatOnly(sessionId).setAvatar(sessionId, avatarId) as never;
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

  private byRoom(roomCode: string): PokerRoomService | LiarsRoomService | WhiteHatRoomService {
    if (this.poker.hasRoom(roomCode)) return this.poker;
    if (this.liars.hasRoom(roomCode)) return this.liars;
    if (this.whiteHat.hasRoom(roomCode)) return this.whiteHat;
    throw new RoomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại.');
  }

  private bySession(sessionId: string): PokerRoomService | LiarsRoomService | WhiteHatRoomService {
    if (this.poker.hasSession(sessionId)) return this.poker;
    if (this.liars.hasSession(sessionId)) return this.liars;
    if (this.whiteHat.hasSession(sessionId)) return this.whiteHat;
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
  private whiteHatOnly(sessionId: string): WhiteHatRoomService {
    if (!this.whiteHat.hasSession(sessionId))
      throw new RoomError('WRONG_GAME', 'Lệnh chỉ dùng cho Mũ Trắng.');
    return this.whiteHat;
  }
}
