import { createHash, timingSafeEqual } from 'node:crypto';
import type { WhiteHatActionIds, WhiteHatSetup, WhiteHatSnapshot } from '@poker/contracts';
import { RoomError } from '../rooms/room-error';
import { automaticRoles, validateSetup, WhiteHatEngine, whiteHatId } from './white-hat.engine';

type Member = {
  id: string;
  displayName: string;
  seat: number;
  connected: boolean;
  departed: boolean;
};
type Room = {
  code: string;
  passwordHash: Buffer;
  hostId: string;
  version: number;
  members: Member[];
  setup: WhiteHatSetup;
  engine?: WhiteHatEngine;
};
const hash = (value: string) => createHash('sha256').update(value).digest();
const nameKey = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('vi');

export class WhiteHatRoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, { roomCode: string; memberId: string }>();
  hasRoom(code: string): boolean {
    return this.rooms.has(code.toUpperCase());
  }
  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }
  create(
    request: { displayName: string; eliminationsPerRound?: number },
    taken: (code: string) => boolean,
  ) {
    const eliminationsPerRound = request.eliminationsPerRound ?? 1;
    if (
      !Number.isInteger(eliminationsPerRound) ||
      eliminationsPerRound < 1 ||
      eliminationsPerRound > 11
    )
      throw new RoomError('INVALID_CONFIG', 'Số người bị loại phải từ 1 đến 11.');
    const member = this.newMember(request.displayName, 0);
    let code: string;
    do
      code = whiteHatId()
        .replace(/[^A-Z2-9]/giu, '')
        .toUpperCase()
        .slice(0, 8);
    while (code.length !== 8 || this.hasRoom(code) || taken(code));
    const password = whiteHatId();
    const room: Room = {
      code,
      passwordHash: hash(password),
      hostId: member.id,
      version: 1,
      members: [member],
      setup: {
        eliminationsPerRound,
        roleMode: 'auto',
        spyCount: 1,
        whiteCount: 1,
        civilianWord: '',
        spyWord: '',
      },
    };
    this.rooms.set(code, room);
    const sessionId = this.bind(room, member);
    return { roomCode: code, password, sessionId, snapshot: this.snapshot(room, member.id) };
  }
  join(request: { roomCode: string; password: string; displayName: string }) {
    const room = this.room(request.roomCode);
    if (
      typeof request.password !== 'string' ||
      !timingSafeEqual(room.passwordHash, hash(request.password))
    )
      throw new RoomError('INVALID_INVITATION', 'Mã phòng hoặc mật khẩu không đúng.');
    this.between(room);
    const members = room.members.filter((m) => !m.departed);
    if (members.length >= 13) throw new RoomError('ROOM_FULL', 'Đã đủ 12 người chơi và quản trò.');
    const seat = Array.from({ length: 13 }, (_, i) => i).find(
      (i) => !members.some((m) => m.seat === i),
    )!;
    const member = this.newMember(request.displayName, seat);
    if (members.some((m) => nameKey(m.displayName) === nameKey(member.displayName)))
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
  current(sessionId: string): WhiteHatSnapshot {
    const { room, member } = this.actor(sessionId);
    return this.snapshot(room, member.id);
  }
  snapshots(code: string) {
    const room = this.room(code);
    return room.members
      .filter((m) => !m.departed)
      .map((m) => ({ memberId: m.id, snapshot: this.snapshot(room, m.id) }));
  }
  setConnected(sessionId: string, connected: boolean) {
    const { room, member } = this.actor(sessionId);
    member.connected = connected;
    return this.changed(room, member.id);
  }
  configure(sessionId: string, setup: WhiteHatSetup) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    this.between(room);
    if (!setup || typeof setup !== 'object')
      throw new RoomError('INVALID_CONFIG', 'Cần cấu hình và hai từ.');
    // Allow preparing words before guests arrive; start revalidates the actual roster.
    const count = room.members.filter((m) => !m.departed && m.id !== room.hostId).length;
    room.setup = validateSetup(setup, count >= 4 ? count : 12);
    return this.changed(room, member.id);
  }
  start(sessionId: string) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    this.between(room);
    const members = room.members.filter((m) => !m.departed);
    if (members.some((m) => !m.connected))
      throw new RoomError('PLAYERS_OFFLINE', 'Đợi mọi người kết nối lại.');
    const engine = new WhiteHatEngine(
      members.filter((m) => m.id !== room.hostId).map((m) => m.id),
      room.setup,
    );
    room.engine = engine;
    room.members = members;
    // A finished match exposes its words. Require an explicit setup for the next match.
    room.setup = { ...engine.setup, civilianWord: '', spyWord: '' };
    return this.changed(room, member.id);
  }
  describe(sessionId: string, ids: WhiteHatActionIds, text: unknown) {
    return this.command(sessionId, ids, (engine, id) => engine.describe(id, text));
  }
  vote(sessionId: string, ids: WhiteHatActionIds, targetIds: unknown) {
    return this.command(sessionId, ids, (engine, id) => engine.vote(id, targetIds));
  }
  guess(sessionId: string, ids: WhiteHatActionIds, text: unknown) {
    return this.command(sessionId, ids, (engine, id) => engine.guess(id, text));
  }
  advance(sessionId: string, ids: WhiteHatActionIds) {
    return this.command(sessionId, ids, (engine) => engine.advance(), true);
  }
  resolveTie(sessionId: string, ids: WhiteHatActionIds, targetIds: unknown) {
    return this.command(sessionId, ids, (engine) => engine.resolveTie(targetIds), true);
  }
  timeout(code: string, roundId: string, turnId: string) {
    const room = this.room(code);
    if (!room.engine?.timeout(roundId, turnId)) return undefined;
    return this.changed(room, room.hostId);
  }
  advanceTransition() {
    return undefined;
  }
  transferHost(sessionId: string, targetId: string) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    this.between(room);
    const target = room.members.find(
      (m) => m.id === targetId && !m.departed && m.connected && m.id !== member.id,
    );
    if (!target) throw new RoomError('INVALID_STATE', 'Chọn một người khác đang kết nối.');
    room.hostId = target.id;
    room.engine = undefined;
    room.members = room.members.filter((m) => !m.departed);
    room.setup = { ...room.setup, civilianWord: '', spyWord: '' };
    return this.changed(room, member.id);
  }
  kick(sessionId: string, targetId: string) {
    const { room, member } = this.actor(sessionId);
    this.host(room, member);
    this.between(room);
    if (targetId === member.id) throw new RoomError('INVALID_ACTION', 'Không thể tự mời ra.');
    const target = room.members.find((m) => m.id === targetId && !m.departed);
    if (!target) throw new RoomError('NOT_MEMBER', 'Người này không còn trong phòng.');
    this.remove(room, target);
    return this.changed(room, member.id);
  }
  leave(sessionId: string): void {
    const { room, member } = this.actor(sessionId);
    if (member.id === room.hostId) this.close(sessionId);
    else {
      this.remove(room, member);
      room.version++;
    }
  }
  close(sessionId: string, force = false): void {
    const { room, member } = this.actor(sessionId);
    if (!force) this.host(room, member);
    this.rooms.delete(room.code);
    for (const [key, value] of this.sessions)
      if (value.roomCode === room.code) this.sessions.delete(key);
  }
  pause() {
    throw new RoomError('WRONG_GAME', 'Mũ Trắng do quản trò chuyển từng giai đoạn.');
  }
  grant() {
    throw new RoomError('WRONG_GAME', 'Mũ Trắng không dùng chip.');
  }
  returnToTable() {
    throw new RoomError('WRONG_GAME', 'Mũ Trắng không có chế độ tạm nghỉ.');
  }

  private command(
    sessionId: string,
    ids: WhiteHatActionIds,
    apply: (engine: WhiteHatEngine, memberId: string) => void,
    hostOnly = false,
  ) {
    const { room, member } = this.actor(sessionId);
    if (hostOnly) this.host(room, member);
    if (!room.engine) throw new RoomError('INVALID_STATE', 'Ván chưa bắt đầu.');
    room.engine.assertCurrent(ids);
    apply(room.engine, member.id);
    return this.changed(room, member.id);
  }
  private changed(room: Room, viewer: string) {
    room.version++;
    return this.snapshot(room, viewer);
  }
  private between(room: Room) {
    if (room.engine && !room.engine.result)
      throw new RoomError('MATCH_IN_PROGRESS', 'Ván đang diễn ra. Hãy chờ kết thúc.');
  }
  private host(room: Room, member: Member) {
    if (room.hostId !== member.id) throw new RoomError('FORBIDDEN', 'Chỉ quản trò được thao tác.');
  }
  private room(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại.');
    return room;
  }
  private actor(sessionId: string) {
    const session = this.session(sessionId);
    const room = this.room(session.roomCode);
    const member = room.members.find((m) => m.id === session.memberId && !m.departed);
    if (!member) throw new RoomError('NO_SESSION', 'Phiên không còn trong phòng.');
    return { room, member };
  }
  private newMember(value: string, seat: number): Member {
    if (typeof value !== 'string') throw new RoomError('INVALID_NAME', 'Tên không hợp lệ.');
    const displayName = value.normalize('NFKC').trim();
    if (!displayName || [...displayName].length > 24)
      throw new RoomError('INVALID_NAME', 'Tên cần từ 1 đến 24 ký tự.');
    return { id: whiteHatId(), displayName, seat, connected: false, departed: false };
  }
  private bind(room: Room, member: Member) {
    const sessionId = whiteHatId();
    this.sessions.set(sessionId, { roomCode: room.code, memberId: member.id });
    return sessionId;
  }
  private remove(room: Room, member: Member) {
    if (room.engine && !room.engine.result) room.engine.depart(member.id);
    member.departed = true;
    member.connected = false;
    for (const [key, value] of this.sessions)
      if (value.memberId === member.id) this.sessions.delete(key);
    if (!room.engine) room.members = room.members.filter((m) => !m.departed);
  }
  private snapshot(room: Room, viewer: string): WhiteHatSnapshot {
    const engine = room.engine;
    const host = room.hostId === viewer;
    const finished = Boolean(engine?.result);
    const active = Boolean(engine && !finished);
    const participant = engine?.participants.find((p) => p.id === viewer);
    const setup = active ? engine!.setup : room.setup;
    const count = room.members.filter((m) => !m.departed && m.id !== room.hostId).length;
    const roles = setup.roleMode === 'auto' && !active ? automaticRoles(count) : setup;
    const config = {
      eliminationsPerRound: setup.eliminationsPerRound,
      roleMode: setup.roleMode,
      spyCount: roles.spyCount,
      whiteCount: roles.whiteCount,
    };
    const players = room.members.map((m) => {
      const p = engine?.participants.find((p) => p.id === m.id);
      return {
        memberId: m.id,
        displayName: m.displayName,
        seat: m.seat,
        connected: m.connected,
        isHost: m.id === room.hostId,
        isModerator: m.id === room.hostId,
        eliminated: Boolean(p && !p.alive),
        departed: m.departed,
        ...(p && (finished || p.revealed) ? { role: p.role } : {}),
      };
    });
    const snapshot: WhiteHatSnapshot = {
      gameType: 'white-hat',
      version: room.version,
      serverTime: Date.now(),
      roomCode: room.code,
      phase: active ? 'running' : 'waiting',
      stage: engine?.stage ?? 'lobby',
      config,
      viewerMemberId: viewer,
      hostMemberId: room.hostId,
      matchStatus: active ? 'active' : finished ? 'finished' : 'waiting',
      matchId: engine?.matchId,
      roundId: engine?.roundId,
      turnId: engine?.turnId,
      roundNumber: engine?.roundNumber ?? 0,
      actingMemberId: engine?.actingMemberId,
      deadlineAt: engine?.deadlineAt,
      players,
      descriptions: engine?.descriptions.map((d) => ({ ...d })) ?? [],
      guesses: engine?.guesses.map((g) => ({ ...g })) ?? [],
      ballotResults:
        engine?.ballotResults.map((b) => ({
          ...b,
          ballots: b.ballots.map((v) => ({ ...v, targetIds: [...v.targetIds] })),
          totals: b.totals.map((t) => ({ ...t })),
        })) ?? [],
      submittedMemberIds: engine ? [...engine.ballots.keys()] : [],
      candidateIds: [...(engine?.candidateIds ?? [])],
      ballotSize: engine?.ballotSize ?? 0,
      selectedIds: [...(engine?.selectedIds ?? [])],
      lastEliminatedIds: [...(engine?.lastEliminatedIds ?? [])],
      notice: engine?.notice,
      legalActions: {
        canDescribe: Boolean(
          active &&
            participant?.alive &&
            engine?.actingMemberId === viewer &&
            engine.stage === 'description',
        ),
        canVote: Boolean(
          active &&
            participant?.alive &&
            engine &&
            ['voting', 'revote'].includes(engine.stage) &&
            !engine.ballots.has(viewer),
        ),
        canGuess: Boolean(engine?.canGuess(viewer)),
        canChat: !active || host || Boolean(participant?.alive),
      },
    };
    if (engine?.ballots.has(viewer)) snapshot.ownBallot = [...engine.ballots.get(viewer)!];
    if (participant && !participant.departed) {
      snapshot.privateWord =
        participant.role === 'white-hat'
          ? null
          : participant.role === 'spy'
            ? engine!.setup.spyWord
            : engine!.setup.civilianWord;
    }
    if (host)
      snapshot.moderator = {
        ...config,
        civilianWord: active ? engine!.setup.civilianWord : room.setup.civilianWord,
        spyWord: active ? engine!.setup.spyWord : room.setup.spyWord,
        roles: engine?.participants.map((p) => ({ memberId: p.id, role: p.role })) ?? [],
      };
    if (engine?.result)
      snapshot.result = {
        ...engine.result,
        winnerMemberIds: [...engine.result.winnerMemberIds],
        civilianWord: engine.setup.civilianWord,
        spyWord: engine.setup.spyWord,
      };
    return snapshot;
  }
}
