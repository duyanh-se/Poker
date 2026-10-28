'use client';
import { useState, type CSSProperties } from 'react';
import type { WhiteHatSnapshot } from '../../../../../packages/contracts/src';
import type { useTableSession } from '../table/use-table-session';
import { Panel } from '../table/panel';
import { useGamePacing } from '../table/pacing';
import { Actions, Moderator, Rules, Setup } from './white-hat-controls';
import {
  Avatar,
  avatarPosition,
  actionIds,
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
  const [panel, setPanel] = useState<
    'invite' | 'help' | 'manage' | 'chat' | 'history' | 'avatar' | 'end' | null
  >(null);
  const [draft, setDraft] = useState('');
  const [avatarChoice, setAvatarChoice] = useState(0);
  const [endTarget, setEndTarget] = useState<ReturnType<typeof actionIds>>();
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
                setAvatarChoice(Math.max(0, avatarPosition(table, table.viewerMemberId)));
                setPanel('avatar');
              }}
            >
              Nhân vật
            </button>
            <button onClick={() => setPanel('chat')}>
              Chat{chat?.unread ? ` (${chat.unread})` : ''}
            </button>
            <button onClick={() => setPanel('history')}>Lịch sử</button>
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
              <span className="wh-desktop-status wh-counter">{statusText}</span>
            </header>
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
              <aside className="wh-sidebar" aria-label={host ? 'Điều hành' : 'Thao tác của bạn'}>
                <div className="wh-decision-status">
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
                  {active && (
                    <PrivateWord
                      table={table}
                      visible={secretVisible}
                      toggle={() => setHidden(!hidden)}
                    />
                  )}
                </div>
                {table.result && <Victory table={table} animate={animate} />}
                {!active && host && (
                  <Setup
                    key={`${table.matchId ?? 'new'}:${table.hostMemberId}`}
                    table={table}
                    locked={locked}
                    send={send}
                  />
                )}
                {!active && !host && !table.result && (
                  <section className="wh-lobby-banner">
                    <Mascot priority />
                    <h2>Giữ bí mật nhé!</h2>
                    <p>Chờ quản trò bắt đầu · 4–12 người chơi</p>
                  </section>
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
                {active && (
                  <Actions
                    key={table.turnId}
                    table={table}
                    selected={selected}
                    locked={locked}
                    send={send}
                    message={message}
                  />
                )}
                {!host && !table.legalActions.canChat && active && (
                  <p className="wh-notice wh-view-only">
                    Bạn đã bị loại và chỉ được xem diễn biến.
                  </p>
                )}
                {host && active && (
                  <button
                    className="wh-quiet wh-end-match"
                    disabled={locked}
                    onClick={() => {
                      setEndTarget(actionIds(table));
                      setPanel('end');
                    }}
                  >
                    Kết thúc ván
                  </button>
                )}
              </aside>
              {boardPlayers.map((p, index) => {
                const eligible =
                  canChoose &&
                  table.candidateIds.includes(p.memberId) &&
                  (hostTie || p.memberId !== table.viewerMemberId);
                const marked =
                  selected.includes(p.memberId) ||
                  Boolean(table.ownBallot?.includes(p.memberId) && voting);
                const clues = table.descriptions.filter((d) => d.memberId === p.memberId);
                const clue = clues.findLast((d) => d.text !== null) ?? clues.at(-1);
                const split = Math.ceil(boardPlayers.length / 2);
                const local = index < split ? index : index - split;
                const submitted = voting && table.submittedMemberIds.includes(p.memberId);
                return (
                  <article
                    key={p.memberId}
                    className={`wh-player ${marked ? 'is-selected' : ''} ${p.eliminated || p.departed ? 'is-out' : ''} ${table.actingMemberId === p.memberId ? 'is-acting' : ''} ${eligible ? 'is-choosable' : ''}`}
                    data-member={p.memberId}
                    style={
                      {
                        '--wh-column': (local % 2) + (index < split ? 1 : 4),
                        '--wh-row': Math.floor(local / 2) + (split <= 2 ? 2 : 1),
                      } as CSSProperties
                    }
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
                      <Avatar identity={p.memberId} position={avatarPosition(table, p.memberId)} />
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
                    <p className={`wh-player-clue ${clue?.text ? '' : 'is-empty'}`}>
                      {clue && clue.roundNumber !== table.roundNumber && (
                        <small>Vòng {clue.roundNumber} · </small>
                      )}
                      {clue ? (clue.text ?? 'Đã bỏ lượt') : 'Chưa có mô tả'}
                    </p>
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
          </section>
        </div>
        {panel && (
          <Panel
            title={
              panel === 'invite'
                ? 'Lời mời'
                : panel === 'help'
                  ? 'Luật Mũ Trắng'
                  : panel === 'chat'
                    ? 'Chat phòng'
                    : panel === 'history'
                      ? 'Lịch sử ván'
                      : panel === 'avatar'
                        ? 'Chọn nhân vật'
                        : panel === 'end'
                          ? 'Kết thúc ván sớm'
                          : 'Quản lý phòng'
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
            ) : panel === 'chat' ? (
              <WhiteChat
                chat={chat}
                table={table}
                connected={connection === 'connected'}
                draft={draft}
                setDraft={setDraft}
              />
            ) : panel === 'history' ? (
              <History key={table.matchId ?? 'lobby'} table={table} />
            ) : panel === 'avatar' ? (
              <>
                <p>Chọn nhân vật của bạn. Cả nhóm sẽ thấy lựa chọn này.</p>
                <div className="wh-avatar-picker" role="group" aria-label="Nhân vật của bạn">
                  {Array.from({ length: 12 }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      className="wh-avatar-option"
                      aria-label={`Nhân vật ${index + 1}`}
                      aria-pressed={avatarChoice === index}
                      disabled={locked}
                      onClick={() => setAvatarChoice(index)}
                    >
                      <Avatar identity={String(index)} position={index} />
                      <span>
                        {avatarChoice === index ? '✓ ' : ''}
                        {index + 1}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  className="wh-primary wh-full"
                  disabled={locked}
                  onClick={() => {
                    send('white-hat:set-avatar', { avatarId: avatarChoice });
                    setPanel(null);
                  }}
                >
                  Lưu nhân vật
                </button>
              </>
            ) : panel === 'end' ? (
              <>
                <p>
                  Kết thúc ván ngay, không có phe thắng. Role và hai từ sẽ được công bố. Phòng được
                  giữ để chuẩn bị ván mới.
                </p>
                <button
                  className="wh-coral wh-full"
                  disabled={
                    locked ||
                    !host ||
                    !active ||
                    endTarget?.matchId !== table.matchId ||
                    endTarget?.roundId !== table.roundId ||
                    endTarget?.turnId !== table.turnId
                  }
                  onClick={() => {
                    send('white-hat:end-match', { ...endTarget });
                    setPanel(null);
                  }}
                >
                  Xác nhận kết thúc ván
                </button>
                {endTarget?.turnId !== table.turnId && (
                  <p role="status">Giai đoạn đã thay đổi. Hãy đóng bảng và kiểm tra lại.</p>
                )}
              </>
            ) : (
              <>
                <p>Quản trò chỉ điều hành. Cấu hình và quản lý thành viên chỉ dùng giữa các ván.</p>
                {host &&
                  !active &&
                  present.map((p) => (
                    <div className="wh-admin-row" key={p.memberId}>
                      <Avatar identity={p.memberId} position={avatarPosition(table, p.memberId)} />
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
