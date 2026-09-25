'use client';
import { useState, type CSSProperties } from 'react';
import { useGamePacing } from '../table/pacing';
import type { LiarsTableSnapshot } from '../../../../../packages/contracts/src';
import { Seat, Result, rankNames, TabletopCards, PenaltyShot } from './liars-pieces';
import { TurnControls } from './liars-controls';
import { RoomPanel } from './liars-panels';
import { TableMenu } from '../table/mobile-layout';
import { Panel } from '../table/panel';
import { RoomChat, type RoomChatState } from '../table/room-chat';
type Props = {
  chat?: RoomChatState;
  table: LiarsTableSnapshot;
  hidden: boolean;
  setHidden: (value: boolean) => void;
  pending: boolean;
  connection: string;
  send: (event: string, body: Record<string, unknown>) => void;
  message: string;
  restore: () => Promise<void>;
  invite?: { roomCode: string; password: string };
  animate?: boolean;
};
export function LiarsTable({
  table,
  hidden,
  setHidden,
  pending,
  connection,
  send,
  message,
  restore,
  invite,
  animate = false,
  chat,
}: Props) {
  const pacing = useGamePacing(table, animate);
  const now = pacing.now;
  const [panel, setPanel] = useState<'invite' | 'manage' | 'help' | null>(null);
  const [results, setResults] = useState(false);
  const me = table.players.find((p) => p.memberId === table.viewerMemberId);
  if (!me) return null;
  const seconds =
    table.deadlineAt && now !== null ? Math.max(0, Math.ceil((table.deadlineAt - now) / 1000)) : 0;
  const locked = pending || connection !== 'connected' || !!table.transition;
  const opponents = table.players
    .filter((p) => p.memberId !== me.memberId)
    .sort((a, b) => ((a.seat - me.seat + 4) % 4) - ((b.seat - me.seat + 4) % 4));
  const positions =
    opponents.length === 1
      ? ['top']
      : opponents.length === 2
        ? ['upper-left', 'upper-right']
        : ['left', 'top', 'right'];
  const previous = table.players.find((p) => p.memberId === table.lastPlay?.memberId);
  return (
    <main
      className="liar-shell"
      data-motion={pacing.motion ? 'on' : 'off'}
      data-transition={pacing.kind}
      style={
        {
          '--motion-delay': `-${pacing.animationOffsetMs}ms`,
          '--motion-duration': `${pacing.durationMs}ms`,
        } as CSSProperties
      }
    >
      <header className="liar-topbar">
        <div className="liar-brand">
          <span aria-hidden="true">♠</span>
          <div>
            <strong>BÀI NÓI DỐI</strong>
            <small>Một bàn bài. Không phải lời nào cũng thật.</small>
          </div>
        </div>
        <span className="liar-room">
          Bàn {table.roomCode} <small>· Vòng {table.roundNumber}</small>
        </span>
        <span className={`liar-connection ${connection}`}>
          {connection === 'connected' ? '● Đã kết nối' : '○ Đang kết nối lại'}
        </span>
        <TableMenu>
          <button onClick={() => setPanel('invite')}>Lời mời</button>
          <button onClick={() => setPanel('help')}>Luật chơi</button>
          <button onClick={() => setPanel('manage')}>
            {table.hostMemberId === me.memberId ? 'Quản lý' : 'Thông tin'}
          </button>
          <button onClick={() => setResults(true)}>Kết quả</button>
        </TableMenu>
      </header>
      <RoomChat
        chat={chat}
        connected={connection === 'connected'}
        yourTurn={table.actingMemberId === me.memberId && !table.transition}
      />
      <p className="liar-portrait">Xoay ngang điện thoại để nhìn rõ bàn và tay bài.</p>
      {(message || connection !== 'connected') && (
        <div className="liar-notice" role="status">
          {message || 'Đang kết nối lại. Các thao tác tạm khóa.'}
          {connection === 'offline' && (
            <button onClick={() => void restore()}>Thử kết nối lại</button>
          )}
        </div>
      )}
      <section className="liar-stage" aria-label="Bàn Bài nói dối">
        <div className="liar-wood" aria-hidden="true" />
        <span className="liar-table-mark" aria-hidden="true">
          TRUST NO CLAIM
        </span>
        {opponents.map((p, i) => (
          <Seat
            key={p.memberId}
            player={p}
            max={table.config.startingLives}
            seconds={seconds}
            position={positions[i]}
            animate={
              pacing.motion &&
              pacing.kind === 'life-loss' &&
              pacing.elapsedMs >= pacing.durationMs * 0.75 &&
              table.result?.loserMemberId === p.memberId
            }
          />
        ))}
        <div className="liar-center">
          <div className="liar-target">
            <small>LOẠI BÀI BÀN</small>
            <strong>Bài bàn: {rankNames[table.tableRank ?? ''] ?? 'Chờ chia bài'}</strong>
            <span>Joker luôn hợp lệ</span>
          </div>
          <TabletopCards
            table={table}
            source={
              positions[opponents.findIndex((p) => p.memberId === table.lastPlay?.memberId)] ??
              'self'
            }
          />
          {table.lastPlay && !table.result && (
            <p className="liar-table-claim">
              <b>{previous?.displayName ?? 'Người chơi'}</b> tuyên bố {table.lastPlay.count} lá{' '}
              {rankNames[table.tableRank ?? '']}
            </p>
          )}
          {table.result && (
            <>
              <Result table={table} animate={false} />
              <button className="portrait-result-button" onClick={() => setResults(true)}>
                Chi tiết kết quả
              </button>
            </>
          )}
        </div>
        <PenaltyShot
          shooterPosition={
            positions[
              opponents.findIndex(
                (p) =>
                  p.memberId ===
                  (table.result?.reason === 'challenge' && table.result.wasLie
                    ? (table.result.challengerMemberId ?? table.result.loserMemberId)
                    : table.result?.loserMemberId),
              )
            ] ?? 'self'
          }
          motion={pacing.motion}
          active={
            !!table.result &&
            table.result.reason !== 'forfeit' &&
            ['life-loss', 'timeout'].includes(pacing.kind ?? '') &&
            table.players.some((p) => p.memberId === table.result?.loserMemberId)
          }
          name={
            table.players.find((p) => p.memberId === table.result?.loserMemberId)?.displayName ?? ''
          }
          position={
            positions[opponents.findIndex((p) => p.memberId === table.result?.loserMemberId)] ??
            'self'
          }
        />
        <TurnControls
          table={table}
          hidden={hidden}
          setHidden={setHidden}
          locked={locked}
          pending={pending}
          seconds={seconds}
          send={send}
        />
      </section>
      {panel && (
        <RoomPanel
          key={panel}
          kind={panel}
          table={table}
          invite={invite}
          locked={locked}
          close={() => setPanel(null)}
          send={send}
        />
      )}
      {results && (
        <Panel
          title="Kết quả vòng"
          close={() => setResults(false)}
          yourTurn={table.actingMemberId === me.memberId && !locked}
        >
          {table.result ? <Result table={table} animate={false} /> : <p>Chưa có kết quả vòng.</p>}
        </Panel>
      )}
    </main>
  );
}
