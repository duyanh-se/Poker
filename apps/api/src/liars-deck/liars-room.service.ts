import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RoomError } from '../rooms/room-error';
import {
  advancePacing,
  beginTransition,
  PACING,
  type GameTransition,
  type PacedRoom,
} from '../rooms/game-pacing';
type LiarsCard = { id: string; rank: 'A' | 'K' | 'Q' | 'JOKER' };
type LiarsTableSnapshot = {
  gameType: 'liars-deck';
  version: number;
  serverTime: number;
  transition?: GameTransition;
  challengeReveal?: { cards: LiarsCard[] };
  roomCode: string;
  phase: 'waiting' | 'running' | 'closed';
  config: { startingLives: number };
  viewerMemberId: string;
  hostMemberId: string;
  matchId?: string;
  roundId?: string;
  turnId?: string;
  matchStatus: 'waiting' | 'active' | 'finished';
  roundNumber: number;
  tableRank?: 'A' | 'K' | 'Q';
  actingMemberId?: string;
  deadlineAt?: number;
  winnerMemberId?: string;
  players: Array<{
    memberId: string;
    displayName: string;
    seat: number;
    connected: boolean;
    isHost: boolean;
    isActing: boolean;
    lives: number;
    cardCount: number;
    eliminated: boolean;
    cards?: LiarsCard[];
  }>;
  lastPlay?: { memberId: string; count: number };
  result?: {
    reason: 'challenge' | 'timeout' | 'forfeit';
    loserMemberId: string;
    loserDisplayName?: string;
    challengerMemberId?: string;
    playedByMemberId?: string;
    revealedCards?: LiarsCard[];
    wasLie?: boolean;
  };
  legalActions?: { canPlay: boolean; canChallenge: boolean; mustChallenge: boolean };
};

type Member = {
  id: string;
  displayName: string;
  seat: number;
  connected: boolean;
  lives: number;
  cards: LiarsCard[];
};
type Room = PacedRoom & {
  code: string;
  passwordHash: string;
  startingLives: number;
  hostId: string;
  version: number;
  members: Member[];
  phase: 'waiting' | 'running';
  matchStatus: 'waiting' | 'active' | 'finished';
  matchId?: string;
  roundId?: string;
  turnId?: string;
  roundNumber: number;
  firstSeat?: number;
  tableRank?: 'A' | 'K' | 'Q';
  actingMemberId?: string;
  deadlineAt?: number;
  winnerMemberId?: string;
  lastPlay?: { memberId: string; cards: LiarsCard[] };
  result?: LiarsTableSnapshot['result'];
  challengeReveal?: { cards: LiarsCard[] };
};
const id = () => randomBytes(16).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest();
const nameKey = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('vi');

