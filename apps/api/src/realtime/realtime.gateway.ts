import { Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { loadAppConfig } from '../config/app-config';
import { RoomError, RoomService } from '../rooms/room.service';
import type { GameTransition } from '../rooms/game-pacing';

const gatewayConfig = loadAppConfig();

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: gatewayConfig.publicOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowRequest: (request, callback) => {
    const origin = request.headers.origin;
    callback(null, !origin || origin === gatewayConfig.publicOrigin);
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly config = loadAppConfig();
  private server!: Namespace;
  private readonly processedCommands = new Map<string, Set<string>>();
  private readonly turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly transitionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly hostDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeSockets = new Map<string, string>();
  private shuttingDown = false;

  constructor(@Inject(RoomService) private readonly rooms: RoomService) {}

  onModuleDestroy(): void {
    this.shuttingDown = true;
    for (const roomCode of new Set([
      ...this.turnTimers.keys(),
      ...this.transitionTimers.keys(),
      ...this.hostDisconnectTimers.keys(),
    ])) {
      this.clearRoomTimers(roomCode);
    }
  }

  afterInit(server: Namespace): void {
    this.server = server;
    this.logger.log('Socket.IO transport is ready.');
  }

  handleConnection(socket: Socket): void {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== this.config.publicOrigin) {
        throw new RoomError('INVALID_ORIGIN', 'Origin khÃ´ng Ä‘Æ°á»£c phÃ©p.');
      }
      const sessionId = socket.handshake.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${this.config.sessionCookieName}=`))
        ?.slice(this.config.sessionCookieName.length + 1);
      if (!sessionId) throw new RoomError('NO_SESSION', 'Thiếu phiên chơi.');
      const session = this.rooms.session(sessionId);
      const snapshot = this.rooms.current(sessionId);
      const memberKey = `${session.roomCode}:${session.memberId}`;
      const previousSocketId = this.activeSockets.get(memberKey);
      if (previousSocketId && previousSocketId !== socket.id)
        this.server.sockets.get(previousSocketId)?.disconnect(true);
      socket.data.sessionId = sessionId;
      socket.data.memberKey = memberKey;
      socket.join(`member:${session.memberId}`);
      this.activeSockets.set(memberKey, socket.id);
      const hostTimer = this.hostDisconnectTimers.get(session.roomCode);
      if (hostTimer && snapshot.hostMemberId === session.memberId) {
        clearTimeout(hostTimer);
        this.hostDisconnectTimers.delete(session.roomCode);
      }
      this.rooms.setConnected(sessionId, true);
      socket.emit('chat:history', this.rooms.chatHistory(sessionId));
      this.publish(session.roomCode);
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    if (this.shuttingDown) return;
    const sessionId = socket.data.sessionId as string | undefined;
    const memberKey = socket.data.memberKey as string | undefined;
    if (!sessionId || !memberKey || this.activeSockets.get(memberKey) !== socket.id) return;
    this.activeSockets.delete(memberKey);
    try {
      const snapshot = this.rooms.current(sessionId);
      this.rooms.setConnected(sessionId, false);
      this.publish(snapshot.roomCode);
      if (snapshot.hostMemberId === snapshot.viewerMemberId)
        this.scheduleHostClosure(snapshot.roomCode, sessionId);
    } catch {
      /* The room or session was already closed. */
    }
  }

  @SubscribeMessage('chat:send')
  chatSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId?: unknown; text?: unknown },
  ) {
    try {
      const sessionId = socket.data.sessionId as string;
      const session = this.rooms.session(sessionId);
      if (this.activeSockets.get(`${session.roomCode}:${session.memberId}`) !== socket.id)
        throw new RoomError('NO_SESSION', 'Kết nối không còn quyền điều khiển.');
      const result = this.rooms.sendChat(sessionId, body?.commandId, body?.text);
      if (!result.duplicate) {
        for (const { memberId } of this.rooms.snapshots(result.roomCode)) {
          const id = this.activeSockets.get(`${result.roomCode}:${memberId}`);
          const target = id ? this.server.sockets.get(id) : undefined;
          if (!target) continue;
          try {
            this.rooms.session(target.data.sessionId);
            target.emit('chat:message', result.message);
          } catch {
            /* Departed members cannot receive new chat. */
          }
        }
      }
      return { ok: true, message: result.message };
    } catch (error) {
      return { ok: false, code: error instanceof RoomError ? error.code : 'INVALID_CHAT' };
    }
  }

  @SubscribeMessage('room:start')
  start(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () => this.rooms.start(socket.data.sessionId));
  }

  @SubscribeMessage('game:action')
  action(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: {
      commandId: string;
      handId: string;
      turnId: string;
      action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';
      amount?: number;
    },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.action(socket.data.sessionId, body.handId, body.turnId, body.action, body.amount),
    );
  }

  @SubscribeMessage('liars:play')
  playLiars(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: {
      commandId: string;
      matchId: string;
      roundId: string;
      turnId: string;
      cardIds: string[];
    },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.play(socket.data.sessionId, body.matchId, body.roundId, body.turnId, body.cardIds),
    );
  }

  @SubscribeMessage('liars:challenge')
  challengeLiars(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string; matchId: string; roundId: string; turnId: string },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.challenge(socket.data.sessionId, body.matchId, body.roundId, body.turnId),
    );
  }

  @SubscribeMessage('room:pause')
  pause(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string; paused: boolean },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.pause(socket.data.sessionId, body.paused),
    );
  }

  @SubscribeMessage('room:return')
  returnToTable(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.returnToTable(socket.data.sessionId),
    );
  }

  @SubscribeMessage('room:grant')
  grant(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string; memberId: string; amount: number },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.grant(socket.data.sessionId, body.memberId, body.amount),
    );
  }

  @SubscribeMessage('room:transfer-host')
  transferHost(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string; memberId: string },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.transferHost(socket.data.sessionId, body.memberId),
    );
  }

  @SubscribeMessage('room:kick')
  kick(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string; memberId: string },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () =>
      this.rooms.kick(socket.data.sessionId, body.memberId),
    );
  }

  @SubscribeMessage('room:leave')
  leave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () => {
      const before = this.rooms.current(socket.data.sessionId);
      const memberIds = this.rooms.snapshots(before.roomCode).map((entry) => entry.memberId);
      this.rooms.leave(socket.data.sessionId);
      return {
        roomCode: before.roomCode,
        closed: before.hostMemberId === before.viewerMemberId,
        memberIds,
      };
    });
  }

  @SubscribeMessage('room:close')
  close(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { commandId: string },
  ): { ok: boolean; code?: string } {
    return this.mutate(socket, body?.commandId, () => {
      const before = this.rooms.current(socket.data.sessionId);
      const memberIds = this.rooms.snapshots(before.roomCode).map((entry) => entry.memberId);
      this.rooms.close(socket.data.sessionId);
      return { roomCode: before.roomCode, closed: true, memberIds };
    });
  }

  private mutate(
    socket: Socket,
    commandId: string | undefined,
    mutation: () => {
      roomCode: string;
      closed?: boolean;
      memberIds?: string[];
      phase?: string;
      handId?: string;
      roundId?: string;
      turnId?: string;
      deadlineAt?: number;
      pots?: unknown[];
    },
  ): { ok: boolean; code?: string } {
    try {
      if (!commandId || !socket.data.sessionId)
        throw new RoomError('INVALID_COMMAND', 'Lệnh không hợp lệ.');
      const seen = this.processedCommands.get(socket.data.sessionId) ?? new Set<string>();
      if (seen.has(commandId)) return { ok: true };
      const snapshot = mutation();
      seen.add(commandId);
      if (seen.size > 128) seen.delete(seen.values().next().value as string);
      this.processedCommands.set(socket.data.sessionId, seen);
      if (snapshot.closed) {
        for (const memberId of snapshot.memberIds ?? [])
          this.server.to(`member:${memberId}`).emit('room:closed');
        this.clearRoomTimers(snapshot.roomCode);
      } else this.publish(snapshot.roomCode);
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error instanceof RoomError ? error.code : 'INTERNAL_ERROR' };
    }
  }

  private publish(roomCode: string): void {
    const snapshots = this.rooms.snapshots(roomCode);
    for (const { memberId, snapshot } of snapshots)
      this.server.to(`member:${memberId}`).emit('table:snapshot', snapshot);
    if (snapshots[0]) this.scheduleTimeout(snapshots[0].snapshot);
  }

  private scheduleTimeout(snapshot: {
    roomCode: string;
    handId?: string;
    roundId?: string;
    turnId?: string;
    deadlineAt?: number;
    transition?: GameTransition;
  }): void {
    if (this.shuttingDown) return;
    const key = snapshot.roomCode;
    const existing = this.turnTimers.get(key);
    if (existing) clearTimeout(existing);
    this.turnTimers.delete(key);
    const transitionTimer = this.transitionTimers.get(key);
    if (transitionTimer) clearTimeout(transitionTimer);
    this.transitionTimers.delete(key);
    if (snapshot.transition) {
      const transition = snapshot.transition;
      this.transitionTimers.set(
        key,
        setTimeout(
          () => {
            this.transitionTimers.delete(key);
            // Timer delivery and wall-clock deadlines can differ by a few ms.
            // Preserve the deadline guard without dropping the only continuation.
            if (Date.now() < transition.endsAt) {
              this.scheduleTimeout(snapshot);
              return;
            }
            const next = this.rooms.advanceTransition(key, transition.id);
            if (next) this.publish(key);
          },
          Math.max(0, transition.endsAt - Date.now()),
        ),
      );
      return;
    }
    const actionId = snapshot.handId ?? snapshot.roundId;
    if (!actionId || !snapshot.turnId || !snapshot.deadlineAt) return;
    this.turnTimers.set(
      key,
      setTimeout(
        () => {
          this.turnTimers.delete(key);
          if (Date.now() < snapshot.deadlineAt!) {
            this.scheduleTimeout(snapshot);
            return;
          }
          const next = this.rooms.timeout(snapshot.roomCode, actionId, snapshot.turnId as string);
          if (next) {
            this.publish(next.roomCode);
          }
        },
        Math.max(0, snapshot.deadlineAt - Date.now()),
      ),
    );
  }

  private scheduleHostClosure(roomCode: string, sessionId: string): void {
    const existing = this.hostDisconnectTimers.get(roomCode);
    if (existing) clearTimeout(existing);
    this.hostDisconnectTimers.set(
      roomCode,
      setTimeout(() => {
        try {
          const before = this.rooms.current(sessionId);
          const memberIds = this.rooms.snapshots(before.roomCode).map((entry) => entry.memberId);
          this.rooms.close(sessionId, true);
          for (const memberId of memberIds)
            this.server.to(`member:${memberId}`).emit('room:closed');
          this.clearRoomTimers(roomCode);
        } catch {
          /* A reconnect or room closure won the race. */
        }
        this.hostDisconnectTimers.delete(roomCode);
      }, 180_000),
    );
  }

  private clearRoomTimers(roomCode: string): void {
    const transitionTimer = this.transitionTimers.get(roomCode);
    if (transitionTimer) clearTimeout(transitionTimer);
    this.transitionTimers.delete(roomCode);
    const turnTimer = this.turnTimers.get(roomCode);
    if (turnTimer) clearTimeout(turnTimer);
    this.turnTimers.delete(roomCode);
    const hostTimer = this.hostDisconnectTimers.get(roomCode);
    if (hostTimer) clearTimeout(hostTimer);
    this.hostDisconnectTimers.delete(roomCode);
  }
}
