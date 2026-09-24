'use client';
import { useState, type FormEvent } from 'react';
export function Entry({
  submit,
  pending,
}: {
  submit: (path: '/rooms' | '/rooms/join', body: Record<string, unknown>) => Promise<void>;
  pending: boolean;
}) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [gameType, setGameType] = useState<'poker' | 'liars-deck'>('poker');
  const [error, setError] = useState('');
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body =
      mode === 'create'
        ? {
            displayName: values.get('name'),
            gameType,
            ...(gameType === 'poker'
              ? {
                  smallBlind: Number(values.get('smallBlind')),
                  bigBlind: Number(values.get('bigBlind')),
                  ante: Number(values.get('ante')),
                }
              : { startingLives: Number(values.get('startingLives')) }),
          }
        : {
            displayName: values.get('name'),
            roomCode: String(values.get('roomCode')).trim(),
            password: values.get('password'),
          };
    if ('smallBlind' in body && Number(body.smallBlind) >= Number(body.bigBlind)) {
      setError('Big blind phải lớn hơn Small blind.');
      return;
    }
    setError('');
    await submit(mode === 'create' ? '/rooms' : '/rooms/join', body);
  }
  return (
    <main className="entry-layout">
      <section className="entry-intro">
        <span className="eyebrow">PRIVATE TABLE · TEXAS HOLD’EM</span>
        <h1>
          Poker cho
          <br />
          nhóm riêng<span>.</span>
        </h1>
        <p>
          Một bàn bài. Những người bạn.
          <br />
          Một buổi chơi thật trọn vẹn.
        </p>
        <div className="entry-art" aria-hidden="true">
          <span>A♠</span>
          <span>K♥</span>
          <i>POKER</i>
        </div>
        <p className="fine-print">
          Chip giải trí · Không mua bán hoặc quy đổi
          <br />
          Phòng kết thúc khi máy chủ khởi động lại.
        </p>
      </section>
      <section className="entry-card">
        <div className="tabs">
          <button aria-pressed={mode === 'join'} onClick={() => setMode('join')}>
            Vào phòng
          </button>
          <button aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
            Tạo phòng
          </button>
        </div>
        <h2>{mode === 'join' ? 'Ghế của bạn đang chờ' : 'Mở bàn cùng bạn bè'}</h2>
        <p className="muted">
          {mode === 'join'
            ? 'Nhập lời mời từ chủ phòng để cùng chơi.'
            : gameType === 'liars-deck'
              ? 'Bài nói dối · 2–4 người. Chọn số mạng; bạn xác nhận từng vòng.'
              : 'Chọn blind một lần. Mỗi ván do bạn bắt đầu.'}
        </p>
        <form onSubmit={handle}>
          <label>
            Tên hiển thị
            <input
              name="name"
              required
              maxLength={24}
              placeholder="Bạn muốn được gọi là gì?"
              autoComplete="nickname"
            />
          </label>
          {mode === 'join' ? (
            <>
              <label>
                Mã phòng
                <input
                  name="roomCode"
                  required
                  autoCapitalize="characters"
                  placeholder="Nhập mã phòng"
                />
              </label>
              <label>
                Mật khẩu
                <input name="password" required type="password" autoComplete="off" />
              </label>
            </>
          ) : (
            <>
              <div className="game-choice" role="group" aria-label="Chọn game">
                <button
                  type="button"
                  aria-pressed={gameType === 'poker'}
                  onClick={() => setGameType('poker')}
                >
                  <b>♠ Poker</b>
                  <small>Texas Hold’em · Chip giải trí</small>
                </button>
                <button
                  type="button"
                  aria-pressed={gameType === 'liars-deck'}
                  onClick={() => setGameType('liars-deck')}
                >
                  <b>🂠 Bài nói dối</b>
                  <small>Bluff · Tố cáo · Mất mạng</small>
                </button>
              </div>
              {gameType === 'poker' ? (
                <>
                  <div className="field-row">
                    <label>
                      Small blind
                      <input
                        name="smallBlind"
                        type="number"
                        required
                        min={1}
                        step={1}
                        defaultValue={5}
                      />
                      <small>Cược bắt buộc nhỏ</small>
                    </label>
                    <label>
                      Big blind
                      <input
                        name="bigBlind"
                        type="number"
                        required
                        min={2}
                        step={1}
                        defaultValue={10}
                      />
                      <small>Cược bắt buộc lớn</small>
                    </label>
                  </div>
                  <label>
                    Ante
                    <input name="ante" type="number" required min={0} step={1} defaultValue={0} />
                    <small>Mỗi người đóng thêm đầu ván; 0 để tắt.</small>
                  </label>
                </>
              ) : (
                <label>
                  Số mạng ban đầu
                  <input
                    name="startingLives"
                    type="number"
                    required
                    min={1}
                    max={10}
                    step={1}
                    defaultValue={3}
                  />
                  <small>
                    Mỗi người bắt đầu cùng số mạng. Bị tố sai hoặc hết giờ sẽ mất 1 mạng.
                  </small>
                </label>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </>
          )}
          <button className="primary wide" disabled={pending} type="submit">
            {pending ? 'Đang xử lý…' : mode === 'join' ? 'Vào bàn →' : 'Tạo phòng →'}
          </button>
        </form>
      </section>
    </main>
  );
}
