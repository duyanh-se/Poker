import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { RoomError } from './room-error';
import {
  PACING,
  beginTransition,
  advancePacing,
  type GameTransition,
  type PacedRoom,
} from './game-pacing';
import {
  assignHandPositions,
  bestRank,
  evaluateBestHand,
  mayRaiseAfterAction,
  settlePots,
  shuffleDeck,
} from '../poker/poker.engine';

type RoomConfig = { smallBlind: number; bigBlind: number; ante: number };
type CreateRoomRequest = RoomConfig & { displayName: string };
type JoinRoomRequest = { roomCode: string; password: string; displayName: string };
type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type PokerTableSnapshot = {
  serverTime: number;
  transition?: GameTransition;
  gameType: 'poker';
  version: number;
  roomCode: string;
  handId?: string;
  turnId?: string;
  phase: 'waiting' | 'running' | 'pause-pending' | 'paused' | 'closed';
  config: RoomConfig;
  viewerMemberId: string;
  hostMemberId: string;
  players: Array<Record<string, unknown>>;
  board: string[];
  buttonSeat?: number;
  smallBlindSeat?: number;
  bigBlindSeat?: number;
  street?: Street;
  actingMemberId?: string;
  deadlineAt?: number;
  pots: unknown[];
  handInfo?: { name: string; cards: string[] };
  legalActions?: Record<string, unknown>;
};
type TableSnapshot = PokerTableSnapshot;

type Member = {
  id: string;
  displayName: string;
  normalizedName: string;
  seat: number;
  stack: number;
  pendingGrant: number;
  connected: boolean;
  sittingOut: boolean;
  timedOutInHand: boolean;
  departing: boolean;
  folded: boolean;
  allIn: boolean;
  contribution: number;
  streetContribution: number;
  lastActionWager: number;
  holeCards: string[];
};

type Room = PacedRoom & {
  code: string;
  passwordHash: string;
  config: RoomConfig;
  hostId: string;
  phase: PokerTableSnapshot['phase'];
  members: Member[];
  version: number;
  handId?: string;
  turnId?: string;
  actingMemberId?: string;
  deadlineAt?: number;
  buttonSeat?: number;
  smallBlindSeat?: number;
  bigBlindSeat?: number;
  board: string[];
  street: Street;
  deck: string[];
  currentWager: number;
  lastRaise: number;
  acted: Set<string>;
  showdown: boolean;
  pots: unknown[];
};

function normalizeName(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('vi');
}

