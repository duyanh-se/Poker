import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { RoomService } from '../src/rooms/room.service';

function sessionIdFrom(response: request.Response): string {
  const raw = response.headers['set-cookie'] as unknown;
  const cookie = Array.isArray(raw)
    ? raw.find(
        (value): value is string => typeof value === 'string' && value.startsWith('poker_session='),
      )
    : typeof raw === 'string' && raw.startsWith('poker_session=')
      ? raw
      : undefined;
  expect(cookie).toBeDefined();
  return cookie!.split(';', 1)[0].slice('poker_session='.length);
}

describe('private room access', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('creates a private room and allows a unique invited member to join', async () => {
    const created = await request(app.getHttpServer())
      .post('/rooms')
      .send({ displayName: 'An', smallBlind: 5, bigBlind: 10, ante: 0 })
      .expect(201);
    expect(created.body.roomCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(created.body.password).toHaveLength(16);

    await request(app.getHttpServer())
      .post('/rooms/join')
      .send({
        roomCode: created.body.roomCode,
        password: created.body.password,
        displayName: 'Bình',
      })
      .expect(200)
      .expect(({ body }) => expect(body.snapshot.players).toHaveLength(2));

    await request(app.getHttpServer())
      .post('/rooms/join')
      .send({ roomCode: created.body.roomCode, password: 'wrong', displayName: 'Châu' })
      .expect(401);
  });

  it('rejects a duplicate normalized name and a tenth seated member', async () => {
    const created = await request(app.getHttpServer())
      .post('/rooms')
      .send({ displayName: 'An', smallBlind: 5, bigBlind: 10, ante: 0 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/rooms/join')
      .send({
        roomCode: created.body.roomCode,
        password: created.body.password,
        displayName: ' an ',
      })
      .expect(409);

    for (let player = 1; player <= 8; player += 1) {
      await request(app.getHttpServer())
        .post('/rooms/join')
        .send({
          roomCode: created.body.roomCode,
          password: created.body.password,
          displayName: `Player ${player}`,
        })
        .expect(200);
    }

    await request(app.getHttpServer())
      .post('/rooms/join')
      .send({
        roomCode: created.body.roomCode,
        password: created.body.password,
        displayName: 'Player 10',
      })
      .expect(409);
  });

  it('restores an active guest session and rejects it once the room closes', async () => {
    const host = request.agent(app.getHttpServer());
    const created = await host
      .post('/rooms')
      .send({ displayName: 'An', smallBlind: 5, bigBlind: 10, ante: 0 })
      .expect(201);

    await host
      .get('/rooms/current')
      .expect(200)
      .expect(({ body }) =>
        expect(body.snapshot.viewerMemberId).toBe(created.body.snapshot.viewerMemberId),
      );

    app.get(RoomService).close(sessionIdFrom(created));

    await host.get('/rooms/current').expect(401);
  });
});
