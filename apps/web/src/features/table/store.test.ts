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
});
