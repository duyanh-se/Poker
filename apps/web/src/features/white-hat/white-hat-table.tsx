'use client';
import { useState, type CSSProperties } from 'react';
import type { WhiteHatSnapshot } from '../../../../../packages/contracts/src';
import type { useTableSession } from '../table/use-table-session';
import { Panel } from '../table/panel';
import { useGamePacing } from '../table/pacing';
import { Actions, Moderator, Rules, Setup } from './white-hat-controls';
import {
  Avatar,
  History,
  Mascot,
  memberName,
  PrivateWord,
  Progress,
  roleNames,
  stageNames,
  Victory,
  WhiteChat,
} from './white-hat-pieces';

type Props = Pick<
  ReturnType<typeof useTableSession>,
  'pending' | 'connection' | 'send' | 'message' | 'restore'
> &
  Partial<Pick<ReturnType<typeof useTableSession>, 'invite' | 'chat' | 'animate'>> & {
    table: WhiteHatSnapshot;
    hidden: boolean;
    setHidden: (hidden: boolean) => void;
  };
export function WhiteHatTable(props: Props) {
  const {
    table,
    connection,
    pending,
    hidden,
    setHidden,
    message,
    send,
    invite,
    chat,
    animate = false,
  } = props;
  const [panel, setPanel] = useState<'invite' | 'help' | 'manage' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState<{ turnId?: string; ids: string[] }>({ ids: [] });
  const selected = selection.turnId === table.turnId ? selection.ids : [];
  const { now } = useGamePacing(table, animate);
  const host = table.hostMemberId === table.viewerMemberId;
  const active = table.matchStatus === 'active';
  const locked = pending || connection !== 'connected';
  const participants = table.players.filter((p) => !p.isModerator);
  const present = participants.filter((p) => !p.departed);
  const living = present.filter((p) => !p.eliminated);
  const seconds = table.deadlineAt
    ? Math.max(0, Math.ceil((table.deadlineAt - now) / 1000))
    : undefined;
  const secretVisible = !hidden && connection === 'connected';
  const hostTie = host && table.stage === 'tie-break';
  const canChoose = table.legalActions.canVote || hostTie;
  const voting = ['voting', 'revote', 'tie-break'].includes(table.stage);
  const boardPlayers = voting
    ? participants.filter((p) => table.candidateIds.includes(p.memberId))
    : participants;
  const names = (id: string) => memberName(table, id);
  const title = !active
    ? table.result
      ? 'Nhìn lại đội hình!'
      : 'Bạn bè đã sẵn sàng?'
    : table.stage === 'description'
      ? table.legalActions.canDescribe
        ? 'Đến lượt bạn!'
        : `${names(table.actingMemberId ?? '')} đang mô tả`
      : table.stage === 'discussion'
        ? 'Bạn đã tìm ra manh mối?'
        : table.stage === 'voting'
          ? 'Bạn nghi ngờ ai?'
          : table.stage === 'revote'
            ? 'Chọn lại, nghĩ thật kỹ!'
            : table.stage === 'tie-break'
              ? 'Một quyết định cuối cùng!'
              : table.stage === 'last-guess'
                ? 'Khoan đã, còn một cơ hội!'
                : 'Vòng này đã khép lại!';
  const currentClues = table.descriptions.filter(
    (d) => d.roundNumber === table.roundNumber && living.some((p) => p.memberId === d.memberId),
  ).length;
  const statusText = voting
    ? `${table.submittedMemberIds.filter((id) => living.some((p) => p.memberId === id)).length}/${living.length} đã gửi phiếu`
    : table.stage === 'description'
      ? `${currentClues}/${living.length} đã mô tả`
      : active
        ? `${living.length} người còn chơi`
        : `${present.filter((p) => p.connected).length}/${present.length} đã kết nối`;
  function choose(id: string) {
    setSelection({
      turnId: table.turnId,
      ids: selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id],
    });
  }
  return (
    <main className="wh-game" data-stage={table.stage} data-dock={canChoose ? 'on' : 'off'}>
      <div className="wh-world" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="wh-shell">
        <header className="wh-header">
          <div className="wh-brand">
            <Mascot priority />
            <div>
              <h1>MŨ TRẮNG</h1>
              <p>Suy luận vui, chơi là thân!</p>
            </div>
          </div>
          <div className="wh-room">
            <span>Mã phòng</span>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(table.roomCode);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              aria-label="Sao chép mã phòng"
            >
              <strong>{table.roomCode}</strong>
              <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
            </button>
          </div>
          <nav aria-label="Menu phòng">
            <button
              onClick={() => {
                setShowPassword(false);
                setPanel('invite');
              }}
            >
              Lời mời
            </button>
            <button onClick={() => setPanel('help')}>Luật chơi</button>
            <button onClick={() => setPanel('manage')}>{host ? 'Quản lý' : 'Thông tin'}</button>
          </nav>
        </header>
        {(message || connection !== 'connected') && (
          <div role="status" className="wh-notice wh-connection-notice">
            {message || 'Đang kết nối lại. Thao tác tạm khóa.'}
            {connection === 'offline' && (
              <button onClick={() => void props.restore()}>Thử kết nối lại</button>
            )}
          </div>
        )}
        <Progress table={table} />
        {table.result && <Victory table={table} animate={animate} />}
        <div className="wh-layout">
          <section className="wh-playboard" aria-label="Người chơi">
            <header className="wh-stage-heading">
              <div>
                <span className="wh-round">
                  {table.roundNumber ? `Vòng ${table.roundNumber}` : 'PHÒNG CHỜ'}
                </span>
                <span className="wh-stage-label">{stageNames[table.stage]}</span>
                <h2>{title}</h2>
                <p>
                  {voting
                    ? `Chọn ${table.ballotSize} người bạn nghi ngờ.`
                    : !active
                      ? 'Rủ hội bạn, giữ bí mật và cùng tìm ra ai khác biệt.'
                      : host
                        ? 'Bạn là quản trò. Cùng giữ nhịp cho cuộc chơi nhé!'
                        : 'Một lời mô tả cũng có thể thay đổi cả cuộc chơi.'}
                </p>
              </div>
              {seconds !== undefined && (
                <div
                  className="wh-clock"
                  data-urgent={seconds <= 10}
                  role="timer"
                  aria-label="Thời gian còn lại"
                  style={
                    {
                      '--wh-clock-progress': `${Math.min(1, seconds / (table.stage === 'last-guess' ? 30 : 60)) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <span aria-hidden="true">◷</span>
                  <strong>
                    {seconds}
                    <small>s</small>
                  </strong>
                </div>
              )}
            </header>
            {!active && !table.result && (
              <div className="wh-lobby-banner">
                <div>
                  <span className="wh-kicker">CẢ HỘI CÙNG VÀO CUỘC</span>
                  <h3>
                    Giữ bí mật nhé.
                    <br />
                    Cả hội cùng suy luận!
                  </h3>
                  <p>4–12 người chơi · 1 quản trò</p>
                  {!host && <span className="wh-wait-chip">Chờ quản trò bắt đầu</span>}
                </div>
                <Mascot priority />
              </div>
            )}
            {table.notice && <p className="wh-notice">{table.notice}</p>}
            <div className="wh-board-bar">
              <h3>
                {voting
                  ? table.stage === 'revote' || hostTie
                    ? 'Nhóm đang hòa phiếu'
                    : 'Chọn nhân vật'
                  : 'Quanh bàn'}
              </h3>
              <span className="wh-counter">
                {voting ? statusText : `${present.length}/12 người`}
              </span>
            </div>
            <fieldset
              className="wh-board-grid"
              data-count={Math.max(boardPlayers.length, !active && !table.result ? 4 : 0)}
              disabled={locked}
              aria-label={
                hostTie
                  ? 'Nhóm hòa cần phân xử'
                  : voting
                    ? 'Người bạn nghi ngờ'
                    : 'Đội hình người chơi'
              }
            >
              <legend className="wh-sr-only">
                {voting ? 'Chọn người bị nghi ngờ' : 'Đội hình'}
              </legend>
              {boardPlayers.map((p) => {
                const eligible =
                  canChoose &&
                  table.candidateIds.includes(p.memberId) &&
                  (hostTie || p.memberId !== table.viewerMemberId);
                const marked =
                  selected.includes(p.memberId) ||
                  Boolean(table.ownBallot?.includes(p.memberId) && voting);
                const clue = table.descriptions.find(
                  (d) => d.roundNumber === table.roundNumber && d.memberId === p.memberId,
                );
                const submitted = voting && table.submittedMemberIds.includes(p.memberId);
                return (
                  <article
                    key={p.memberId}
                    className={`wh-player ${marked ? 'is-selected' : ''} ${p.eliminated || p.departed ? 'is-out' : ''} ${table.actingMemberId === p.memberId ? 'is-acting' : ''} ${eligible ? 'is-choosable' : ''}`}
                    data-member={p.memberId}
                  >
                    {eligible && (
                      <input
                        className="wh-portrait-choice"
                        type="checkbox"
                        aria-label={p.displayName}
                        checked={selected.includes(p.memberId)}
                        disabled={
                          !selected.includes(p.memberId) && selected.length >= table.ballotSize
                        }
                        onChange={() => choose(p.memberId)}
                      />
                    )}
                    <div className="wh-player-art">
                      <Avatar
                        identity={p.memberId}
                        position={participants.findIndex(
                          (person) => person.memberId === p.memberId,
                        )}
                      />
                      {marked && (
                        <span className="wh-choice-stamp" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      {table.actingMemberId === p.memberId && (
                        <span className="wh-turn-flag">Đang mô tả</span>
                      )}
                      {p.memberId === table.viewerMemberId && <span className="wh-you">Bạn</span>}
                    </div>
                    <div className="wh-player-info">
                      <strong>{p.displayName}</strong>
                      <small
                        className={p.connected && !p.eliminated && !p.departed ? 'is-online' : ''}
                      >
                        {p.departed
                          ? 'Đã bỏ cuộc'
                          : p.eliminated
                            ? 'Đã bị loại'
                            : submitted
                              ? 'Đã gửi phiếu'
                              : p.connected
                                ? 'Đang tham gia'
                                : 'Mất kết nối'}
                      </small>
                      {p.role && <span className="wh-role">{roleNames[p.role]}</span>}
                    </div>
                    {clue && !voting && active && (
                      <p className="wh-player-clue">{clue.text ?? 'Đã bỏ lượt'}</p>
                    )}
                  </article>
                );
              })}
              {!active &&
                !table.result &&
                Array.from({ length: Math.max(0, 4 - present.length) }, (_, i) => (
                  <div className="wh-empty-seat" key={`empty-${i}`}>
                    <span aria-hidden="true">+</span>
                    <strong>Chờ một người bạn</strong>
                  </div>
                ))}
            </fieldset>
            <div className="wh-board-footer">
              <span className={`wh-connection ${connection === 'connected' ? 'is-online' : ''}`}>
                {connection === 'connected' ? 'Đã kết nối' : 'Mất kết nối'}
              </span>
              <span>{host ? 'Bạn là quản trò' : `Quản trò: ${names(table.hostMemberId)}`}</span>
            </div>
            {table.lastEliminatedIds.length > 0 && (
              <p className="wh-notice wh-elimination">
                Bị vote loại vòng này:{' '}
                <strong>{table.lastEliminatedIds.map(names).join(', ')}</strong>
              </p>
            )}
            <History key={table.matchId ?? 'lobby'} table={table} />
          </section>
          <aside className="wh-sidebar" aria-label={host ? 'Điều hành' : 'Thao tác của bạn'}>
            {!active && host && (
              <Setup
                key={`${table.matchId ?? 'new'}:${table.hostMemberId}`}
                table={table}
                locked={locked}
                send={send}
              />
            )}
            {active && host && (
              <Moderator
                table={table}
                visible={secretVisible}
                toggle={() => setHidden(!hidden)}
                locked={locked}
                send={send}
              />
            )}
            <PrivateWord table={table} visible={secretVisible} toggle={() => setHidden(!hidden)} />
            {active && (
              <Actions
                key={table.turnId}
                table={table}
                selected={selected}
                locked={locked}
                send={send}
              />
            )}
            {!host && !table.legalActions.canChat && active && (
              <p className="wh-notice wh-view-only">Bạn đã bị loại và chỉ được xem diễn biến.</p>
            )}
            <WhiteChat chat={chat} table={table} connected={connection === 'connected'} />
          </aside>
        </div>
        {panel && (
          <Panel
            title={
              panel === 'invite' ? 'Lời mời' : panel === 'help' ? 'Luật Mũ Trắng' : 'Quản lý phòng'
            }
            close={() => setPanel(null)}
            yourTurn={table.legalActions.canDescribe}
          >
            {panel === 'invite' ? (
              <div className="wh-invite">
                <Mascot />
                <span className="wh-kicker">RỦ HỘI BẠN VÀO CHƠI</span>
                <p>
                  Mã phòng: <strong>{table.roomCode}</strong>
                </p>
                {invite ? (
                  <>
                    <p>
                      Mật khẩu: <strong>{showPassword ? invite.password : '••••••••'}</strong>
                    </p>
                    <button
                      className="wh-secondary wh-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Che mật khẩu' : 'Hiện mật khẩu'}
                    </button>
                  </>
                ) : (
                  <p>Xin lời mời từ quản trò.</p>
                )}
              </div>
            ) : panel === 'help' ? (
              <Rules />
            ) : (
              <>
                <p>Quản trò chỉ điều hành. Cấu hình và quản lý thành viên chỉ dùng giữa các ván.</p>
                {host &&
                  !active &&
                  present.map((p) => (
                    <div className="wh-admin-row" key={p.memberId}>
                      <Avatar identity={p.memberId} />
                      <strong>{p.displayName}</strong>
                      <button
                        className="wh-secondary"
                        disabled={locked || !p.connected}
                        onClick={() => send('room:transfer-host', { memberId: p.memberId })}
                      >
                        Chuyển quản trò
                      </button>
                      <button
                        className="wh-quiet"
                        disabled={locked}
                        onClick={() => send('room:kick', { memberId: p.memberId })}
                      >
                        Mời ra
                      </button>
                    </div>
                  ))}
                <p>
                  {host
                    ? 'Đóng phòng sẽ kết thúc ván và xóa dữ liệu.'
                    : 'Rời khi đang chơi là bỏ cuộc và mất quyền đoán cuối.'}
                </p>
                <button
                  className="wh-coral wh-full"
                  disabled={locked}
                  onClick={() => {
                    if (
                      window.confirm(
                        host
                          ? 'Đóng phòng và xóa dữ liệu?'
                          : 'Rời phòng và bỏ cuộc nếu ván đang diễn ra?',
                      )
                    )
                      send(host ? 'room:close' : 'room:leave', {});
                  }}
                >
                  {host ? 'Đóng phòng' : 'Rời phòng'}
                </button>
              </>
            )}
          </Panel>
        )}
      </div>
    </main>
  );
}
