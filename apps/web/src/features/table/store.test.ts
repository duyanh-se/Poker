import { beforeEach, describe, expect, it } from 'vitest';

import { useTableStore, type TableSnapshot } from './store';

const snapshot = (version: number): TableSnapshot => ({
  gameType: 'poker',
  version,
  roomCode: 'ABCD2345',
  phase: 'waiting',
  config: { smallBlind: 5, bigBlind: 10, ante: 0 },
  hostMemberId: 'host',
  viewerMemberId: 'host',
  board: [],
  pots: [],
  players: [],
});

describe('table store', () => {
  beforeEach(() => useTableStore.getState().clear());

  it('does not replace a newer room snapshot with an older one', () => {
    useTableStore.getState().setSnapshot(snapshot(2));
    useTableStore.getState().setSnapshot(snapshot(1));

    expect(useTableStore.getState().table?.version).toBe(2);
  });

  it('keeps private cards hidden by default and resets on room exit', () => {
    expect(useTableStore.getState().hidePrivateCards).toBe(true);
    useTableStore.getState().setPrivateCardsHidden(false);
    useTableStore.getState().clear();

    expect(useTableStore.getState().hidePrivateCards).toBe(true);
  });

  it('keeps request feedback separate from the server-authoritative table snapshot', () => {
    useTableStore.getState().setRequestMessage('Không thể vào phòng.');
    useTableStore.getState().setSnapshot(snapshot(1));

    expect(useTableStore.getState().requestMessage).toBe('Không thể vào phòng.');
    expect(useTableStore.getState().table?.roomCode).toBe('ABCD2345');
  });

  const hostHand = (): TableSnapshot => ({
    ...snapshot(2),
    handId: 'hand',
    canViewAllHoleCards: true,
    players: [{ memberId: 'guest', holeCards: ['KS', 'KH'] } as TableSnapshot['players'][number]],
  });

  it('keeps all-hand viewing separate from revealing own cards and clears it on conceal/exit', () => {
    useTableStore.getState().setSnapshot(hostHand());
    useTableStore.getState().setPrivateCardsHidden(false);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
    useTableStore.getState().revealAllHoleCards();
    expect(useTableStore.getState().showAllHoleCards).toBe(true);
    expect(useTableStore.getState().hidePrivateCards).toBe(false);
    useTableStore.getState().setPrivateCardsHidden(true);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
    useTableStore.getState().revealAllHoleCards();
    useTableStore.getState().clear();
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });

  it.each([{ canViewAllHoleCards: false }, { players: [] }])(
    'does not unlock without entitlement and dealt cards: %j',
    (change) => {
      useTableStore.getState().setSnapshot({ ...hostHand(), ...change });
      useTableStore.getState().revealAllHoleCards();
      expect(useTableStore.getState().showAllHoleCards).toBe(false);
      expect(useTableStore.getState().hidePrivateCards).toBe(true);
    },
  );

  it('preserves all-hand viewing for same-hand updates and ignores stale snapshots', () => {
    useTableStore.getState().setSnapshot(hostHand());
    useTableStore.getState().revealAllHoleCards();
    useTableStore.getState().setSnapshot({ ...hostHand(), version: 3, board: ['AS', '2H', '3D'] });
    expect(useTableStore.getState().showAllHoleCards).toBe(true);
    useTableStore.getState().setSnapshot({ ...hostHand(), version: 1, handId: 'old' });
    expect(useTableStore.getState().showAllHoleCards).toBe(true);
    expect(useTableStore.getState().table?.version).toBe(3);
  });

  it.each([
    { handId: 'next-hand' },
    { roomCode: 'OTHERROOM' },
    { viewerMemberId: 'guest' },
    { canViewAllHoleCards: false },
  ])('requires a fresh reveal when card scope changes: %j', (change) => {
    useTableStore.getState().setSnapshot(hostHand());
    useTableStore.getState().revealAllHoleCards();
    useTableStore.getState().setSnapshot({ ...hostHand(), version: 3, ...change });
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });
});
