'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTableStore, type TableSnapshot } from './store';

type Props = { table: TableSnapshot; connected: boolean };
type Hold = { kind: 'pointer' | 'key'; id: number | string; completed: boolean };

function cardScope(table: TableSnapshot) {
  return JSON.stringify([
    table.roomCode,
    table.viewerMemberId,
    table.handId,
    table.canViewAllHoleCards === true,
  ]);
}

export function PrivateCardControl({ table, connected }: Props) {
  const hidden = useTableStore((state) => state.hidePrivateCards);
  const active = useRef<Hold | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClick = useRef(false);
  const ownCards = table.players.some(
    (player) => player.memberId === table.viewerMemberId && !!player.holeCards?.length,
  );
  const canHold =
    table.canViewAllHoleCards === true && table.players.some((player) => player.holeCards?.length);
  const disabled = !ownCards && !canHold;
  const scope = cardScope(table);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (active.current) suppressClick.current = true;
    active.current = null;
  }, []);

  useEffect(() => {
    if (!connected || disabled) cancel();
    return cancel;
  }, [scope, connected, disabled, cancel]);

  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState !== 'visible') cancel();
    };
    const unsubscribe = useTableStore.subscribe((state, previous) => {
      if (state.hidePrivateCards && !previous.hidePrivateCards) cancel();
    });
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancel();
      unsubscribe();
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [cancel]);

  function toggleOwnCards() {
    const state = useTableStore.getState();
    if (ownCards || !state.hidePrivateCards) state.setPrivateCardsHidden(!state.hidePrivateCards);
  }

  function begin(kind: Hold['kind'], id: Hold['id']) {
    if (active.current || disabled) return;
    suppressClick.current = false;
    const hold: Hold = { kind, id, completed: false };
    active.current = hold;
    if (!canHold || !connected) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const state = useTableStore.getState();
      if (
        active.current !== hold ||
        document.visibilityState !== 'visible' ||
        state.table?.gameType !== 'poker' ||
        cardScope(state.table) !== scope ||
        !state.table.canViewAllHoleCards ||
        !state.table.players.some((player) => player.holeCards?.length)
      )
        return;
      hold.completed = true;
      suppressClick.current = true;
      state.revealAllHoleCards();
    }, 5000);
  }

  function finish(kind: Hold['kind'], id: Hold['id']) {
    const hold = active.current;
    if (!hold || hold.kind !== kind || hold.id !== id) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    active.current = null;
    if (kind === 'key') {
      suppressClick.current = true;
      if (!hold.completed) toggleOwnCards();
    }
  }

  return (
    <button
      type="button"
      className="subtle private-card-control"
      disabled={disabled}
      aria-pressed={!hidden}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        toggleOwnCards();
      }}
      onPointerDown={(event) => {
        if (event.button === 0 && event.isPrimary !== false) begin('pointer', event.pointerId);
      }}
      onPointerUp={(event) => finish('pointer', event.pointerId)}
      onPointerMove={(event) => {
        if (active.current?.kind !== 'pointer' || active.current.id !== event.pointerId) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          cancel();
      }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onBlur={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) begin('key', event.key);
      }}
      onKeyUp={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        finish('key', event.key);
      }}
    >
      {hidden ? 'Xem bài riêng' : 'Che bài riêng'}
    </button>
  );
}
