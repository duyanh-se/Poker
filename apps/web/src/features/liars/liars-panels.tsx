import { useState } from 'react';
import { Panel } from '../table/panel';
import type { LiarsTableSnapshot } from '../../../../../packages/contracts/src';
import { Card } from './liars-pieces';
type Confirmation = { event: string; body: Record<string, unknown>; text: string };
export function RoomPanel({
  kind,
  table,
  invite,
  locked,
  close,
  send,
}: {
  kind: 'invite' | 'manage' | 'help';
  table: LiarsTableSnapshot;
  invite?: { roomCode: string; password: string };
  locked: boolean;
  close: () => void;
  send: (event: string, body: Record<string, unknown>) => void;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState('');
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const host = table.hostMemberId === table.viewerMemberId;
  const between = table.phase === 'waiting' && !table.transition;
  const validInvite = host && invite?.roomCode === table.roomCode ? invite : undefined;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied('Đã sao chép.');
    } catch {
      setCopied('Không thể sao chép. Hãy chọn và sao chép nội dung thủ công.');
    }
  }
  const target = table.players.find((p) => p.memberId === confirm?.body.memberId);
  const canConfirm =
    !!confirm &&
    !locked &&
    between &&
    (confirm.event === 'room:leave' || host) &&
    (!confirm.body.memberId || !!target) &&
    (confirm.event !== 'room:transfer-host' || target?.connected);
  return (
    <Panel
      title={
        kind === 'invite'
          ? 'Lời mời riêng'
          : kind === 'help'
            ? 'Cách chơi Bài nói dối'
            : host
              ? 'Quản lý phòng'
              : 'Thông tin phòng'
      }
      close={close}
    >
      {kind === 'invite' ? (
        <>
          <p>Chỉ gửi lời mời cho người bạn muốn cùng chơi.</p>
          <p>
            Mã phòng: <code>{table.roomCode}</code>
          </p>
          <button onClick={() => void copy(table.roomCode)}>Sao chép mã</button>
          {validInvite ? (
            <>
              <p>
                Mật khẩu: <code>{show ? validInvite.password : '••••••••'}</code>
              </p>
              <div className="liar-dialog-actions">
                <button onClick={() => setShow(!show)}>
                  {show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                </button>
                <button onClick={() => void copy(validInvite.password)}>Sao chép mật khẩu</button>
              </div>
            </>
          ) : (
            <p>Mật khẩu chỉ có trong tab tạo phòng của chủ phòng.</p>
          )}
          <p role="status">{copied}</p>
        </>
      ) : kind === 'help' ? (
        <ol className="liar-help">
          <li>
            <Card rank="A" />
            <div>
              <h3>1. Đánh úp</h3>
              <p>Chọn 1–3 lá bất kỳ và tuyên bố đó là bài bàn. Joker luôn hợp lệ.</p>
            </div>
          </li>
          <li>
            <span className="liar-help-symbol" aria-hidden="true">
              ?
            </span>
            <div>
              <h3>2. Tin hay tố cáo?</h3>
              <p>
                Đánh tiếp để chấp nhận lời trước, hoặc chọn NÓI DỐI! để kiểm tra nhóm bài vừa đánh.
              </p>
            </div>
          </li>
          <li>
            <span className="liar-help-symbol" aria-hidden="true">
              ♥
            </span>
            <div>
              <h3>3. Người sai mất mạng</h3>
              <p>
                Có bài sai loại: người đánh mất 1 mạng. Tất cả hợp lệ: người tố cáo mất 1 mạng. Hết
                180 giây cũng mất 1 mạng. Người sống cuối cùng thắng.
              </p>
            </div>
          </li>
        </ol>
      ) : (
        <>
          {!between ? (
            <p>Chỉ quản lý phòng và rời phòng giữa các vòng.</p>
          ) : (
            <>
              <p>
                {table.players.length}/4 người · {table.config.startingLives} mạng ban đầu
              </p>
              {host &&
                table.players
                  .filter((p) => p.memberId !== table.viewerMemberId)
                  .map((p) => (
                    <div className="liar-member" key={p.memberId}>
                      <strong>{p.displayName}</strong>
                      <button
                        disabled={locked || !p.connected}
                        onClick={() =>
                          setConfirm({
                            event: 'room:transfer-host',
                            body: { memberId: p.memberId },
                            text: `Chuyển quyền chủ phòng cho ${p.displayName}?`,
                          })
                        }
                      >
                        Chuyển chủ
                      </button>
                      <button
                        disabled={locked}
                        onClick={() =>
                          setConfirm({
                            event: 'room:kick',
                            body: { memberId: p.memberId },
                            text: `Mời ${p.displayName} ra? Nếu trận còn diễn ra, họ mất toàn bộ mạng còn lại.`,
                          })
                        }
                      >
                        Mời ra
                      </button>
                    </div>
                  ))}
              <div className="liar-dialog-actions">
                {host && (
                  <button
                    disabled={locked}
                    onClick={() =>
                      setConfirm({
                        event: 'room:close',
                        body: {},
                        text: 'Đóng phòng và xóa toàn bộ phiên chơi của mọi người?',
                      })
                    }
                  >
                    Đóng phòng
                  </button>
                )}
                <button
                  disabled={locked}
                  onClick={() =>
                    setConfirm({
                      event: 'room:leave',
                      body: {},
                      text: host
                        ? 'Bạn là chủ phòng. Rời phòng sẽ đóng phòng cho tất cả mọi người.'
                        : 'Rời phòng? Nếu trận còn diễn ra, bạn mất toàn bộ mạng còn lại.',
                    })
                  }
                >
                  Rời phòng
                </button>
              </div>
            </>
          )}
          {confirm && (
            <section className="liar-confirm" role="group" aria-label="Xác nhận thao tác">
              <p>{confirm.text}</p>
              <button
                disabled={!canConfirm}
                onClick={() => {
                  if (canConfirm) {
                    send(confirm.event, confirm.body);
                    setConfirm(null);
                  }
                }}
              >
                Xác nhận
              </button>
              <button onClick={() => setConfirm(null)}>Hủy</button>
            </section>
          )}
        </>
      )}
    </Panel>
  );
}
