import { useState } from 'react';
import type { LiarsTableSnapshot } from '../../../../../packages/contracts/src';
import { Card, Lives, rankNames, HoldingHands } from './liars-pieces';
import { TransitionStatus } from '../table/pacing';
export function TurnControls({
  table,
  hidden,
  setHidden,
  locked,
  pending,
  seconds,
  send,
}: {
  table: LiarsTableSnapshot;
  hidden: boolean;
  setHidden: (v: boolean) => void;
  locked: boolean;
  pending: boolean;
  seconds: number;
  send: (event: string, body: Record<string, unknown>) => void;
}) {
  const selectionScope = `${table.matchId}:${table.roundId}:${table.turnId}`;
  const [selection, setSelection] = useState({ scope: selectionScope, ids: [] as string[] });
  const selected = selection.scope === selectionScope ? selection.ids : [];
  const setSelected = (value: string[] | ((ids: string[]) => string[])) =>
    setSelection({
      scope: selectionScope,
      ids: typeof value === 'function' ? value(selected) : value,
    });
  const me = table.players.find((p) => p.memberId === table.viewerMemberId)!;
  const host = table.hostMemberId === me.memberId;
  const target = rankNames[table.tableRank ?? ''] ?? '—';
  const active = table.phase === 'running';
  const mine = active && table.actingMemberId === me.memberId;
  const eligible = table.players.filter((p) => table.matchStatus !== 'active' || p.lives > 0);
  const reason =
    eligible.length < 2
      ? 'Cần ít nhất 2 người để bắt đầu.'
      : eligible.some((p) => !p.connected)
        ? 'Đang chờ người chơi kết nối lại.'
        : '';
  const choose = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((c) => c !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  const payload = { matchId: table.matchId, roundId: table.roundId, turnId: table.turnId };
  const previous =
    table.players.find((p) => p.memberId === table.lastPlay?.memberId)?.displayName ?? 'Người chơi';
  return (
    <footer className="liar-dock">
      <section
        className="liar-hand liar-viewer-seat"
        aria-label="Bài của bạn"
        data-concealed={hidden}
      >
        <div className="liar-hand-heading">
          <strong>
            {me.displayName} <small>· Bạn {host ? '· Chủ phòng' : ''}</small>
          </strong>
          <Lives value={me.lives} max={table.config.startingLives} />
        </div>
        <div className="liar-hand-toolbar">
          <span>
            {mine && table.legalActions?.canPlay
              ? `Đã chọn ${selected.length}/3 lá`
              : `${me.cardCount} lá trên tay`}
          </span>
          {mine && table.legalActions?.canPlay && (
            <button disabled={locked || !selected.length} onClick={() => setSelected([])}>
              Bỏ chọn
            </button>
          )}
        </div>
        <div className="private-view-toolbar">
          <button aria-pressed={!hidden} onClick={() => setHidden(!hidden)}>
            {hidden ? 'Xem bài' : 'Che bài'}
          </button>
        </div>
        <div className="liar-fan">
          {(me.cards ?? []).map((card) => (
            <Card
              key={card.id}
              rank={card.rank}
              hidden={hidden}
              selected={selected.includes(card.id)}
              disabled={locked || !mine || !table.legalActions?.canPlay}
              onClick={() => choose(card.id)}
            />
          ))}
          <HoldingHands />
        </div>
      </section>
      <section className="liar-controls" aria-label="Thao tác vòng">
        {pending && <p role="status">Đang xác nhận…</p>}
        {table.transition ? (
          <TransitionStatus table={table} />
        ) : !active ? (
          <>
            <span className="liar-eyebrow">
              {table.matchStatus === 'finished' ? 'TRẬN ĐÃ KẾT THÚC' : 'SẴN SÀNG VÀO BÀN'}
            </span>
            <h2>
              {table.matchStatus === 'finished'
                ? `♛ ${table.players.find((p) => p.memberId === table.winnerMemberId)?.displayName ?? 'Không có người thắng'}`
                : host
                  ? 'Bạn quyết định khi nào bắt đầu'
                  : 'Đang chờ chủ phòng bắt đầu vòng'}
            </h2>
            <p>
              {eligible.length} người · {table.config.startingLives} mạng ban đầu
            </p>
            <p>{reason || 'Mỗi vòng mới do chủ phòng xác nhận.'}</p>
            {host && (
              <button
                className="liar-primary"
                disabled={locked || !!reason}
                onClick={() => send('room:start', {})}
              >
                {table.matchStatus === 'finished'
                  ? 'Chơi trận mới'
                  : table.roundNumber
                    ? 'Bắt đầu vòng tiếp theo'
                    : 'Bắt đầu trận'}
              </button>
            )}
          </>
        ) : mine ? (
          <>
            <span className="liar-eyebrow">LƯỢT CỦA BẠN · {seconds}s</span>
            <progress aria-label="Thời gian của bạn" value={seconds} max={180} />
            <h2>
              {table.legalActions?.mustChallenge
                ? 'Chỉ bạn còn bài. Hãy kiểm tra lượt đánh vừa rồi.'
                : `Chọn 1–3 lá, tuyên bố ${target}`}
            </h2>
            <div className="liar-actions">
              {table.legalActions?.canPlay && (
                <button
                  className="liar-primary"
                  disabled={locked || !selected.length}
                  onClick={() => send('liars:play', { ...payload, cardIds: selected })}
                >
                  Đánh úp {selected.length} lá — tuyên bố {target}
                </button>
              )}
              {table.legalActions?.canChallenge && (
                <div className="liar-challenge-group">
                  <button
                    className="liar-challenge"
                    disabled={locked}
                    onClick={() => send('liars:challenge', payload)}
                  >
                    NÓI DỐI!
                  </button>
                  <small>
                    Kiểm tra {previous} · {table.lastPlay?.count} lá vừa đánh
                  </small>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="liar-eyebrow">VÒNG {table.roundNumber}</span>
            <h2>
              {me.eliminated
                ? 'Bạn đã bị loại, đang theo dõi trận'
                : me.cardCount === 0
                  ? 'Bạn đã hết bài, chờ giải quyết vòng'
                  : `Đang chờ ${table.players.find((p) => p.isActing)?.displayName ?? 'người chơi'}`}
            </h2>
            <p>Quan sát lời tuyên bố trên bàn. Bài của bạn chỉ mình bạn thấy.</p>
          </>
        )}
      </section>
    </footer>
  );
}