@Injectable()
export class LiarsRoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, { roomCode: string; memberId: string }>();
  hasRoom(code: string): boolean {
    return this.rooms.has(code.toUpperCase());
  }
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
  create(
    request: { displayName: string; startingLives?: number },
    taken: (code: string) => boolean,
  ) {
    const lives = request.startingLives ?? 3;
    if (!Number.isInteger(lives) || lives < 1 || lives > 10)
      throw new RoomError('INVALID_CONFIG', 'Số mạng phải từ 1 đến 10.');
    const member = this.newMember(request.displayName, 0, lives);
    let code: string;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
      code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (this.hasRoom(code) || taken(code));
    const password = id();
    const room: Room = {
      code,
      passwordHash: hash(password).toString('hex'),
      startingLives: lives,
      hostId: member.id,
      version: 1,
      members: [member],
      phase: 'waiting',
      matchStatus: 'waiting',
      roundNumber: 0,
    };
    this.rooms.set(code, room);
    const sessionId = this.bind(room, member);
    return { roomCode: code, password, sessionId, snapshot: this.snapshot(room, member.id) };
  }
  join(request: { roomCode: string; password: string; displayName: string }) {
    const room = this.room(request.roomCode);
    if (
      typeof request.password !== 'string' ||
      !timingSafeEqual(Buffer.from(room.passwordHash, 'hex'), hash(request.password))
    )
      throw new RoomError('INVALID_INVITATION', 'Mã phòng hoặc mật khẩu không đúng.');
    this.noTransition(room);
    if (room.matchStatus === 'active')
      throw new RoomError('MATCH_IN_PROGRESS', 'Trận đang diễn ra, hãy đợi trận kết thúc.');
    if (room.members.length >= 4) throw new RoomError('ROOM_FULL', 'Phòng đã đủ bốn người.');
    const seat = [0, 1, 2, 3].find((value) => !room.members.some((m) => m.seat === value))!;
    const member = this.newMember(request.displayName, seat, room.startingLives);
    if (room.members.some((m) => nameKey(m.displayName) === nameKey(member.displayName)))
      throw new RoomError('DUPLICATE_NAME', 'Tên đã được sử dụng.');
    room.members.push(member);
    room.version++;
    return { sessionId: this.bind(room, member), snapshot: this.snapshot(room, member.id) };
  }
  session(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new RoomError('NO_SESSION', 'Phiên không hợp lệ.');
    return session;
  }
  current(sessionId: string) {
    const { room, member } = this.actor(sessionId);
    return this.snapshot(room, member.id);
  }
  snapshots(code: string) {
    const room = this.room(code);
    return room.members.map((m) => ({ memberId: m.id, snapshot: this.snapshot(room, m.id) }));
  }
  setConnected(sessionId: string, connected: boolean) {
    const { room, member } = this.actor(sessionId);
    member.connected = connected;
    room.version++;
    return this.snapshot(room, member.id);
  }
  start(sessionId: string) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    this.between(room);
    const newMatch = room.matchStatus !== 'active';
    const eligible = room.members.filter((m) => newMatch || m.lives > 0);
    if (eligible.length < 2) throw new RoomError('NOT_ENOUGH_PLAYERS', 'Cần ít nhất hai người.');
    if (eligible.some((m) => !m.connected))
      throw new RoomError('PLAYERS_OFFLINE', 'Đợi mọi người còn mạng kết nối lại.');
    if (newMatch) {
      room.matchId = id();
      room.matchStatus = 'active';
      room.roundNumber = 0;
      room.firstSeat = undefined;
      room.winnerMemberId = undefined;
      for (const m of room.members) m.lives = room.startingLives;
    }
    const deck: LiarsCard[] = [];
    for (const rank of ['A', 'K', 'Q'] as const)
      for (let i = 0; i < 6; i++) deck.push({ id: id(), rank });
    for (let i = 0; i < 2; i++) deck.push({ id: id(), rank: 'JOKER' });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    for (const m of room.members) m.cards = m.lives > 0 ? deck.splice(0, 5) : [];
    const sorted = [...eligible].sort((a, b) => a.seat - b.seat);
    const first =
      room.firstSeat === undefined
        ? sorted[randomInt(sorted.length)]
        : (sorted.find((m) => m.seat > room.firstSeat!) ?? sorted[0]);
    room.firstSeat = first.seat;
    room.roundNumber++;
    room.roundId = id();
    room.phase = 'running';
    room.result = undefined;
    room.lastPlay = undefined;
    room.tableRank = (['A', 'K', 'Q'] as const)[randomInt(3)];
    room.challengeReveal = undefined;
    beginTransition(room, 'deal', PACING.deal, () => this.turn(room, first.id));
    room.version++;
    return this.snapshot(room, member.id);
  }
  play(sessionId: string, matchId: string, roundId: string, turnId: string, cardIds: string[]) {
    const { room, member } = this.actionActor(sessionId, matchId, roundId, turnId);
    if (this.mustChallenge(room))
      throw new RoomError('MUST_CHALLENGE', 'Bạn phải kiểm tra lượt đánh gần nhất.');
    if (
      !Array.isArray(cardIds) ||
      cardIds.length < 1 ||
      cardIds.length > 3 ||
      new Set(cardIds).size !== cardIds.length ||
      cardIds.some((card) => typeof card !== 'string' || !member.cards.some((c) => c.id === card))
    )
      throw new RoomError('INVALID_CARDS', 'Chọn từ một đến ba lá bài của bạn.');
    const cards = member.cards.filter((c) => cardIds.includes(c.id));
    member.cards = member.cards.filter((c) => !cardIds.includes(c.id));
    room.lastPlay = { memberId: member.id, cards };
    const next = [...room.members]
      .sort((a, b) => ((a.seat - member.seat + 3) % 4) - ((b.seat - member.seat + 3) % 4))
      .find((m) => m.lives > 0 && m.cards.length > 0 && m.id !== member.id);
    // A player may not discard when they are the only holder, so a next holder always exists.
    if (!next) throw new RoomError('INVALID_STATE', 'Không tìm thấy lượt tiếp theo.');
    beginTransition(room, 'action', PACING.action, () => this.turn(room, next.id), {
      actorMemberId: member.id,
      action: 'play',
    });
    room.version++;
    return this.snapshot(room, member.id);
  }
  challenge(sessionId: string, matchId: string, roundId: string, turnId: string) {
    const { room, member } = this.actionActor(sessionId, matchId, roundId, turnId);
    if (!room.lastPlay || room.lastPlay.memberId === member.id)
      throw new RoomError('ILLEGAL_ACTION', 'Chưa có lượt để tố cáo.');
    const wasLie = room.lastPlay.cards.some((c) => c.rank !== room.tableRank && c.rank !== 'JOKER');
    const loser = wasLie ? room.lastPlay.memberId : member.id;
    const result: NonNullable<LiarsTableSnapshot['result']> = {
      reason: 'challenge',
      loserMemberId: loser,
      challengerMemberId: member.id,
      playedByMemberId: room.lastPlay.memberId,
      revealedCards: room.lastPlay.cards.map((c) => ({ ...c })),
      wasLie,
    };
    beginTransition(
      room,
      'challenge',
      PACING.challenge,
      () => {
        room.challengeReveal = { cards: result.revealedCards!.map((card) => ({ ...card })) };
        beginTransition(room, 'challenge-reveal', PACING.challengeReveal, () => {
          room.result = result;
          beginTransition(
            room,
            'challenge-verdict',
            PACING.challengeVerdict,
            () => {
              this.member(room, loser).lives--;
              this.finish(room);
              beginTransition(room, 'life-loss', PACING.lifeLoss, () => {
                room.phase = 'waiting';
              });
            },
            { actorMemberId: loser },
          );
        });
      },
      { actorMemberId: member.id },
    );
    room.version++;
    return this.snapshot(room, member.id);
  }
  timeout(code: string, roundId: string, turnId: string) {
    const room = this.rooms.get(code);
    if (
      !room ||
      room.phase !== 'running' ||
      room.roundId !== roundId ||
      room.turnId !== turnId ||
      !room.actingMemberId
    )
      return undefined;
    if (Date.now() < (room.deadlineAt ?? Infinity)) return undefined;
    const loser = room.actingMemberId;
    room.result = { reason: 'timeout', loserMemberId: loser };
    this.member(room, loser).lives--;
    this.finish(room);
    beginTransition(
      room,
      'timeout',
      PACING.timeoutPenalty,
      () => {
        room.phase = 'waiting';
      },
      { actorMemberId: loser },
    );
    room.version++;
    return this.snapshot(room, loser);
  }
  advanceTransition(code: string, transitionId: string) {
    const room = this.rooms.get(code);
    if (!room || !advancePacing(room, transitionId)) return undefined;
    return this.snapshot(room, room.hostId);
  }
  transferHost(sessionId: string, targetId: string) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    this.between(room);
    const target = this.member(room, targetId);
    if (!target.connected)
      throw new RoomError('TARGET_OFFLINE', 'Người nhận quyền đang mất kết nối.');
    room.hostId = target.id;
    room.version++;
    return this.snapshot(room, member.id);
  }
  kick(sessionId: string, targetId: string) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    this.between(room);
    if (targetId === member.id) throw new RoomError('INVALID_TARGET', 'Không thể tự mời mình ra.');
    this.remove(room, this.member(room, targetId));
    return this.snapshot(room, member.id);
  }
  leave(sessionId: string) {
    const { room, member } = this.actor(sessionId);
    if (room.hostId === member.id) this.close(sessionId, true);
    else this.remove(room, member);
  }
  close(sessionId: string, force = false) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    if (!force) this.between(room);
    room.transition = undefined;
    room.continueTransition = undefined;
    this.rooms.delete(room.code);
    for (const [key, value] of this.sessions)
      if (value.roomCode === room.code) this.sessions.delete(key);
  }
  pause() {
    throw new RoomError('WRONG_GAME', 'Bài nói dối không có chế độ tạm dừng.');
  }
  grant() {
    throw new RoomError('WRONG_GAME', 'Bài nói dối không dùng chip.');
  }
  returnToTable() {
    throw new RoomError('WRONG_GAME', 'Bài nói dối không có trạng thái tạm nghỉ.');
  }
  private remove(room: Room, member: Member) {
    if (room.matchStatus === 'active') {
      member.lives = 0;
      room.result = {
        reason: 'forfeit',
        loserMemberId: member.id,
        loserDisplayName: member.displayName,
      };
      room.challengeReveal = undefined;
      beginTransition(
        room,
        'forfeit',
        PACING.penalty,
        () => {
          room.phase = 'waiting';
        },
        { actorMemberId: member.id },
      );
    }
    room.members = room.members.filter((m) => m.id !== member.id);
    for (const [key, value] of this.sessions)
      if (value.memberId === member.id) this.sessions.delete(key);
    this.finish(room);
    room.version++;
  }
  private finish(room: Room) {
    if (room.matchStatus !== 'active') return;
    const living = room.members.filter((m) => m.lives > 0);
    if (living.length <= 1) {
      room.matchStatus = 'finished';
      room.winnerMemberId = living[0]?.id;
    }
  }
  private turn(room: Room, memberId: string) {
    room.actingMemberId = memberId;
    room.turnId = id();
    room.deadlineAt = Date.now() + 180000;
  }
  private mustChallenge(room: Room) {
    return (
      !!room.lastPlay && room.members.filter((m) => m.lives > 0 && m.cards.length > 0).length === 1
    );
  }
  private actionActor(sessionId: string, matchId: string, roundId: string, turnId: string) {
    const context = this.actor(sessionId);
    const { room, member } = context;
    this.noTransition(room);
    if (
      room.phase !== 'running' ||
      room.matchId !== matchId ||
      room.roundId !== roundId ||
      room.turnId !== turnId ||
      room.actingMemberId !== member.id
    )
      throw new RoomError('STALE_ACTION', 'Lượt chơi đã thay đổi.');
    if (Date.now() >= (room.deadlineAt ?? 0))
      throw new RoomError('TURN_EXPIRED', 'Đã hết thời gian.');
    return context;
  }
  private host(room: Room, member: Member) {
    if (room.hostId !== member.id) throw new RoomError('FORBIDDEN', 'Chỉ chủ phòng được thao tác.');
  }
  private between(room: Room) {
    this.noTransition(room);
    if (room.phase === 'running')
      throw new RoomError('HAND_IN_PROGRESS', 'Chỉ quản lý phòng giữa các vòng.');
  }
  private noTransition(room: Room) {
    if (room.transition)
      throw new RoomError('TRANSITION_IN_PROGRESS', 'Đang chuyển tiếp, vui lòng chờ.');
  }
  private room(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại.');
    return room;
  }
  private member(room: Room, id: string) {
    const member = room.members.find((m) => m.id === id);
    if (!member) throw new RoomError('NOT_MEMBER', 'Không còn trong phòng.');
    return member;
  }
  private actor(sessionId: string) {
    const session = this.session(sessionId);
    const room = this.room(session.roomCode);
    return { room, member: this.member(room, session.memberId) };
  }
  private bind(room: Room, member: Member) {
    const sessionId = id();
    this.sessions.set(sessionId, { roomCode: room.code, memberId: member.id });
    return sessionId;
  }
  private newMember(displayName: string, seat: number, lives: number): Member {
    if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 24)
      throw new RoomError('INVALID_NAME', 'Tên cần từ 1 đến 24 ký tự.');
    return {
      id: id(),
      displayName: displayName.trim().normalize('NFKC'),
      seat,
      connected: false,
      lives,
      cards: [],
    };
  }
  private snapshot(room: Room, viewer: string): LiarsTableSnapshot {
    return {
      gameType: 'liars-deck',
      version: room.version,
      serverTime: Date.now(),
      transition: room.transition ? { ...room.transition } : undefined,
      challengeReveal: room.challengeReveal
        ? { cards: room.challengeReveal.cards.map((card) => ({ ...card })) }
        : undefined,
      roomCode: room.code,
      phase: room.phase,
      config: { startingLives: room.startingLives },
      viewerMemberId: viewer,
      hostMemberId: room.hostId,
      matchId: room.matchId,
      roundId: room.roundId,
      turnId: room.turnId,
      matchStatus: room.matchStatus,
      roundNumber: room.roundNumber,
      tableRank: room.tableRank,
      actingMemberId: room.actingMemberId,
      deadlineAt: room.deadlineAt,
      winnerMemberId: room.winnerMemberId,
      players: room.members.map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        seat: m.seat,
        connected: m.connected,
        isHost: m.id === room.hostId,
        isActing: m.id === room.actingMemberId,
        lives: m.lives,
        cardCount: m.cards.length,
        eliminated: m.lives === 0,
        ...(m.id === viewer ? { cards: m.cards.map((c) => ({ ...c })) } : {}),
      })),
      lastPlay: room.lastPlay
        ? { memberId: room.lastPlay.memberId, count: room.lastPlay.cards.length }
        : undefined,
      result: room.result
        ? { ...room.result, revealedCards: room.result.revealedCards?.map((c) => ({ ...c })) }
        : undefined,
      legalActions:
        room.actingMemberId === viewer
          ? {
              canPlay: !this.mustChallenge(room),
              canChallenge: !!room.lastPlay && room.lastPlay.memberId !== viewer,
              mustChallenge: this.mustChallenge(room),
            }
          : undefined,
    };
  }
}
