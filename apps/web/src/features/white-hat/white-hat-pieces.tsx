'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WhiteHatRole, WhiteHatSnapshot } from '../../../../../packages/contracts/src';
import type { RoomChatState } from '../table/room-chat';

export const roleNames: Record<WhiteHatRole, string> = {
  civilian: 'Dân thường',
  spy: 'Gián điệp',
  'white-hat': 'Mũ trắng',
};
export const stageNames = {
  lobby: 'Chuẩn bị',
  description: 'Lượt mô tả',
  discussion: 'Thảo luận',
  voting: 'Bỏ phiếu',
  revote: 'Bầu lại nhóm hòa',
  'tie-break': 'Quản trò phân xử',
  'last-guess': 'Chờ quyền đoán cuối',
  intermission: 'Kết quả vòng',
  finished: 'Ván đã kết thúc',
};
export const memberName = (table: WhiteHatSnapshot, id: string) =>
  table.players.find((p) => p.memberId === id)?.displayName ?? 'Người đã rời';
export const actionIds = (table: WhiteHatSnapshot) => ({
  matchId: table.matchId,
  roundId: table.roundId,
  turnId: table.turnId,
});

/** Identity-only art: never takes a role, private word, or legal-action permission. */
export const avatarPosition = (table: WhiteHatSnapshot, id: string) =>
  table.players.find((p) => p.memberId === id)?.avatarId ??
  table.players.filter((p) => !p.isModerator).findIndex((p) => p.memberId === id);
export function Avatar({
  identity,
  className = '',
  position,
}: {
  identity: string;
  className?: string;
  position?: number;
}) {
  const index =
    position !== undefined && position >= 0
      ? position % 12
      : [...identity].reduce((value, char) => (value * 31 + char.codePointAt(0)!) >>> 0, 7) % 12;
  return (
    <span
      className={`wh-avatar wh-avatar-${index % 6} ${className}`}
      aria-hidden="true"
      data-avatar={index}
    >
      <Image
        src="/white-hat/avatars.png"
        alt=""
        width={1448}
        height={1086}
        sizes="(max-width: 760px) 480px, 800px"
        loading="eager"
        draggable={false}
        style={{ left: `${-(index % 4) * 100}%`, top: `${-Math.floor(index / 4) * 100}%` }}
      />
    </span>
  );
}
export function Mascot({
  className = '',
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      className={`wh-mascot ${className}`}
      src="/white-hat/mascot.png"
      alt=""
      width={1280}
      height={1280}
      sizes="(max-width: 760px) 160px, 260px"
      priority={priority}
      draggable={false}
    />
  );
}
export function Progress({ table }: { table: WhiteHatSnapshot }) {
  const stage = table.stage;
  const index =
    stage === 'lobby'
      ? -1
      : stage === 'description'
        ? 0
        : stage === 'discussion'
          ? 1
          : ['voting', 'revote', 'tie-break'].includes(stage)
            ? 2
            : 3;
  return (
    <ol className="wh-progress" aria-label="Tiến trình vòng">
      {['Mô tả', 'Thảo luận', 'Bỏ phiếu', 'Kết quả'].map((name, i) => (
        <li
          key={name}
          className={`${i === index ? 'is-current' : ''} ${i < index ? 'is-done' : ''}`}
          aria-current={i === index ? 'step' : undefined}
        >
          <span aria-hidden="true">{i < index ? '✓' : i + 1}</span>
          <strong>{name}</strong>
        </li>
      ))}
    </ol>
  );
}

