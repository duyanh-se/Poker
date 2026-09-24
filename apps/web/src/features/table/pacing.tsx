'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameTransition, RoomSnapshot } from './store';

const labels: Record<GameTransition['kind'], string> = {
  deal: 'Đang chia bài…',
  action: 'Đang chuyển lượt…',
  street: 'Đang mở bài chung…',
  'showdown-reveal': 'Đang mở bài so kết quả…',
  'showdown-verdict': 'Đang công bố người thắng…',
  payout: 'Đang trao chip…',
  'fold-win': 'Các đối thủ đã bỏ bài — đang trao pot…',
  challenge: 'NÓI DỐI! Đang kiểm tra lời tuyên bố…',
  'challenge-reveal': 'Đang mở nhóm bài bị tố cáo…',
  'challenge-verdict': 'Đang công bố kết quả tố cáo…',
  'life-loss': 'Đang cập nhật số mạng…',
  timeout: 'Hết giờ — đang xử lý mất mạng…',
  forfeit: 'Bỏ cuộc — mất toàn bộ mạng còn lại…',
};

/** Anchors elapsed time to a received server snapshot, not the device wall clock. */
export function useGamePacing(table: RoomSnapshot | undefined, animate: boolean) {
  const transition = table?.transition;
  const [clock, setClock] = useState({ now: 0, id: '', motion: false, offset: 0 });
  const playback = useRef({ id: '', suppressed: false, offset: 0 });
  useEffect(() => {
    const id = transition?.id ?? '';
    const received = performance.now();
    const serverNow = table?.serverTime ?? Date.now();
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (playback.current.id !== id) {
      playback.current = {
        id,
        suppressed: false,
        offset: transition ? Math.max(0, serverNow - transition.startedAt) : 0,
      };
    }
    playback.current.suppressed ||=
      !animate || document.visibilityState !== 'visible' || Boolean(media?.matches);
    const tick = () => {
      const now = serverNow + performance.now() - received;
      setClock({
        now,
        id,
        offset: playback.current.offset,
        motion: !playback.current.suppressed && (!transition || now < transition.endsAt),
      });
    };
    const visibility = () => {
      playback.current.suppressed = true;
      tick();
    };
    const reduced = () => {
      if (media?.matches) playback.current.suppressed = true;
      tick();
    };
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', visibility);
    media?.addEventListener('change', reduced);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      media?.removeEventListener('change', reduced);
    };
  }, [transition, table?.serverTime, animate]);
  const durationMs = transition ? transition.endsAt - transition.startedAt : 0;
  const now = clock.now || table?.serverTime || 0;
  return {
    motion: clock.id === (transition?.id ?? '') && clock.motion,
    kind: transition?.kind,
    id: transition?.id,
    elapsedMs: transition ? Math.min(durationMs, Math.max(0, now - transition.startedAt)) : 0,
    durationMs,
    now,
    animationOffsetMs: clock.id === transition?.id ? clock.offset : 0,
  };
}

export function TransitionStatus({ table }: { table: RoomSnapshot }) {
  if (!table.transition) return null;
  return (
    <div className="transition-status" role="status" aria-live="polite">
      <span aria-hidden="true">✦</span> {labels[table.transition.kind]}
    </div>
  );
}
