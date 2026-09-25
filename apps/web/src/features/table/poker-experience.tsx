'use client';
import dynamic from 'next/dynamic';
import { useState, type CSSProperties } from 'react';
import { useGamePacing, TransitionStatus } from './pacing';
import { seatPosition } from './seat-layout';
import { ActionEffect } from './action-effect';
import { Entry } from './entry';
import { LiarsTable } from '../liars/liars-table';
import { Panel } from './panel';
import { TableMenu, usePortraitTable } from './mobile-layout';
import { evaluateBestHand, describeCombination } from './public-hand';
import { useTableSession } from './use-table-session';
import { useTableStore, type PlayerAction, type TableSnapshot } from './store';

const Scene = dynamic(() => import('./table-scene'), { ssr: false });
const number = (value: number) => value.toLocaleString('vi-VN');
const suits: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
type WagerRequest = {
  handId?: string;
  turnId?: string;
  action: 'bet' | 'raise';
  min: number;
  max: number;
};
function Cards({ cards, hidden = false }: { cards: string[]; hidden?: boolean }) {
  return (
    <div className="cards">
      {cards.map((card, i) => (
        <span
          key={i}
          style={{ '--card-order': i } as CSSProperties}
          className={`card ${hidden ? 'card-back' : /[HD]$/i.test(card) ? 'red' : ''}`}
          aria-label={hidden ? 'Bài đang che' : card}
        >
          {hidden ? (
            '♠'
          ) : (
            <>
              {card.slice(0, -1)}
              <b>{suits[card.slice(-1).toUpperCase()]}</b>
            </>
          )}
        </span>
      ))}
    </div>
  );
}
const ranks = [
  ['Thùng phá sảnh', 'AS KS QS JS TS'],
  ['Tứ quý', 'AS AH AD AC KS'],
  ['Cù lũ', 'KS KH KD QS QH'],
  ['Thùng', 'AS JS 8S 5S 2S'],
  ['Sảnh', '9S 8H 7D 6C 5S'],
  ['Bộ ba', 'QS QH QD 8C 2S'],
  ['Hai đôi', 'JS JH 8D 8C 2S'],
  ['Một đôi', 'AS AH 9D 6C 2S'],
  ['Mậu thầu', 'AS JH 9D 6C 2S'],
];
export function PokerExperience() {
  const portrait = usePortraitTable();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [handDetails, setHandDetails] = useState(false);
  const session = useTableSession();
  const { table: roomTable, loading, connection, pending, message, invite, animate } = session;
  const table = roomTable?.gameType === 'liars-deck' ? undefined : roomTable;
  const pacing = useGamePacing(table, animate);
  const hidden = useTableStore((s) => s.hidePrivateCards);
  const hide = useTableStore((s) => s.setPrivateCardsHidden);
  const [panel, setPanel] = useState<'invite' | 'admin' | 'help' | 'results' | null>(null);
  const [confirm, setConfirm] = useState<{
    text: string;
    event: string;
    body: Record<string, unknown>;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState('');
  const [grant, setGrant] = useState(100);
  const [wagerRequest, setWagerRequest] = useState<WagerRequest | null>(null);
  const now = pacing.now;
  const me = table?.players.find((p) => p.memberId === table.viewerMemberId);
  const combination =
    !hidden && table?.handInfo?.cards.length === 5
      ? describeCombination(table.handInfo.cards)
      : undefined;
  const host = Boolean(table && table.hostMemberId === table.viewerMemberId);
  const between = !table?.transition && (table?.phase === 'waiting' || table?.phase === 'paused');
  const locked = pending || connection !== 'connected' || !!table?.transition;
  const eligible =
    table?.players.filter((p) => p.connected && !p.sittingOut && p.stack > 0).length ?? 0;
  const remaining = table?.deadlineAt
    ? now
      ? Math.max(0, Math.ceil((table.deadlineAt - now) / 1000))
      : 180
    : 0;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Đã sao chép');
    } catch {
      setCopied('Không thể sao chép. Bạn có thể chọn nội dung để sao chép thủ công.');
    }
  }
  if (loading)
    return (
      <main className="loading-screen">
        <span className="brand">♠</span>
        <h1>Đang khôi phục bàn…</h1>
        <p className="muted">Kết nối lại với buổi chơi của bạn.</p>
      </main>
    );
  if (roomTable?.gameType === 'liars-deck')
    return (
      <LiarsTable
        key={roomTable.roomCode}
        animate={animate}
        table={roomTable}
        hidden={hidden}
        setHidden={hide}
        pending={pending}
        connection={connection}
        send={session.send}
        message={message}
        restore={session.restore}
        invite={invite}
      />
    );
  return (
    <>
      {message && (
        <div className="notice" role="status">
          {message}
          {connection === 'offline' && (
            <button onClick={() => void session.restore()}>Thử kết nối lại</button>
          )}
        </div>
      )}
      {!table ? (
        <Entry submit={session.submitRoom} pending={pending} />
      ) : (
        <main
          className="game-shell"
          data-motion={pacing.motion ? 'on' : 'off'}
          data-transition={pacing.kind}
          style={
            {
              '--motion-delay': `-${pacing.animationOffsetMs}ms`,
              '--motion-duration': `${pacing.durationMs}ms`,
            } as CSSProperties
          }
        >
          <header className="topbar">
            <div className="wordmark">
              <span>♠</span> PRIVATE TABLE
            </div>
            <div className="room-meta">
              <strong>Bàn {table.roomCode}</strong>
              <small>
                Blind {number(table.config.smallBlind)}/{number(table.config.bigBlind)} · Ante{' '}
                {number(table.config.ante)}
              </small>
            </div>
            <span className={`connection ${connection}`}>
              {connection === 'connected' ? '● Đã kết nối' : '○ Đang kết nối lại'}
            </span>
            <TableMenu>
              <button onClick={() => setPanel('invite')}>Lời mời</button>
              <button onClick={() => setPanel('help')}>Luật chơi</button>
              <button onClick={() => setPanel('admin')}>{host ? 'Quản lý' : 'Thông tin'}</button>
              <button onClick={() => setPanel('results')}>Kết quả</button>
            </TableMenu>
          </header>
          <p className="portrait-hint">Xoay ngang thiết bị để quan sát bàn chơi thoải mái hơn.</p>
          <section className="table-stage" aria-label="Bàn chơi">
            <Scene
              table={table}
              hidden={hidden}
              animate={pacing.motion}
              elapsedMs={pacing.elapsedMs}
            />
            <div className="table-caption">
              <span className="eyebrow">NO LIMIT · TEXAS HOLD’EM</span>
              <strong>
                {between
                  ? 'CHỜ VÁN MỚI'
                  : { preflop: 'PRE-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER' }[
                      table.street ?? 'preflop'
                    ]}
              </strong>
              <span>
                Tổng pot{' '}
                <b>
                  {number(
                    between
                      ? table.pots.reduce((a, p) => a + p.amount, 0)
                      : table.players.reduce((a, p) => a + p.contribution, 0),
                  )}
                </b>
              </span>
            </div>
            <div className="board-accessible">
              <span className="sr-only">Bài chung</span>
              <Cards cards={table.board} />
            </div>
            <ul className="seats">
              {table.players.map((player) => (
                <li
                  style={
                    {
                      ...seatPosition(table, player.seat, me?.seat ?? 0, portrait),
                      '--deal-seat': [...table.players]
                        .filter((p) => !p.folded)
                        .sort(
                          (a, b) =>
                            ((a.seat - (table.buttonSeat ?? 0) + 8) % 9) -
                            ((b.seat - (table.buttonSeat ?? 0) + 8) % 9),
                        )
                        .findIndex((p) => p.memberId === player.memberId),
                      '--deal-count': table.players.filter((p) => !p.folded).length,
                      '--deal-step': `${1350 / Math.max(1, table.players.filter((p) => !p.folded).length * 2 - 1)}ms`,
                    } as CSSProperties
                  }
                  key={player.memberId}
                  data-member={player.memberId}
                  data-effect={
                    table.transition?.actorMemberId === player.memberId
                      ? table.transition.action
                      : undefined
                  }
                  className={`seat ${player.isActing ? 'acting' : ''} ${player.folded ? 'folded' : ''} ${player.memberId === me?.memberId ? 'self' : ''} ${table.pots.some((p) => p.winnerMemberIds?.includes(player.memberId)) ? 'winner' : ''}`}
                >
                  <div className="seat-roles">
                    {player.seat === table.buttonSeat && (
                      <abbr title="Dealer — vị trí chia bài" tabIndex={0} className="disc dealer">
                        D
                      </abbr>
                    )}
                    {player.seat === table.smallBlindSeat && (
                      <abbr
                        title="Small blind — cược bắt buộc nhỏ"
                        tabIndex={0}
                        className="disc small-blind"
                      >
                        SB
                      </abbr>
                    )}
                    {player.seat === table.bigBlindSeat && (
                      <abbr
                        title="Big blind — cược bắt buộc lớn"
                        tabIndex={0}
                        className="disc big-blind"
                      >
                        BB
                      </abbr>
                    )}
                  </div>
                  {table.transition?.actorMemberId === player.memberId && (
                    <ActionEffect key={table.transition.id} action={table.transition.action} />
                  )}
                  <button
                    className="seat-name seat-details-button"
                    title={player.displayName}
                    onClick={() => setSelectedPlayer(player.memberId)}
                  >
                    {player.isHost && <span aria-label="Chủ phòng">♛ </span>}
                    {player.displayName}
                    {player.memberId === me?.memberId ? ' (Bạn)' : ''}
                  </button>
                  <strong className="stack">{number(player.stack)}</strong>
                  {table.handId &&
                    !player.folded &&
                    player.memberId !== me?.memberId &&
                    !player.holeCards?.length && (
                      <div className="public-seat-cards private-table-cards">
                        <Cards cards={['', '']} hidden />
                      </div>
                    )}
                  {player.memberId === me?.memberId &&
                    player.holeCards?.length &&
                    !player.folded && (
                      <div
                        className="public-seat-cards private-table-cards"
                        data-private-visible={!hidden}
                      >
                        <Cards cards={player.holeCards} hidden={hidden} />
                      </div>
                    )}
                  {player.memberId !== me?.memberId &&
                    player.holeCards?.length &&
                    !player.folded && (
                      <div className="public-seat-cards">
                        <Cards cards={player.holeCards} />
                      </div>
                    )}
                  {table.transition?.actorMemberId === player.memberId &&
                    table.transition.action && (
                      <span className="confirmed-action">
                        {(
                          {
                            check: '✓ Check · không thêm chip',
                            fold: 'Bỏ bài',
                            call: 'Theo',
                            bet: 'Cược',
                            raise: 'Tăng',
                            'all-in': 'Tất tay',
                          } as Record<string, string>
                        )[table.transition.action] ?? table.transition.action}
                      </span>
                    )}
                  <small>
                    {!player.connected
                      ? 'Mất kết nối'
                      : between &&
                          table.pots.some((p) => p.winnerMemberIds?.includes(player.memberId))
                        ? '♛ Thắng pot'
                        : player.sittingOut
                          ? 'Tạm nghỉ'
                          : player.folded
                            ? 'Đã bỏ bài'
                            : player.allIn
                              ? 'TẤT TAY'
                              : player.isActing
                                ? `Đến lượt · ${remaining}s`
                                : 'Đang chờ'}
                  </small>
                  {(player.streetContribution ?? 0) > 0 && (
                    <span className="contribution">● {number(player.streetContribution ?? 0)}</span>
                  )}
                  {player.isActing && (
                    <progress max={180} value={remaining} aria-label="Thời gian còn lại" />
                  )}
                </li>
              ))}
            </ul>
            {table.handId &&
              (table.players.some((p) => p.contribution > 0) || !!table.pots.length) && (
                <div className="pot-chip-pile" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span>POT</span>
                </div>
              )}
            {['street', 'showdown-reveal'].includes(pacing.kind ?? '') &&
              pacing.motion &&
              table.players
                .filter((p) => p.contribution > 0)
                .map((p) => (
                  <span
                    key={`${pacing.id}:collect:${p.memberId}`}
                    className="chip-collect"
                    aria-hidden="true"
                    style={
                      {
                        '--chip-x': seatPosition(table, p.seat, me?.seat ?? 0, portrait).left,
                        '--chip-y': seatPosition(table, p.seat, me?.seat ?? 0, portrait).top,
                      } as CSSProperties
                    }
                  >
                    ●
                  </span>
                ))}
            {(pacing.kind === 'payout' || pacing.kind === 'fold-win') &&
              pacing.motion &&
              table.players
                .filter((p) => table.pots.some((pot) => pot.winnerMemberIds?.includes(p.memberId)))
                .map((p) => (
                  <span
                    key={`${pacing.id}:${p.memberId}`}
                    className="chip-flight"
                    aria-hidden="true"
                    style={seatPosition(table, p.seat, me?.seat ?? 0, portrait)}
                  >
                    ●
                  </span>
                ))}
          </section>
          <footer className="play-dock">
            <section className="my-hand" data-private-visible={!hidden && !!me?.holeCards?.length}>
              <div>
                <span className="eyebrow">BÀI CỦA BẠN</span>
                <button
                  className="subtle"
                  onClick={() => hide(!hidden)}
                  disabled={!me?.holeCards?.length}
                  aria-pressed={!hidden}
                >
                  {hidden ? 'Xem bài riêng' : 'Che bài riêng'}
                </button>
              </div>
              <Cards
                cards={me?.holeCards?.length ? me.holeCards : ['AS', 'AS']}
                hidden={hidden || !me?.holeCards?.length}
              />
              <button className="private-hand-name" onClick={() => setHandDetails(true)}>
                {hidden
                  ? 'Thông tin bài đang được che'
                  : (table.handInfo?.name ?? 'Hai lá khởi đầu')}
              </button>
              {combination && (
                <span className="hand-detail">
                  Lá tạo bộ: {combination.made}
                  {combination.kickers && (
                    <span className="hand-kickers">Lá phụ: {combination.kickers}</span>
                  )}
                </span>
              )}
            </section>
            <section className="turn-panel">
              {table.transition ? (
                <TransitionStatus table={table} />
              ) : table.legalActions ? (
                <Actions
                  key={`${table.handId}:${table.turnId}`}
                  table={table}
                  portrait={portrait}
                  openWager={setWagerRequest}
                  locked={locked}
                  send={session.send}
                  confirm={setConfirm}
                />
              ) : (
                <>
                  <span className="eyebrow">{between ? 'GIỮA CÁC VÁN' : 'VÁN ĐANG DIỄN RA'}</span>
                  <h2>
                    {between
                      ? eligible < 2
                        ? 'Cần ít nhất 2 người có chip'
                        : host
                          ? 'Sẵn sàng chia bài?'
                          : 'Đang chờ chủ phòng bắt đầu'
                      : 'Theo dõi lượt chơi trên bàn'}
                  </h2>
                  <div className="button-row">
                    {host && between && (
                      <button
                        className="primary"
                        disabled={locked || eligible < 2}
                        onClick={() => session.send('room:start', {})}
                      >
                        Bắt đầu ván
                      </button>
                    )}
                    {table.pots.some((p) => p.payouts?.length) && (
                      <button onClick={() => setPanel('results')}>Kết quả ván</button>
                    )}
                    {me?.sittingOut && (
                      <button disabled={locked} onClick={() => session.send('room:return', {})}>
                        Tôi đã quay lại
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          </footer>
          {panel && (
            <Panel
              yourTurn={Boolean(table.legalActions) && !locked}
              title={
                {
                  invite: 'Lời mời phòng',
                  admin: host ? 'Quản lý bàn' : 'Thông tin bàn',
                  help: 'Luật chơi dễ hiểu',
                  results: 'Kết quả ván',
                }[panel]
              }
              close={() => {
                setPanel(null);
                setShowPassword(false);
                setCopied('');
              }}
            >
              {panel === 'invite' && (
                <>
                  <p>
                    Mã phòng <strong>{table.roomCode}</strong>
                  </p>
                  <button onClick={() => void copy(table.roomCode)}>Sao chép mã</button>
                  {invite && host ? (
                    <>
                      <p>
                        Mật khẩu: <code>{showPassword ? invite.password : '••••••••'}</code>
                      </p>
                      <button onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      </button>
                      <button
                        onClick={() =>
                          void copy(`Mã phòng: ${table.roomCode}\nMật khẩu: ${invite.password}`)
                        }
                      >
                        Sao chép lời mời
                      </button>
                    </>
                  ) : (
                    <p className="muted">
                      Mật khẩu chỉ có trong tab đã tạo phòng. Hãy hỏi người tạo phòng nếu cần lời
                      mời.
                    </p>
                  )}
                  <p role="status">{copied}</p>
                </>
              )}
              {panel === 'admin' && (
                <>
                  {!between && (
                    <p className="notice-inline">
                      Chỉ quản lý bàn và rời bàn sau khi ván kết thúc.
                    </p>
                  )}
                  {host && between && (
                    <>
                      <label>
                        Chip cấp mỗi lần
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={grant}
                          onChange={(e) => setGrant(Number(e.target.value))}
                        />
                      </label>
                      {table.players.map((p) => (
                        <article className="member-admin" key={p.memberId}>
                          <strong>{p.displayName}</strong>
                          <span>{number(p.stack)} chip</span>
                          <div className="button-row">
                            <button
                              disabled={locked || !Number.isSafeInteger(grant) || grant <= 0}
                              onClick={() =>
                                session.send('room:grant', { memberId: p.memberId, amount: grant })
                              }
                            >
                              {p.memberId === me?.memberId ? 'Cấp chip cho tôi' : 'Cấp chip'}
                            </button>
                            {p.memberId !== me?.memberId && (
                              <>
                                <button
                                  disabled={locked || !p.connected}
                                  onClick={() =>
                                    setConfirm({
                                      text: `Chuyển quyền chủ phòng cho ${p.displayName}?`,
                                      event: 'room:transfer-host',
                                      body: { memberId: p.memberId },
                                    })
                                  }
                                >
                                  Chuyển chủ
                                </button>
                                <button
                                  disabled={locked}
                                  className="danger"
                                  onClick={() =>
                                    setConfirm({
                                      text: `Mời ${p.displayName} ra khỏi phòng?`,
                                      event: 'room:kick',
                                      body: { memberId: p.memberId },
                                    })
                                  }
                                >
                                  Mời ra
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                      <button
                        disabled={locked}
                        onClick={() =>
                          session.send('room:pause', { paused: table.phase !== 'paused' })
                        }
                      >
                        {table.phase === 'paused' ? 'Bỏ tạm dừng' : 'Tạm dừng bàn'}
                      </button>
                      <button
                        className="danger"
                        disabled={locked}
                        onClick={() =>
                          setConfirm({
                            text: 'Đóng phòng cho tất cả người chơi? Dữ liệu phiên sẽ bị xóa.',
                            event: 'room:close',
                            body: {},
                          })
                        }
                      >
                        Đóng phòng
                      </button>
                    </>
                  )}
                  {between && (
                    <button
                      disabled={locked}
                      onClick={() =>
                        setConfirm({
                          text: host
                            ? 'Bạn là chủ phòng. Rời bàn sẽ đóng phòng cho tất cả mọi người.'
                            : 'Rời bàn và bỏ số chip còn lại?',
                          event: 'room:leave',
                          body: {},
                        })
                      }
                    >
                      Rời bàn
                    </button>
                  )}
                  <p className="muted">
                    Blind và ante được cố định lúc tạo phòng. Chip chỉ phục vụ giải trí.
                  </p>
                </>
              )}
              {panel === 'help' && (
                <>
                  <p>
                    Mỗi người có 2 lá riêng. Chọn bộ 5 lá mạnh nhất từ bài riêng và bài chung. Chất
                    không dùng để phá hòa.
                  </p>
                  <p>
                    <b>D</b> Dealer · <b>SB</b> Small blind · <b>BB</b> Big blind
                  </p>
                  <p>
                    Check: không thêm chip. Call/Theo: theo mức cược hiện tại. Raise/Tăng: tăng tổng
                    mức cược. Fold: bỏ quyền tranh pot.
                  </p>
                  {ranks.map(([name, cards], i) => (
                    <article className="rank-row" key={name}>
                      <strong>
                        {i + 1}. {name}
                      </strong>
                      <Cards cards={cards.split(' ')} />
                    </article>
                  ))}
                </>
              )}
              {panel === 'results' && (
                <>
                  <p>Ván đã kết thúc. Chủ phòng xác nhận để bắt đầu ván tiếp theo.</p>
                  {table.pots.map((pot, i) => (
                    <article className="member-admin" key={i}>
                      <h3>
                        {i === 0 ? 'Pot chính' : `Pot phụ ${i}`} · {number(pot.amount)}
                      </h3>
                      {pot.payouts?.map((p) => (
                        <p key={p.memberId}>
                          ♛{' '}
                          {table.players.find((m) => m.memberId === p.memberId)?.displayName ??
                            'Người chơi'}{' '}
                          <strong>+{number(p.amount)}</strong>
                        </p>
                      ))}
                    </article>
                  ))}
                  {table.players
                    .filter((p) => !p.folded && p.holeCards?.length)
                    .map((p) => (
                      <article className="rank-row" key={p.memberId}>
                        <strong>{p.displayName}</strong>
                        {table.board.length === 5 &&
                          table.players.some(
                            (other) => other.memberId !== me?.memberId && other.holeCards?.length,
                          ) && <PublicHand cards={[...p.holeCards!, ...table.board]} />}
                        <Cards
                          cards={p.holeCards!}
                          hidden={
                            p.memberId === me?.memberId &&
                            hidden &&
                            !table.players.some(
                              (other) => other.memberId !== me?.memberId && other.holeCards?.length,
                            )
                          }
                        />
                      </article>
                    ))}
                  <p className="muted">
                    Bài người đã bỏ giữ kín. Người thắng do tất cả đối thủ bỏ bài không phải mở bài.
                  </p>
                </>
              )}
            </Panel>
          )}
          {confirm && (
            <Panel title="Xác nhận thao tác" close={() => setConfirm(null)}>
              <p>{confirm.text}</p>
              <div className="button-row">
                <button onClick={() => setConfirm(null)}>Hủy</button>
                <button
                  className="primary"
                  disabled={
                    locked ||
                    (confirm.event === 'game:action' &&
                      (confirm.body.handId !== table.handId ||
                        confirm.body.turnId !== table.turnId ||
                        !table.legalActions?.actions.includes(confirm.body.action as PlayerAction)))
                  }
                  onClick={() => {
                    session.send(confirm.event, confirm.body);
                    setConfirm(null);
                  }}
                >
                  Xác nhận
                </button>
              </div>
            </Panel>
          )}
          {wagerRequest && (
            <WagerSheet
              request={wagerRequest}
              table={table}
              locked={locked}
              close={() => setWagerRequest(null)}
              send={session.send}
            />
          )}
          {selectedPlayer && (
            <Panel
              title="Thông tin người chơi"
              close={() => setSelectedPlayer(null)}
              yourTurn={Boolean(table.legalActions) && !locked}
            >
              {table.players
                .filter((p) => p.memberId === selectedPlayer)
                .map((p) => (
                  <div key={p.memberId}>
                    <h2>{p.displayName}</h2>
                    <p>
                      {number(p.stack)} chip · Đã cược {number(p.streetContribution ?? 0)}
                    </p>
                    <p>
                      {p.connected ? 'Đang kết nối' : 'Mất kết nối'} ·{' '}
                      {p.folded
                        ? 'Đã bỏ bài'
                        : p.allIn
                          ? 'Tất tay'
                          : p.sittingOut
                            ? 'Tạm nghỉ'
                            : p.isActing
                              ? 'Đến lượt'
                              : 'Đang chờ'}
                    </p>
                    <p>
                      {p.seat === table.buttonSeat ? 'D — Dealer ' : ''}
                      {p.seat === table.smallBlindSeat ? 'SB — Small blind ' : ''}
                      {p.seat === table.bigBlindSeat ? 'BB — Big blind' : ''}
                    </p>
                  </div>
                ))}
            </Panel>
          )}
          {handDetails && (
            <Panel
              title="Bài của bạn"
              close={() => setHandDetails(false)}
              yourTurn={Boolean(table.legalActions) && !locked}
            >
              {hidden ? (
                <p>Thông tin bài đang được che</p>
              ) : (
                <>
                  <p>{table.handInfo?.name ?? 'Hai lá khởi đầu'}</p>
                  <p>{combination?.made}</p>
                  <p>{combination?.kickers}</p>
                </>
              )}
            </Panel>
          )}
        </main>
      )}
    </>
  );
}

function PublicHand({ cards }: { cards: string[] }) {
  const hand = evaluateBestHand(cards);
  const names = hand.rank
    .slice(1)
    .map((value) => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' })[value] ?? String(value));
  return (
    <div>
      <p>
        {hand.name} · So thứ tự: {names.join(' → ')}
      </p>
      <Cards cards={hand.cards} />
      <small>
        So loại tổ hợp trước, sau đó so lần lượt các giá trị trên. Giống nhau hoàn toàn thì hòa; chỉ
        tranh pot đủ điều kiện.
      </small>
    </div>
  );
}

function Actions({
  table,
  locked,
  send,
  confirm,
  portrait,
  openWager,
}: {
  table: TableSnapshot;
  portrait: boolean;
  openWager: (request: WagerRequest) => void;
  locked: boolean;
  send: (event: string, body: Record<string, unknown>) => void;
  confirm: (value: { text: string; event: string; body: Record<string, unknown> }) => void;
}) {
  const legal = table.legalActions!;
  const min = legal.minRaiseTo ?? 0;
  const max = legal.maxRaiseTo ?? 0;
  const [wager, setWager] = useState(min);
  const canWager = (legal.actions.includes('bet') || legal.actions.includes('raise')) && min <= max;
  const valid = Number.isSafeInteger(wager) && wager >= min && wager <= max;
  const labels: Record<PlayerAction, string> = {
    fold: 'Bỏ bài',
    check: 'Check — không thêm chip',
    call: `Theo ${number(Math.min(legal.callAmount, table.players.find((p) => p.memberId === table.viewerMemberId)?.stack ?? 0))}`,
    bet: `Cược ${number(wager)}`,
    raise: `Tăng lên ${number(wager)}`,
    'all-in': 'Tất tay',
  };
  function act(action: PlayerAction) {
    const body = {
      handId: table.handId,
      turnId: table.turnId,
      action,
      ...(action === 'bet' || action === 'raise' ? { amount: wager } : {}),
    };
    if (action === 'all-in')
      confirm({
        text: `Tất tay ${number(table.players.find((p) => p.memberId === table.viewerMemberId)?.stack ?? 0)} chip còn lại?`,
        event: 'game:action',
        body,
      });
    else send('game:action', body);
  }
  return (
    <>
      <span className="eyebrow">LƯỢT CỦA BẠN</span>
      {canWager && !portrait && (
        <>
          <div className="wager-control">
            <label>
              Tổng mức cược
              <input
                aria-label="Mức cược"
                type="number"
                min={min}
                max={max}
                step={1}
                value={wager}
                onChange={(e) => setWager(Number(e.target.value))}
              />
            </label>
            <input
              aria-label="Thanh mức cược"
              type="range"
              min={min}
              max={max}
              step={1}
              value={Math.max(min, Math.min(max, wager))}
              onChange={(e) => setWager(Number(e.target.value))}
            />
            <small>
              {number(min)} – {number(max)} chip
            </small>
          </div>
        </>
      )}
      <div className="action-buttons">
        {legal.actions
          .filter((a) => !((a === 'raise' || a === 'bet') && !canWager))
          .map((action) => (
            <button
              key={action}
              className={action === 'fold' ? 'danger' : action === 'all-in' ? 'all-in' : 'primary'}
              disabled={locked || ((action === 'raise' || action === 'bet') && !valid)}
              onClick={() =>
                portrait && (action === 'raise' || action === 'bet')
                  ? openWager({ handId: table.handId, turnId: table.turnId, action, min, max })
                  : act(action)
              }
            >
              {labels[action]}
            </button>
          ))}
      </div>
    </>
  );
}

function WagerSheet({
  request,
  table,
  locked,
  close,
  send,
}: {
  request: WagerRequest;
  table: TableSnapshot;
  locked: boolean;
  close: () => void;
  send: (event: string, body: Record<string, unknown>) => void;
}) {
  const [amount, setAmount] = useState(request.min);
  const stale =
    table.handId !== request.handId ||
    table.turnId !== request.turnId ||
    !table.legalActions?.actions.includes(request.action);
  const min = table.legalActions?.minRaiseTo ?? request.min;
  const max = table.legalActions?.maxRaiseTo ?? request.max;
  const valid = Number.isSafeInteger(amount) && amount >= min && amount <= max;
  return (
    <Panel title="Cược / Tăng" close={close}>
      <div className="wager-control">
        <label>
          Tổng mức cược
          <input
            aria-label="Mức cược"
            type="number"
            min={min}
            max={max}
            step={1}
            value={amount}
            disabled={stale || locked}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <input
          aria-label="Thanh mức cược"
          type="range"
          min={min}
          max={max}
          step={1}
          value={Math.max(min, Math.min(max, amount))}
          disabled={stale || locked}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <small>
          {number(min)} – {number(max)} chip
        </small>
      </div>
      <p role="status">
        {stale
          ? 'Lượt đã thay đổi. Đóng bảng để trở lại bàn.'
          : locked
            ? 'Thao tác tạm khóa. Đang chờ kết nối hoặc xác nhận.'
            : `Tăng lên tổng ${number(amount)} chip`}
      </p>
      <button
        disabled={stale || locked || !valid}
        onClick={() => {
          send('game:action', {
            handId: request.handId,
            turnId: request.turnId,
            action: request.action,
            amount,
          });
          close();
        }}
      >
        Xác nhận cược
      </button>
    </Panel>
  );
}