function randomId(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class PokerRoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, { roomCode: string; memberId: string }>();

  hasRoom(code: string): boolean {
    return this.rooms.has(code.toUpperCase());
  }
  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  create(request: CreateRoomRequest): {
    roomCode: string;
    password: string;
    sessionId: string;
    snapshot: PokerTableSnapshot;
  } {
    this.validateConfig(request);
    const member = this.newMember(request.displayName, 0);
    const code = this.uniqueCode();
    const password = randomBytes(12).toString('base64url');
    const room: Room = {
      code,
      passwordHash: hash(password),
      config: { smallBlind: request.smallBlind, bigBlind: request.bigBlind, ante: request.ante },
      hostId: member.id,
      phase: 'waiting',
      members: [member],
      version: 1,
      board: [],
      street: 'preflop',
      deck: [],
      currentWager: 0,
      lastRaise: 0,
      acted: new Set(),
      showdown: false,
      pots: [],
    };
    this.rooms.set(code, room);
    const sessionId = this.bindSession(room.code, member.id);
    return { roomCode: code, password, sessionId, snapshot: this.snapshot(room, member.id) };
  }

  join(request: JoinRoomRequest): { sessionId: string; snapshot: PokerTableSnapshot } {
    const room = this.requireRoom(request.roomCode);
    if (!timingSafeEqual(Buffer.from(room.passwordHash), Buffer.from(hash(request.password)))) {
      throw new RoomError('INVALID_INVITATION', 'Mã phòng hoặc mật khẩu không đúng.');
    }
    if (room.members.length >= 9) throw new RoomError('ROOM_FULL', 'Phòng đã đủ chín người chơi.');
    const member = this.newMember(request.displayName, this.nextSeat(room));
    if (room.members.some((item) => item.normalizedName === member.normalizedName)) {
      throw new RoomError('DUPLICATE_NAME', 'Tên này đã được dùng trong phòng.');
    }
    room.members.push(member);
    room.version += 1;
    const sessionId = this.bindSession(room.code, member.id);
    return { sessionId, snapshot: this.snapshot(room, member.id) };
  }

  current(sessionId: string): PokerTableSnapshot {
    const session = this.requireSession(sessionId);
    return this.snapshot(this.requireRoom(session.roomCode), session.memberId);
  }

  session(sessionId: string): { roomCode: string; memberId: string } {
    return this.requireSession(sessionId);
  }
  snapshots(roomCode: string): Array<{ memberId: string; snapshot: PokerTableSnapshot }> {
    const room = this.requireRoom(roomCode);
    return room.members.map((member) => ({
      memberId: member.id,
      snapshot: this.snapshot(room, member.id),
    }));
  }

  setConnected(sessionId: string, connected: boolean): PokerTableSnapshot {
    const { room, member } = this.actor(sessionId);
    member.connected = connected;
    room.version += 1;
    return this.snapshot(room, member.id);
  }

  pause(sessionId: string, paused: boolean): TableSnapshot {
    const { room, member } = this.actor(sessionId);
    this.requireHost(room, member);
    this.requireBetweenHands(room);
    if (paused) room.phase = 'paused';
    else if (room.phase === 'paused') room.phase = 'waiting';
    room.version += 1;
    return this.snapshot(room, member.id);
  }

  transferHost(sessionId: string, targetId: string): TableSnapshot {
    const { room, member } = this.actor(sessionId);
    this.requireHost(room, member);
    this.requireBetweenHands(room);
    const target = this.member(room, targetId);
    if (!target.connected)
      throw new RoomError('TARGET_OFFLINE', 'Chỉ có thể chuyển chủ phòng cho người đang kết nối.');
    room.hostId = target.id;
    room.version += 1;
    return this.snapshot(room, member.id);
  }

  kick(sessionId: string, targetId: string): TableSnapshot {
    const { room, member } = this.actor(sessionId);
    this.requireHost(room, member);
    this.requireBetweenHands(room);
    const target = this.member(room, targetId);
    if (target.id === member.id)
      throw new RoomError('INVALID_TARGET', 'Chủ phòng không thể tự kick mình.');
    if (this.isActiveHand(room)) this.departFromActiveHand(room, target);
    else {
      room.members = room.members.filter((item) => item.id !== target.id);
      this.removeMemberSessions(room.code, target.id);
    }
    room.version += 1;
    return this.snapshot(room, member.id);
  }

  close(sessionId: string, force = false): void {
    const { room, member } = this.actor(sessionId);
    this.requireHost(room, member);
    if (!force) this.requireBetweenHands(room);
    room.phase = 'closed';
    this.rooms.delete(room.code);
    for (const [id, item] of this.sessions)
      if (item.roomCode === room.code) this.sessions.delete(id);
  }

  leave(sessionId: string): void {
    const { room, member } = this.actor(sessionId);
    this.requireBetweenHands(room);
    if (room.hostId === member.id) {
      this.close(sessionId);
      return;
    }
    if (this.isActiveHand(room)) {
      this.departFromActiveHand(room, member);
    } else {
      room.members = room.members.filter((item) => item.id !== member.id);
      this.removeMemberSessions(room.code, member.id);
    }
    room.version += 1;
  }

  grant(sessionId: string, memberId: string, amount: number): TableSnapshot {
    const { room, member } = this.actor(sessionId);
    this.requireHost(room, member);
    this.requireBetweenHands(room);
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new RoomError('INVALID_AMOUNT', 'Chip phải là số nguyên dương.');
    const target = this.member(room, memberId);
    if (amount > Number.MAX_SAFE_INTEGER - this.totalChips(room)) {
      throw new RoomError('CHIP_LIMIT', 'Room chip total exceeds the safe integer limit.');
    }
    target.stack += amount;
    room.version += 1;
    return this.snapshot(room, member.id);
  }

  start(sessionId: string): TableSnapshot {
    const { room, member } = this.actor(sessionId);
    this.requireHost(room, member);
    this.requireNoTransition(room);
    if (room.phase !== 'waiting' && room.phase !== 'paused')
      throw new RoomError('INVALID_STATE', 'Bàn chưa sẵn sàng để bắt đầu.');
    const eligible = room.members.filter(
      (item) => item.connected && !item.sittingOut && item.stack > 0,
    );
    if (eligible.length < 2)
      throw new RoomError('NOT_ENOUGH_PLAYERS', 'Cần ít nhất hai người có chip và đang kết nối.');
    room.phase = 'running';
    room.board = [];
    room.street = 'preflop';
    room.showdown = false;
    room.pots = [];
    room.deck = shuffleDeck();
    room.handId = randomId(10);
    const positions = assignHandPositions(
      eligible.map((item) => ({ memberId: item.id, seat: item.seat })),
      room.buttonSeat,
    );
    room.buttonSeat = positions.buttonSeat;
    room.smallBlindSeat = this.member(room, positions.smallBlindMemberId).seat;
    room.bigBlindSeat = this.member(room, positions.bigBlindMemberId).seat;
    for (const item of room.members) {
      item.folded = !eligible.includes(item);
      item.timedOutInHand = false;
      item.departing = false;
      item.allIn = false;
      item.contribution = 0;
      item.streetContribution = 0;
      item.lastActionWager = 0;
      item.holeCards = item.folded ? [] : [room.deck.pop() as string, room.deck.pop() as string];
    }
    const ordered = this.orderFrom(room, room.buttonSeat).filter((item) => eligible.includes(item));
    const smallBlind = this.member(room, positions.smallBlindMemberId);
    const bigBlind = this.member(room, positions.bigBlindMemberId);
    this.commit(smallBlind, room.config.smallBlind);
    this.commit(bigBlind, room.config.bigBlind);
    for (const item of ordered) this.commit(item, room.config.ante);
    room.currentWager = room.config.bigBlind;
    room.lastRaise = room.config.bigBlind;
    room.acted.clear();
    const firstActor = this.member(room, positions.preflopActorMemberId);
    beginTransition(room, 'deal', PACING.deal, () => {
      if (this.noBettingDecision(room)) this.advanceStreet(room);
      else {
        const next = firstActor.allIn ? this.nextAction(room, firstActor.id) : firstActor;
        if (next) this.activateTurn(room, next);
        else this.advanceStreet(room);
      }
    });
    room.version += 1;
    return this.snapshot(room, member.id);
  }

  action(
    sessionId: string,
    handId: string,
    turnId: string,
    action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in',
    amount?: number,
  ): TableSnapshot {
    const { room, member } = this.actor(sessionId);
    this.requireNoTransition(room);
    if (
      (room.phase !== 'running' && room.phase !== 'pause-pending') ||
      room.handId !== handId ||
      room.turnId !== turnId ||
      room.actingMemberId !== member.id
    )
      throw new RoomError('STALE_ACTION', 'Lượt chơi đã thay đổi.');
    if (room.deadlineAt !== undefined && Date.now() >= room.deadlineAt && !member.timedOutInHand)
      throw new RoomError('STALE_ACTION', 'Lượt chơi đã hết thời gian.');
    const callAmount = Math.max(0, room.currentWager - member.streetContribution);
    const maximumWager = member.streetContribution + member.stack;
    const isShortAllInCall = action === 'all-in' && maximumWager <= room.currentWager;
    if (action === 'call' && callAmount === 0)
      throw new RoomError('ILLEGAL_ACTION', 'Nothing to call.');
    if (
      (action === 'bet' && room.currentWager !== 0) ||
      (action === 'raise' && room.currentWager === 0)
    ) {
      throw new RoomError('ILLEGAL_ACTION', 'This betting action is not available.');
    }
    if (
      (action === 'bet' || action === 'raise') &&
      (!Number.isSafeInteger(amount) || amount === undefined || amount > maximumWager)
    ) {
      throw new RoomError('ILLEGAL_ACTION', 'Wager exceeds the available stack.');
    }
    if (!isShortAllInCall && (action === 'bet' || action === 'raise' || action === 'all-in')) {
      if (!room.members.some((item) => item.id !== member.id && !item.folded && !item.allIn))
        throw new RoomError('ILLEGAL_ACTION', 'Không còn đối thủ có thể theo cược thêm.');
      const mayRaise = mayRaiseAfterAction(
        room.acted.has(member.id),
        member.lastActionWager,
        room.currentWager,
        room.lastRaise,
      );
      if (!mayRaise) throw new RoomError('RAISE_NOT_REOPENED', 'Raise has not been reopened.');
    }
    if (action === 'fold') member.folded = true;
    else if (action === 'check') {
      if (callAmount !== 0) throw new RoomError('ILLEGAL_ACTION', 'Bạn phải theo hoặc bỏ bài.');
    } else if (action === 'call') this.commit(member, callAmount);
    else if (isShortAllInCall) this.commit(member, member.stack);
    else {
      const requested = action === 'all-in' ? member.streetContribution + member.stack : amount;
      if (
        !Number.isSafeInteger(requested) ||
        requested === undefined ||
        requested <= room.currentWager
      )
        throw new RoomError('ILLEGAL_ACTION', 'Mức cược không hợp lệ.');
      const increase = requested - room.currentWager;
      const allIn = requested >= member.streetContribution + member.stack;
      if (!allIn && increase < room.lastRaise)
        throw new RoomError('ILLEGAL_ACTION', 'Mức tăng cược chưa đủ.');
      this.commit(member, requested - member.streetContribution);
      if (member.streetContribution > room.currentWager) {
        if (increase >= room.lastRaise) {
          room.lastRaise = increase;
          room.acted.clear();
        }
        room.currentWager = member.streetContribution;
      }
    }
    room.acted.add(member.id);
    member.lastActionWager = room.currentWager;
    const alive = room.members.filter((item) => !item.folded);
    if (alive.length === 1) {
      this.settle(room, alive[0]);
    } else if (this.roundComplete(room) || this.noBettingDecision(room)) {
      this.advanceStreet(room);
    } else {
      const next = this.nextAction(room, member.id);
      if (!next) this.advanceStreet(room);
      else {
        beginTransition(room, 'action', PACING.action, () => this.activateTurn(room, next), {
          actorMemberId: member.id,
          action,
        });
      }
    }
    if (room.transition) {
      room.transition.actorMemberId = member.id;
      room.transition.action = action;
    }
    room.version += 1;
    const snapshot = this.snapshot(room, member.id);
    if (!this.isActiveHand(room)) this.releaseDepartedMembers(room);
    return snapshot;
  }

  timeout(roomCode: string, handId: string, turnId: string): TableSnapshot | undefined {
    const room = this.rooms.get(roomCode);
    if (
      !room ||
      room.transition ||
      room.handId !== handId ||
      room.turnId !== turnId ||
      !room.actingMemberId ||
      room.deadlineAt === undefined ||
      Date.now() < room.deadlineAt
    )
      return undefined;
    const member = this.member(room, room.actingMemberId);
    const sessionId = [...this.sessions.entries()].find(
      ([, session]) => session.roomCode === roomCode && session.memberId === member.id,
    )?.[0];
    if (!sessionId) return undefined;
    member.timedOutInHand = true;
    const action = room.currentWager === member.streetContribution ? 'check' : 'fold';
    return this.action(sessionId, handId, turnId, action);
  }

  advanceTransition(roomCode: string, id: string): TableSnapshot | undefined {
    const room = this.rooms.get(roomCode);
    if (!room || !advancePacing(room, id)) return undefined;
    return this.snapshot(room, room.hostId);
  }

  returnToTable(sessionId: string): TableSnapshot {
    const { room, member } = this.actor(sessionId);
    member.sittingOut = false;
    member.timedOutInHand = false;
    room.version += 1;
    return this.snapshot(room, member.id);
  }

  startNextHand(roomCode: string, completedHandId: string): TableSnapshot | undefined {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'waiting' || room.handId !== completedHandId) return undefined;
    const hostSessionId = [...this.sessions.entries()].find(
      ([, session]) => session.roomCode === roomCode && session.memberId === room.hostId,
    )?.[0];
    if (!hostSessionId) return undefined;
    try {
      return this.start(hostSessionId);
    } catch (error) {
      if (error instanceof RoomError && error.code === 'NOT_ENOUGH_PLAYERS') return undefined;
      throw error;
    }
  }

  private snapshot(room: Room, viewerId: string): PokerTableSnapshot {
    const viewer = this.member(room, viewerId);
    return {
      serverTime: Date.now(),
      transition: room.transition,
      gameType: 'poker',
      version: room.version,
      roomCode: room.code,
      handId: room.handId,
      turnId: room.turnId,
      phase: room.phase,
      config: room.config,
      viewerMemberId: viewerId,
      hostMemberId: room.hostId,
      players: room.members.map((item) => ({
        memberId: item.id,
        displayName: item.displayName,
        seat: item.seat,
        stack: item.stack,
        contribution: item.contribution,
        streetContribution: item.streetContribution,
        connected: item.connected,
        folded: item.folded,
        allIn: item.allIn,
        sittingOut: item.sittingOut,
        isHost: item.id === room.hostId,
        isActing: item.id === room.actingMemberId,
        ...(item.id === viewer.id || (room.showdown && !item.folded)
          ? { holeCards: item.holeCards }
          : {}),
      })),
      board: room.board,
      buttonSeat: room.buttonSeat,
      smallBlindSeat: room.smallBlindSeat,
      bigBlindSeat: room.bigBlindSeat,
      street: room.phase === 'running' || room.phase === 'pause-pending' ? room.street : undefined,
      actingMemberId: room.actingMemberId,
      deadlineAt: room.deadlineAt,
      pots: room.pots,
      ...(viewer.holeCards.length > 0
        ? {
            handInfo:
              viewer.holeCards.length + room.board.length >= 5
                ? evaluateBestHand([...viewer.holeCards, ...room.board])
                : { name: 'Bài khởi đầu', cards: viewer.holeCards },
          }
        : {}),
      legalActions: room.actingMemberId === viewerId ? this.legalActions(room, viewer) : undefined,
    };
  }

  private legalActions(
    room: Room,
    member: Member,
  ): {
    actions: Array<'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'>;
    callAmount: number;
    minRaiseTo?: number;
    maxRaiseTo?: number;
  } {
    const callAmount = Math.max(0, room.currentWager - member.streetContribution);
    const maximumWager = member.streetContribution + member.stack;
    const canRaise =
      room.members.some((item) => item.id !== member.id && !item.folded && !item.allIn) &&
      maximumWager > room.currentWager &&
      mayRaiseAfterAction(
        room.acted.has(member.id),
        member.lastActionWager,
        room.currentWager,
        room.lastRaise,
      );
    const canAllIn = maximumWager <= room.currentWager ? member.stack > 0 : canRaise;
    const actions: Array<'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'> = ['fold'];
    if (callAmount === 0) actions.push('check');
    else actions.push('call');
    if (canRaise) actions.push(room.currentWager === 0 ? 'bet' : 'raise');
    if (canAllIn) actions.push('all-in');
    return {
      actions,
      callAmount,
      ...(canRaise
        ? { minRaiseTo: room.currentWager + room.lastRaise, maxRaiseTo: maximumWager }
        : {}),
    };
  }

  private validateConfig(request: CreateRoomRequest): void {
    if (
      !Number.isSafeInteger(request.smallBlind) ||
      !Number.isSafeInteger(request.bigBlind) ||
      !Number.isSafeInteger(request.ante)
    ) {
      throw new RoomError('INVALID_CONFIG', 'Blind và ante phải là số nguyên an toàn.');
    }
    if (request.smallBlind <= 0 || request.bigBlind <= request.smallBlind || request.ante < 0) {
      throw new RoomError('INVALID_CONFIG', 'Small blind phải nhỏ hơn big blind và ante không âm.');
    }
  }

  private newMember(displayName: string, seat: number): Member {
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 24)
      throw new RoomError('INVALID_NAME', 'Tên phải dài từ 1 đến 24 ký tự.');
    return {
      id: randomId(12),
      displayName: trimmed,
      normalizedName: normalizeName(trimmed),
      seat,
      stack: 0,
      pendingGrant: 0,
      connected: true,
      sittingOut: false,
      timedOutInHand: false,
      departing: false,
      folded: true,
      allIn: false,
      contribution: 0,
      streetContribution: 0,
      lastActionWager: 0,
      holeCards: [],
    };
  }

  private uniqueCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
    while (this.rooms.has(code));
    return code;
  }

  private bindSession(roomCode: string, memberId: string): string {
    const id = randomId();
    this.sessions.set(id, { roomCode, memberId });
    return id;
  }
  private removeMemberSessions(roomCode: string, memberId: string): void {
    for (const [id, value] of this.sessions)
      if (value.roomCode === roomCode && value.memberId === memberId) this.sessions.delete(id);
  }
  private requireRoom(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại.');
    return room;
  }
  private requireSession(id: string): { roomCode: string; memberId: string } {
    const session = this.sessions.get(id);
    if (!session) throw new RoomError('NO_SESSION', 'Phiên chơi không hợp lệ.');
    return session;
  }
  private member(room: Room, id: string): Member {
    const member = room.members.find((item) => item.id === id);
    if (!member) throw new RoomError('NOT_MEMBER', 'Bạn không còn là thành viên phòng này.');
    return member;
  }
  private actor(sessionId: string): { room: Room; member: Member } {
    const session = this.requireSession(sessionId);
    const room = this.requireRoom(session.roomCode);
    return { room, member: this.member(room, session.memberId) };
  }
  private requireHost(room: Room, member: Member): void {
    if (room.hostId !== member.id)
      throw new RoomError('FORBIDDEN', 'Chỉ chủ phòng được thực hiện thao tác này.');
  }
  private requireBetweenHands(room: Room): void {
    this.requireNoTransition(room);
    if (this.isActiveHand(room)) {
      throw new RoomError('HAND_IN_PROGRESS', 'Chỉ có thể thay đổi bàn giữa các ván.');
    }
  }
  private requireNoTransition(room: Room): void {
    if (room.transition)
      throw new RoomError('TRANSITION_IN_PROGRESS', 'Đang chuyển tiếp ván chơi.');
  }
  private isActiveHand(room: Room): boolean {
    return room.phase === 'running' || room.phase === 'pause-pending';
  }
  private departFromActiveHand(room: Room, member: Member): void {
    member.connected = false;
    member.sittingOut = true;
    member.departing = true;
    this.removeMemberSessions(room.code, member.id);
    if (room.actingMemberId === member.id) this.applyAutomaticAction(room, member);
  }
  private applyAutomaticAction(room: Room, member: Member): void {
    if (!room.handId || !room.turnId || room.actingMemberId !== member.id) return;
    const sessionId = randomId();
    this.sessions.set(sessionId, { roomCode: room.code, memberId: member.id });
    try {
      const action = room.currentWager === member.streetContribution ? 'check' : 'fold';
      this.action(sessionId, room.handId, room.turnId, action);
    } finally {
      this.sessions.delete(sessionId);
    }
  }
  private releaseDepartedMembers(room: Room): void {
    room.members = room.members.filter((member) => !member.departing);
  }
  private nextSeat(room: Room): number {
    for (let seat = 0; seat < 9; seat += 1)
      if (!room.members.some((item) => item.seat === seat)) return seat;
    throw new RoomError('ROOM_FULL', 'Phòng đã đủ chín người chơi.');
  }
  private orderFrom(room: Room, seat: number): Member[] {
    return [...room.members].sort((a, b) => ((a.seat - seat + 9) % 9) - ((b.seat - seat + 9) % 9));
  }
  private nextButton(room: Room, eligible: Member[]): number {
    if (room.buttonSeat === undefined) return eligible[randomInt(eligible.length)].seat;
    return (
      this.orderFrom(room, (room.buttonSeat + 1) % 9).find((item) => eligible.includes(item))
        ?.seat ?? eligible[0].seat
    );
  }
  private nextIn(members: Member[], id: string): Member {
    const index = members.findIndex((item) => item.id === id);
    return members[(index + 1) % members.length];
  }
  private totalChips(room: Room): number {
    return room.members.reduce(
      (sum, item) => sum + item.stack + item.contribution + item.pendingGrant,
      0,
    );
  }
  private commit(member: Member, amount: number): void {
    const paid = Math.min(member.stack, amount);
    member.stack -= paid;
    member.contribution += paid;
    member.streetContribution += paid;
    if (member.stack === 0) member.allIn = true;
  }
  private nextAction(room: Room, afterId: string): Member | undefined {
    const order = this.orderFrom(room, (this.member(room, afterId).seat + 1) % 9);
    return order.find(
      (item) =>
        !item.folded &&
        !item.allIn &&
        (!room.acted.has(item.id) || item.streetContribution < room.currentWager),
    );
  }
  private roundComplete(room: Room): boolean {
    return !room.members.some(
      (item) =>
        !item.folded &&
        !item.allIn &&
        (!room.acted.has(item.id) || item.streetContribution < room.currentWager),
    );
  }
  private noBettingDecision(room: Room): boolean {
    const able = room.members.filter((item) => !item.folded && !item.allIn);
    const opposingWager = Math.max(
      0,
      ...room.members.filter((item) => !item.folded).map((item) => item.streetContribution),
    );
    return able.length === 0 || (able.length === 1 && able[0].streetContribution >= opposingWager);
  }
  private activateTurn(room: Room, member: Member): void {
    room.actingMemberId = member.id;
    room.turnId = randomId(8);
    room.deadlineAt = Date.now() + 180_000;
    if (member.departing || member.timedOutInHand) this.applyAutomaticAction(room, member);
  }
  private advanceStreet(room: Room): void {
    if (room.board.length >= 5) {
      this.settle(room);
      return;
    }
    const reveal = room.board.length === 0 ? 3 : 1;
    for (let index = 0; index < reveal; index += 1) room.board.push(room.deck.pop() as string);
    room.street = room.board.length === 3 ? 'flop' : room.board.length === 4 ? 'turn' : 'river';
    for (const item of room.members) {
      item.streetContribution = 0;
      item.lastActionWager = 0;
    }
    room.currentWager = 0;
    room.lastRaise = room.config.bigBlind;
    room.acted.clear();
    beginTransition(room, 'street', PACING.street, () => {
      if (this.noBettingDecision(room)) this.advanceStreet(room);
      else {
        const button =
          room.members.find((item) => item.seat === room.buttonSeat) ?? room.members[0];
        const next = this.nextAction(room, button.id);
        if (next) this.activateTurn(room, next);
        else this.advanceStreet(room);
      }
    });
  }
  private settle(room: Room, forcedWinner?: Member): void {
    if (forcedWinner) {
      const amount = room.members.reduce((sum, item) => sum + item.contribution, 0);
      forcedWinner.stack += amount;
      room.showdown = false;
      room.pots = [
        {
          amount,
          winnerMemberIds: [forcedWinner.id],
          payouts: [{ memberId: forcedWinner.id, amount }],
        },
      ];
      this.clearContributions(room);
      beginTransition(room, 'fold-win', PACING.foldWin, () => this.finishHand(room), {
        actorMemberId: forcedWinner.id,
      });
    } else {
      room.showdown = true;
      beginTransition(room, 'showdown-reveal', PACING.showdownReveal, () =>
        this.announceWinners(room),
      );
    }
  }
  private announceWinners(room: Room): void {
    const settlement = settlePots(
      room.members.map((item) => ({
        memberId: item.id,
        seat: item.seat,
        amount: item.contribution,
        folded: item.folded,
        rank: item.folded ? undefined : bestRank([...item.holeCards, ...room.board]),
      })),
      room.buttonSeat ?? 0,
    );
    room.pots = settlement.pots;
    beginTransition(room, 'showdown-verdict', PACING.showdownVerdict, () => {
      for (const returned of settlement.returned)
        this.member(room, returned.memberId).stack += returned.amount;
      for (const pot of settlement.pots)
        for (const payout of pot.payouts) this.member(room, payout.memberId).stack += payout.amount;
      this.clearContributions(room);
      beginTransition(room, 'payout', PACING.payout, () => this.finishHand(room));
    });
  }
  private clearContributions(room: Room): void {
    for (const item of room.members) {
      item.contribution = 0;
      item.streetContribution = 0;
    }
  }
  private finishHand(room: Room): void {
    for (const item of room.members) {
      item.stack += item.pendingGrant;
      item.pendingGrant = 0;
      if (item.timedOutInHand) item.sittingOut = true;
    }
    room.phase = room.phase === 'pause-pending' ? 'paused' : 'waiting';
    room.actingMemberId = undefined;
    room.deadlineAt = undefined;
    this.releaseDepartedMembers(room);
  }
}
