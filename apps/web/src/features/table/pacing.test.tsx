import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGamePacing } from './pacing';
import type { TableSnapshot } from './store';

const base: TableSnapshot = {
  gameType: 'poker',
  roomCode: 'PACE',
  version: 1,
  viewerMemberId: 'a',
  hostMemberId: 'a',
  config: { smallBlind: 5, bigBlind: 10, ante: 0 },
  phase: 'running',
  players: [],
  board: [],
  pots: [],
  serverTime: 1000,
  transition: { id: 'deal', kind: 'deal', startedAt: 500, endsAt: 2300 },
};

describe('shared server-paced playback', () => {
  it('suppresses rotation playback without resetting the server clock', () => {
    const { result } = renderHook(() => useGamePacing(base, true));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.motion).toBe(true);
    act(() => window.dispatchEvent(new Event('orientationchange')));
    expect(result.current.motion).toBe(false);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.elapsedMs).toBe(600);
  });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('anchors elapsed time to server time even with an incorrect device clock', () => {
    vi.setSystemTime(new Date('2040-01-01'));
    const { result } = renderHook(() => useGamePacing(base, true));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.elapsedMs).toBe(500);
    expect(result.current.animationOffsetMs).toBe(500);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.elapsedMs).toBe(700);
    expect(result.current.animationOffsetMs).toBe(500);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.motion).toBe(false);
    expect(result.current.elapsedMs).toBe(1800);
  });

  it('never replays a restored stage when another snapshot of that stage arrives', () => {
    const { result, rerender } = renderHook(({ table, animate }) => useGamePacing(table, animate), {
      initialProps: { table: base, animate: false },
    });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.motion).toBe(false);
    rerender({ table: { ...base, version: 2, serverTime: 1100 }, animate: true });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.motion).toBe(false);
    rerender({
      table: {
        ...base,
        serverTime: 2300,
        transition: {
          id: 'next',
          kind: 'action',
          startedAt: 2300,
          endsAt: 2750,
        },
      },
      animate: true,
    });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.motion).toBe(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.motion).toBe(false);
  });

  it('keeps the server wait but suppresses decorative movement for reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { result } = renderHook(() => useGamePacing(base, true));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.motion).toBe(false);
    expect(result.current.durationMs).toBe(1800);
    expect(result.current.kind).toBe('deal');
  });
});
