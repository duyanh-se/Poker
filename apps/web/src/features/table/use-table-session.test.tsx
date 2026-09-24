import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type TableSnapshot, useTableStore } from './store';
import { useTableSession } from './use-table-session';

const transport = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    connected: true,
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) =>
      listeners.set(event, listener),
    ),
    emit: vi.fn(),
    timeout: vi.fn(),
    close: vi.fn(),
    connect: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  socket.timeout.mockReturnValue(socket);
  return { listeners, socket };
});
vi.mock('socket.io-client', () => ({ io: () => transport.socket }));

const snapshot = (viewerMemberId = 'host', version = 1): TableSnapshot => ({
  gameType: 'poker',
  roomCode: 'ROOM123',
  viewerMemberId,
  hostMemberId: 'host',
  version,
  phase: 'waiting',
  config: { smallBlind: 5, bigBlind: 10, ante: 0 },
  board: [],
  pots: [],
  players: [],
});
function response(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}
function receive(event: string, ...args: unknown[]) {
  act(() => {
    transport.listeners.get(event)?.(...args);
  });
}

describe('table session restoration and commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transport.listeners.clear();
    transport.socket.timeout.mockReturnValue(transport.socket);
    useTableStore.getState().clear();
    useTableStore.getState().setRequestMessage('');
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ snapshot: snapshot() })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('restores an invitation only after a matching host session is confirmed', async () => {
    window.sessionStorage.setItem(
      'poker.room-invite',
      JSON.stringify({ roomCode: 'ROOM123', password: 'private' }),
    );
    const { result } = renderHook(useTableSession);
    expect(result.current.loading).toBe(true);
    expect(result.current.invite).toBeUndefined();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invite?.password).toBe('private');
    receive('table:snapshot', snapshot('guest', 2));
    expect(result.current.invite).toBeUndefined();
    expect(window.sessionStorage.getItem('poker.room-invite')).toBeNull();
  });

  it('does not confuse missing session with an unreachable backend', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ code: 'NO_SESSION' }, 401));
    const first = renderHook(useTableSession);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.message).toBe('');
    expect(first.result.current.table).toBeUndefined();
    first.unmount();
    vi.mocked(fetch).mockRejectedValue(new TypeError('Network unavailable'));
    const second = renderHook(useTableSession);
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.connection).toBe('offline');
    expect(second.result.current.message).toContain('Không kết nối được máy chủ');
  });

  it('discards invitation data belonging to another room', async () => {
    window.sessionStorage.setItem(
      'poker.room-invite',
      JSON.stringify({ roomCode: 'OLDROOM', password: 'old-secret' }),
    );
    const { result } = renderHook(useTableSession);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invite).toBeUndefined();
    expect(window.sessionStorage.getItem('poker.room-invite')).toBeNull();
  });

  it('blocks duplicate room submissions while the HTTP request is pending', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ code: 'NO_SESSION' }, 401));
    const { result } = renderHook(useTableSession);
    await waitFor(() => expect(result.current.loading).toBe(false));
    let complete!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    let submitted!: Promise<void>;
    act(() => {
      submitted = result.current.submitRoom('/rooms', {
        displayName: 'Host',
        smallBlind: 5,
        bigBlind: 10,
        ante: 0,
      });
      void result.current.submitRoom('/rooms', {
        displayName: 'Host',
        smallBlind: 5,
        bigBlind: 10,
        ante: 0,
      });
    });
    expect(fetch).toHaveBeenCalledTimes(2); // initial restore plus a single create
    await act(async () => {
      complete(response({ roomCode: 'ROOM123', password: 'new-secret', snapshot: snapshot() }));
      await submitted;
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.invite?.password).toBe('new-secret');
  });

  it('blocks duplicate clicks and waits for synchronization after a lost acknowledgement', async () => {
    const { result } = renderHook(useTableSession);
    await waitFor(() => expect(result.current.table).toBeDefined());
    receive('table:snapshot', snapshot());
    act(() => {
      result.current.send('room:start', {});
      result.current.send('room:start', {});
    });
    expect(transport.socket.emit).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    let completeSync!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          completeSync = resolve;
        }),
    );
    const acknowledge = transport.socket.emit.mock.calls[0][2] as (error: Error) => Promise<void>;
    let acknowledgement!: Promise<void>;
    act(() => {
      acknowledgement = acknowledge(new Error('timeout'));
    });
    expect(result.current.pending).toBe(true);
    act(() => result.current.send('room:start', {}));
    expect(transport.socket.emit).toHaveBeenCalledTimes(1);
    await act(async () => {
      completeSync(response({ snapshot: snapshot('host', 2) }));
      await acknowledgement;
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.table?.version).toBe(2);
    expect(transport.socket.emit).toHaveBeenCalledTimes(1);
  });

  it('skips replay on reconnect and conceals private information on blur', async () => {
    const { result } = renderHook(useTableSession);
    await waitFor(() => expect(result.current.table).toBeDefined());
    receive('table:snapshot', snapshot());
    expect(result.current.animate).toBe(false);
    receive('table:snapshot', snapshot('host', 2));
    expect(result.current.animate).toBe(true);
    receive('disconnect', 'transport close');
    receive('connect');
    receive('table:snapshot', snapshot('host', 8));
    expect(result.current.animate).toBe(false);
    act(() => useTableStore.getState().setPrivateCardsHidden(false));
    act(() => window.dispatchEvent(new Event('blur')));
    expect(useTableStore.getState().hidePrivateCards).toBe(true);
  });
});