export function Victory({ table, animate }: { table: WhiteHatSnapshot; animate: boolean }) {
  const element = useRef<HTMLElement>(null);
  const seenResult = useRef('');
  const resultKey = table.result
    ? `${table.matchId}:${table.result.winner}:${table.result.winnerMemberIds.join(',')}`
    : '';
  useEffect(() => {
    if (!resultKey || seenResult.current === resultKey) return;
    seenResult.current = resultKey;
    if (
      table.result?.winner === null ||
      !animate ||
      document.visibilityState !== 'visible' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const node = element.current;
    node?.classList.add('wh-celebrate');
    const timer = window.setTimeout(() => node?.classList.remove('wh-celebrate'), 3000);
    return () => {
      window.clearTimeout(timer);
      node?.classList.remove('wh-celebrate');
    };
  }, [resultKey, animate, table.result?.winner]);
  if (!table.result) return null;
  const result = table.result;
  if (result.winner === null)
    return (
      <section className="wh-victory wh-cancelled" role="status" aria-label="Kết quả ván">
        <div>
          <span className="wh-kicker">QUẢN TRÒ ĐÃ KẾT THÚC VÁN</span>
          <h2>Ván kết thúc sớm</h2>
          <p>Không có phe thắng. Cả nhóm có thể chuẩn bị ván mới.</p>
          <p>
            Dân thường: <strong>{result.civilianWord}</strong> · Gián điệp:{' '}
            <strong>{result.spyWord}</strong>
          </p>
        </div>
      </section>
    );
  return (
    <section ref={element} className="wh-victory" role="status" aria-label="Kết quả ván">
      <div className="wh-confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ '--piece': i } as CSSProperties} />
        ))}
      </div>
      <Mascot />
      <div>
        <span className="wh-kicker">CHÚC MỪNG NGƯỜI CHIẾN THẮNG</span>
        <h2>
          {result.winner === 'white-hat'
            ? `${result.winnerMemberIds.map((id) => memberName(table, id)).join(', ')} thắng!`
            : `${roleNames[result.winner]} thắng!`}
        </h2>
        <p>
          Dân thường: <strong>{result.civilianWord}</strong> · Gián điệp:{' '}
          <strong>{result.spyWord}</strong>
        </p>
        <p>
          Người thắng:{' '}
          {result.winnerMemberIds
            .slice(0, 2)
            .map((id) => memberName(table, id))
            .join(', ')}
          {result.winnerMemberIds.length > 2 &&
            ` và ${result.winnerMemberIds.length - 2} người cùng phe`}
        </p>
      </div>
    </section>
  );
}

export function PrivateWord({
  table,
  visible,
  toggle,
}: {
  table: WhiteHatSnapshot;
  visible: boolean;
  toggle: () => void;
}) {
  if (table.privateWord === undefined || table.viewerMemberId === table.hostMemberId) return null;
  return (
    <section className={`wh-private wh-surface ${visible ? 'is-open' : ''}`}>
      <div className="wh-secret-art" aria-hidden="true">
        <span>?</span>
        <i>✦</i>
      </div>
      <div>
        <span className="wh-kicker">HỒ SƠ CỦA BẠN</span>
        <h2>{visible ? (table.privateWord ?? 'Bạn không có từ') : 'Từ riêng đang che'}</h2>
        <p>Giữ bí mật. Chỉ bạn được xem từ của mình.</p>
      </div>
      <button className="wh-primary" onClick={toggle}>
        {visible ? 'Che từ riêng' : 'Xem từ riêng'}
      </button>
    </section>
  );
}

