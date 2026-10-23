import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivateCardControl } from './private-card-control';
import { useTableStore, type TableSnapshot } from './store';

function hand(): TableSnapshot {
  return {
    gameType: 'poker',
    roomCode: 'ROOM123',
    version: 1,
    phase: 'running',
    handId: 'hand',
    viewerMemberId: 'host',
    hostMemberId: 'host',
    canViewAllHoleCards: true,
    board: [],
    pots: [],
    config: { smallBlind: 5, bigBlind: 10, ante: 0 },
    players: ['host', 'guest'].map((memberId, seat) => ({
      memberId,
      displayName: memberId,
      seat,
      stack: 100,
      contribution: 0,
      connected: true,
      folded: false,
      allIn: false,
      sittingOut: false,
      isHost: seat === 0,
      isActing: false,
      holeCards: seat === 0 ? ['AS', 'AH'] : ['KS', 'KH'],
    })),
  };
}
function mount(table = hand()) {
  useTableStore.getState().setSnapshot(table);
  return render(<PrivateCardControl table={table} connected />);
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const press = (button: HTMLElement, pointerType = 'mouse') =>
  fireEvent.pointerDown(button, { button: 0, pointerId: 1, isPrimary: true, pointerType });
function release(button: HTMLElement) {
  fireEvent.pointerUp(button, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.click(button);
}

describe('private card control', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        pointerId: number;
        isPrimary: boolean;
        constructor(type: string, options: PointerEventInit) {
          super(type, options);
          this.pointerId = options.pointerId ?? 0;
          this.isPrimary = options.isPrimary ?? true;
        }
      },
    );
    useTableStore.getState().clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses ordinary labels and reveals only own cards on click', () => {
    mount();
    const button = screen.getByRole('button', { name: 'Xem bài riêng' });
    expect(button).not.toHaveAttribute('aria-describedby');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Che bài riêng' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });

  it.each(['mouse', 'touch'])(
    'requires a continuous five-second %s hold and consumes the release click',
    (type) => {
      mount();
      const button = screen.getByRole('button');
      press(button, type);
      advance(4999);
      expect(useTableStore.getState().showAllHoleCards).toBe(false);
      advance(1);
      expect(useTableStore.getState().showAllHoleCards).toBe(true);
      expect(useTableStore.getState().hidePrivateCards).toBe(false);
      release(button);
      expect(useTableStore.getState().showAllHoleCards).toBe(true);
      press(button);
      release(button);
      expect(useTableStore.getState().showAllHoleCards).toBe(false);
      expect(useTableStore.getState().hidePrivateCards).toBe(true);
    },
  );

  it('does not accumulate separate short presses', () => {
    mount();
    const button = screen.getByRole('button');
    for (let i = 0; i < 2; i++) {
      press(button);
      advance(4000);
      release(button);
      expect(useTableStore.getState().showAllHoleCards).toBe(false);
    }
    advance(5000);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });

  it.each([' ', 'Enter'])(
    'supports holding %j without auto-repeat or trailing-click toggles',
    (key) => {
      mount();
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key });
      advance(3000);
      fireEvent.keyDown(button, { key, repeat: true });
      advance(1999);
      expect(useTableStore.getState().showAllHoleCards).toBe(false);
      advance(1);
      fireEvent.keyUp(button, { key });
      fireEvent.click(button);
      expect(useTableStore.getState().showAllHoleCards).toBe(true);
    },
  );

  it.each([' ', 'Enter'])('toggles own cards once for a short %j activation', (key) => {
    mount();
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key });
    fireEvent.keyUp(button, { key });
    fireEvent.click(button);
    expect(useTableStore.getState().hidePrivateCards).toBe(false);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });

  it.each(['pointerCancel', 'pointerLeave', 'lostPointerCapture', 'blur'] as const)(
    'cancels unfinished holds on %s',
    (event) => {
      mount();
      const button = screen.getByRole('button');
      press(button);
      advance(4000);
      fireEvent[event](button, { pointerId: 1 });
      advance(5000);
      expect(useTableStore.getState().showAllHoleCards).toBe(false);
    },
  );

  it.each(['blur', 'visibilitychange'])('cancels hidden holds on window/document %s', (event) => {
    mount();
    press(screen.getByRole('button'));
    advance(4000);
    if (event === 'blur') fireEvent(window, new Event('blur'));
    else {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      fireEvent(document, new Event('visibilitychange'));
    }
    advance(5000);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });

  it('cancels on disconnection, scope changes and unmount', () => {
    const table = hand();
    const view = mount(table);
    const button = screen.getByRole('button');
    press(button);
    advance(4000);
    view.rerender(<PrivateCardControl table={table} connected={false} />);
    advance(5000);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
    view.rerender(<PrivateCardControl table={table} connected />);
    press(button);
    advance(4000);
    const next = { ...table, handId: 'next', version: 2 };
    act(() => useTableStore.getState().setSnapshot(next));
    view.rerender(<PrivateCardControl table={next} connected />);
    advance(5000);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
    press(button);
    view.unmount();
    advance(5000);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves an unfinished hold across same-hand updates', () => {
    const table = hand();
    const view = mount(table);
    press(screen.getByRole('button'));
    advance(2000);
    const updated = { ...table, version: 2, board: ['2S', '3H', '4D'] };
    act(() => useTableStore.getState().setSnapshot(updated));
    view.rerender(<PrivateCardControl table={updated} connected />);
    advance(3000);
    expect(useTableStore.getState().showAllHoleCards).toBe(true);
  });

  it('rechecks entitlement at timer completion even before props update', () => {
    const table = hand();
    mount(table);
    press(screen.getByRole('button'));
    advance(4000);
    act(() =>
      useTableStore.getState().setSnapshot({ ...table, version: 2, canViewAllHoleCards: false }),
    );
    advance(1000);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });

  it('does not unlock for ordinary viewers', () => {
    mount({ ...hand(), canViewAllHoleCards: false });
    const button = screen.getByRole('button');
    press(button);
    advance(6000);
    release(button);
    expect(useTableStore.getState().showAllHoleCards).toBe(false);
  });

  it('supports a sitting-out host without revealing opponents on an ordinary click', () => {
    const table = hand();
    table.players[0].holeCards = undefined;
    table.players[0].sittingOut = true;
    mount(table);
    const button = screen.getByRole('button');
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(useTableStore.getState().hidePrivateCards).toBe(true);
    press(button);
    advance(5000);
    release(button);
    expect(useTableStore.getState().showAllHoleCards).toBe(true);
  });
});
