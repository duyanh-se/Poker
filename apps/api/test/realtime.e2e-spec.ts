import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';

type Snapshot = {
  handId?: string;
  players: Array<{ memberId: string; holeCards?: string[] }>;
};

type LiarsSnapshot = {
  gameType: 'liars-deck';
  matchId?: string;
  roundId?: string;
  turnId?: string;
  actingMemberId?: string;
  tableRank?: 'A' | 'K' | 'Q';
  lastPlay?: { memberId: string; count: number };
  players: Array<{ memberId: string; cards?: Array<{ id: string; rank: string }> }>;
};

function cookieFrom(response: request.Response): string {
  const values = response.headers['set-cookie'];
  const cookie = Array.isArray(values)
    ? values.find((value) => value.startsWith('poker_session='))
    : values;
  if (!cookie) throw new Error('Expected a poker session cookie.');
  return cookie.split(';', 1)[0];
}

function connect(url: string, cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${url}/game`, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function command(
  socket: Socket,
  event: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return new Promise((resolve) => socket.emit(event, body, resolve));
}

function nextSnapshot<T = Snapshot>(socket: Socket): Promise<T> {
  return new Promise((resolve) => socket.once('table:snapshot', resolve));
}

function nextLiarsSnapshot(
  socket: Socket,
  accepts: (snapshot: LiarsSnapshot) => boolean = (snapshot) => Boolean(snapshot.turnId),
): Promise<LiarsSnapshot> {
  return new Promise((resolve) => {
    const listener = (snapshot: LiarsSnapshot) => {
      if (!accepts(snapshot)) return;
      socket.off('table:snapshot', listener);
      resolve(snapshot);
    };
    socket.on('table:snapshot', listener);
  });
}

function disconnect(socket: Socket): Promise<void> {
  if (socket.disconnected) return Promise.resolve();
  return new Promise((resolve) => {
    socket.once('disconnect', () => resolve());
    socket.disconnect();
  });
}

describe('realtime transport', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0);
  });

  afterAll(async () => {
    app.get(RealtimeGateway).onModuleDestroy();
    await app.close();
  });

  it('accepts socket command payloads and keeps unrevealed cards private per recipient', async () => {
    const created = await request(app.getHttpServer())
      .post('/rooms')
      .send({ displayName: 'Host', smallBlind: 5, bigBlind: 10, ante: 0 })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/rooms/join')
      .send({
        roomCode: created.body.roomCode,
        password: created.body.password,
        displayName: 'Guest',
      })
      .expect(200);
    const address = app.getHttpServer().address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const host = await connect(url, cookieFrom(created));
    const guest = await connect(url, cookieFrom(joined));

    try {
      expect(
        await command(host, 'room:grant', {
          commandId: 'grant-host',
          memberId: created.body.snapshot.viewerMemberId,
          amount: 100,
        }),
      ).toEqual({ ok: true });
      expect(
        await command(host, 'room:grant', {
          commandId: 'grant-guest',
          memberId: joined.body.snapshot.viewerMemberId,
          amount: 100,
        }),
      ).toEqual({ ok: true });
      const hostSnapshot = nextSnapshot(host);
      const guestSnapshot = nextSnapshot(guest);
      expect(await command(host, 'room:start', { commandId: 'start' })).toEqual({ ok: true });

      const [hostTable, guestTable] = await Promise.all([hostSnapshot, guestSnapshot]);
      expect(hostTable.handId).toBeTruthy();
      expect(
        hostTable.players.find((player) => player.memberId === created.body.snapshot.viewerMemberId)
          ?.holeCards,
      ).toHaveLength(2);
      expect(
        guestTable.players.find(
          (player) => player.memberId === created.body.snapshot.viewerMemberId,
        )?.holeCards,
      ).toBeUndefined();
    } finally {
      await Promise.all([disconnect(host), disconnect(guest)]);
    }
  });

  it('creates, starts and plays a private Bài nói dối round without exposing another hand', async () => {
    const created = await request(app.getHttpServer())
      .post('/rooms')
      .send({ displayName: 'Liar host', gameType: 'liars-deck', startingLives: 2 })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/rooms/join')
      .send({
        roomCode: created.body.roomCode,
        password: created.body.password,
        displayName: 'Liar guest',
      })
      .expect(200);
    const address = app.getHttpServer().address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const host = await connect(url, cookieFrom(created));
    const guest = await connect(url, cookieFrom(joined));

    try {
      const hostSnapshot = nextLiarsSnapshot(host);
      const guestSnapshot = nextLiarsSnapshot(guest);
      expect(await command(host, 'room:start', { commandId: 'liars-start' })).toEqual({ ok: true });
      const [hostTable, guestTable] = await Promise.all([hostSnapshot, guestSnapshot]);
      const hostId = created.body.snapshot.viewerMemberId as string;
      const guestId = joined.body.snapshot.viewerMemberId as string;
      expect(hostTable.gameType).toBe('liars-deck');
      expect(hostTable.players.find((player) => player.memberId === hostId)?.cards).toHaveLength(5);
      expect(
        hostTable.players.find((player) => player.memberId === guestId)?.cards,
      ).toBeUndefined();
      expect(
        guestTable.players.find((player) => player.memberId === hostId)?.cards,
      ).toBeUndefined();

      const actorIsHost = hostTable.actingMemberId === hostId;
      const actorSocket = actorIsHost ? host : guest;
      const actorTable = actorIsHost ? hostTable : guestTable;
      const actorId = actorIsHost ? hostId : guestId;
      const cardId = actorTable.players.find((player) => player.memberId === actorId)?.cards?.[0]
        ?.id;
      expect(cardId).toBeTruthy();
      const nextHost = nextLiarsSnapshot(host, (snapshot) => Boolean(snapshot.lastPlay));
      const nextGuest = nextLiarsSnapshot(guest, (snapshot) => Boolean(snapshot.lastPlay));
      expect(
        await command(actorSocket, 'liars:play', {
          commandId: 'liars-play',
          matchId: actorTable.matchId,
          roundId: actorTable.roundId,
          turnId: actorTable.turnId,
          cardIds: [cardId],
        }),
      ).toEqual({ ok: true });
      const [afterHost, afterGuest] = await Promise.all([nextHost, nextGuest]);
      expect(afterHost.lastPlay).toEqual({ memberId: actorId, count: 1 });
      expect(afterGuest.lastPlay).toEqual({ memberId: actorId, count: 1 });
      expect(JSON.stringify(afterGuest)).not.toContain(cardId!);
    } finally {
      await Promise.all([disconnect(host), disconnect(guest)]);
    }
  });
});