export function History({ table }: { table: WhiteHatSnapshot }) {
  const [tab, setTab] = useState<'clues' | 'votes'>('clues');
  const names = (id: string) => memberName(table, id);
  const rounds = [...new Set(table.descriptions.map((d) => d.roundNumber))].reverse();
  return (
    <section className="wh-history wh-surface" aria-label="Diễn biến">
      <header>
        <div>
          <span className="wh-kicker">MANH MỐI TRÊN BÀN</span>
          <h2>Chuyện trong phòng</h2>
        </div>
        <span className="wh-counter">{table.descriptions.length} mô tả</span>
      </header>
      <div className="wh-tabs" role="group" aria-label="Chọn lịch sử">
        <button aria-pressed={tab === 'clues'} onClick={() => setTab('clues')}>
          Các lời mô tả
        </button>
        <button aria-pressed={tab === 'votes'} onClick={() => setTab('votes')}>
          Phiếu bầu và lượt đoán
        </button>
      </div>
      {tab === 'clues' ? (
        rounds.length ? (
          rounds.map((round) => (
            <details key={round} open={round === table.roundNumber}>
              <summary>Vòng {round}</summary>
              <ol className="wh-clues">
                {table.descriptions
                  .filter((d) => d.roundNumber === round)
                  .map((d) => (
                    <li key={`${round}:${d.memberId}`}>
                      <Avatar identity={d.memberId} position={avatarPosition(table, d.memberId)} />
                      <div>
                        <strong>{names(d.memberId)}</strong>
                        <p>{d.text ?? 'Hết giờ · bỏ lượt'}</p>
                      </div>
                    </li>
                  ))}
              </ol>
            </details>
          ))
        ) : (
          <div className="wh-empty">
            <span aria-hidden="true">…</span>
            <p>Một từ thôi, cũng có thể là manh mối!</p>
            <small>Lời mô tả xuất hiện sau mỗi lượt.</small>
          </div>
        )
      ) : (
        <>
          <div className="wh-vote-history">
            {!table.ballotResults.length && (
              <p className="wh-muted">Phiếu được công khai khi chốt lượt bầu.</p>
            )}
            {table.ballotResults.map((b, i) => (
              <details key={i}>
                <summary>
                  Vòng {b.roundNumber} · {b.runoff ? 'Bầu lại' : 'Bỏ phiếu'}
                </summary>
                <div className="wh-tallies">
                  {b.totals.map((t) => (
                    <div key={t.memberId}>
                      <span>{names(t.memberId)}</span>
                      <strong>{t.votes} phiếu</strong>
                    </div>
                  ))}
                </div>
                <ul>
                  {b.ballots.map((v) => (
                    <li key={v.memberId}>
                      {names(v.memberId)} → {v.targetIds.map(names).join(', ')}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          {table.guesses.map((g, i) => (
            <p className={`wh-guess-log ${g.correct ? 'is-correct' : ''}`} key={i}>
              <strong>{names(g.memberId)}</strong> lộ diện: “{g.text}” ·{' '}
              {g.correct ? 'Đúng!' : 'Sai, đã bị loại.'}
            </p>
          ))}
        </>
      )}
    </section>
  );
}

export function WhiteChat({
  chat,
  table,
  connected,
  draft,
  setDraft,
}: {
  chat?: RoomChatState;
  table: WhiteHatSnapshot;
  connected: boolean;
  draft: string;
  setDraft: (value: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const allowed = connected && table.legalActions.canChat;
  const markOpen = chat?.markOpen;
  useEffect(() => {
    markOpen?.(!collapsed);
    return () => markOpen?.(false);
  }, [markOpen, collapsed]);
  useEffect(() => {
    if (following.current && history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [chat?.messages.length, collapsed]);
  if (!chat) return null;
  return (
    <aside className="wh-chat wh-surface" aria-label="Chat phòng">
      <header>
        <h2>Trò chuyện</h2>
        <button
          className="wh-icon-button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? `Mở chat${chat.unread ? ` (${chat.unread})` : ''}` : 'Thu gọn'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </header>
      {collapsed ? (
        <p className="wh-chat-preview">
          {chat.unread
            ? `${chat.unread} tin mới`
            : (chat.messages.at(-1)?.text ?? 'Chưa có tin nhắn.')}
        </p>
      ) : (
        <>
          <div
            className="wh-chat-log"
            ref={history}
            role="log"
            aria-live="polite"
            onScroll={() => {
              const el = history.current;
              if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
          >
            {!chat.messages.length && (
              <div className="wh-empty">
                <span aria-hidden="true">“ ”</span>
                <p>Chưa có tin nhắn.</p>
                <small>Trao đổi cùng nhóm tại đây.</small>
              </div>
            )}
            {chat.messages.map((m) => (
              <article key={m.id}>
                <Avatar identity={m.memberId} position={avatarPosition(table, m.memberId)} />
                <div>
                  <strong>{m.displayName}</strong>
                  <p>{m.text}</p>
                </div>
              </article>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (allowed && draft.trim() && [...draft.trim()].length <= 300)
                chat.send(draft, () => {
                  setDraft('');
                  following.current = true;
                });
            }}
          >
            <label className="wh-sr-only" htmlFor="wh-chat-input">
              Tin nhắn
            </label>
            <input
              id="wh-chat-input"
              placeholder={
                table.legalActions.canChat ? 'Nói gì đó cùng nhóm…' : 'Bạn đang ở chế độ xem'
              }
              maxLength={600}
              value={draft}
              disabled={!allowed || chat.pending}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
            />
            <button
              className="wh-primary wh-chat-send"
              aria-label="Gửi tin"
              disabled={!allowed || chat.pending || !draft.trim() || [...draft.trim()].length > 300}
            >
              ↑
            </button>
          </form>
          {(chat.error || !allowed) && (
            <p className="wh-chat-status" role="status">
              {chat.error ||
                (!table.legalActions.canChat
                  ? 'Bạn chỉ được xem chat trong ván này.'
                  : 'Đang mất kết nối.')}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
