import type { LiarsTableSnapshot } from '../../../../../packages/contracts/src';
export const rankNames: Record<string, string> = { A: 'Át', K: 'Già', Q: 'Đầm', JOKER: 'Joker' };
export type Player = LiarsTableSnapshot['players'][number];

export function Card({
  rank = '',
  hidden = false,
  selected = false,
  onClick,
  disabled = false,
}: {
  rank?: string;
  hidden?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const label = hidden ? 'Bài đang che' : `Lá ${rank}`;
  const art = (
    <svg viewBox="0 0 80 112" aria-hidden="true" focusable="false">
      <rect
        x="1"
        y="1"
        width="78"
        height="110"
        rx="7"
        fill={hidden ? '#30232a' : '#fff3da'}
        stroke="#bd9565"
        strokeWidth="2"
      />
      {hidden ? (
        <>
          <rect x="7" y="7" width="66" height="98" rx="3" fill="none" stroke="#b18c60" />
          <path
            d="M40 18 68 56 40 94 12 56Z M40 31 58 56 40 81 22 56Z"
            fill="none"
            stroke="#bd9565"
          />
          <text x="40" y="63" textAnchor="middle" fill="#e2bd80" fontSize="24">
            ✦
          </text>
        </>
      ) : (
        <>
          <text x="9" y="23" fill="#612f37" fontSize="20" fontFamily="Georgia" fontWeight="bold">
            {rank === 'JOKER' ? 'J' : rank}
          </text>
          <path
            d={
              rank === 'A'
                ? 'M40 29 22 65h36Z M40 44v37'
                : rank === 'JOKER'
                  ? 'm40 30 6 17 18 6-18 7-6 19-6-19-18-7 18-6Z'
                  : 'm20 43 9 9 11-18 11 18 9-9-6 31H26Z'
            }
            fill="none"
            stroke="#936333"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <text x="40" y="97" textAnchor="middle" fill="#936333" fontSize="8" letterSpacing="2">
            {rank === 'JOKER' ? 'JOKER' : 'PRIVATE TABLE'}
          </text>
        </>
      )}
    </svg>
  );
  return onClick ? (
    <button
      type="button"
      className={`liar-card ${selected && !hidden ? 'selected' : ''}`}
      aria-label={label}
      aria-pressed={hidden ? false : selected}
      onClick={onClick}
      disabled={disabled || hidden}
    >
      {art}
      {selected && !hidden && (
        <span className="liar-check" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  ) : (
    <span className="liar-card" role="img" aria-label={label}>
      {art}
    </span>
  );
}
export function Lives({ value, max }: { value: number; max: number }) {
  return (
    <span className="liar-lives" aria-label={`${value} trên ${max} mạng`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21 3 12C-3 3 8-2 12 6c4-8 15-3 9 6Z" fill="currentColor" />
      </svg>
      <b>{value}</b>
      <span>/ {max}</span>
    </span>
  );
}
export function Seat({
  player,
  max,
  seconds,
  position,
  animate,
}: {
  player: Player;
  max: number;
  seconds: number;
  position: string;
  animate: boolean;
}) {
  return (
    <article
      className={`liar-seat liar-seat-${position} ${player.isActing ? 'acting' : ''} ${player.eliminated ? 'out' : ''}`}
      aria-label={`Ghế ${player.displayName}`}
    >
      <span className="liar-avatar" aria-hidden="true">
        {Array.from(player.displayName)[0]?.toUpperCase()}
      </span>
      <div className="liar-seat-info">
        <strong title={player.displayName}>{player.displayName}</strong>
        <small>
          {player.isHost ? '♛ Chủ phòng · ' : ''}
          {!player.connected
            ? 'Mất kết nối'
            : player.eliminated
              ? 'Đã bị loại'
              : `${player.cardCount} lá bài`}
        </small>
        <span key={player.lives} className={animate ? 'liar-life-change' : ''}>
          <Lives value={player.lives} max={max} />
        </span>
      </div>
      {player.isActing && (
        <div className="liar-timer">
          <span>Đến lượt · {seconds}s</span>
          <progress aria-label={`Thời gian của ${player.displayName}`} value={seconds} max={180} />
        </div>
      )}
    </article>
  );
}
export function Result({ table, animate }: { table: LiarsTableSnapshot; animate: boolean }) {
  const result = table.result;
  if (!result) return null;
  const loser = table.players.find((p) => p.memberId === result.loserMemberId);
  const awaitingPenalty = table.transition?.kind === 'challenge-verdict';
  return (
    <section
      className={`liar-result ${animate ? 'liar-reveal-motion' : ''}`}
      aria-label="Kết quả vòng"
      role="status"
    >
      <small>
        {result.reason === 'challenge'
          ? result.wasLie
            ? 'BẮT ĐƯỢC LỜI NÓI DỐI'
            : 'LỜI TUYÊN BỐ ĐÚNG'
          : result.reason === 'timeout'
            ? 'HẾT THỜI GIAN'
            : 'BỎ CUỘC'}
      </small>
      <h2>
        {loser?.displayName ?? result.loserDisplayName ?? 'Người chơi'}{' '}
        {awaitingPenalty
          ? 'sẽ mất 1 mạng'
          : result.reason === 'forfeit'
            ? 'mất toàn bộ mạng còn lại'
            : 'mất 1 mạng'}
      </h2>
      {result.revealedCards && (
        <div className="liar-reveal">
          {result.revealedCards.map((card) => {
            const valid = card.rank === table.tableRank || card.rank === 'JOKER';
            return (
              <div key={card.id}>
                <Card rank={card.rank} />
                <small className={valid ? 'valid' : 'invalid'}>
                  {valid ? '✓ Hợp lệ' : '✕ Sai loại'}
                </small>
              </div>
            );
          })}
        </div>
      )}
      <p>
        {result.reason === 'challenge'
          ? result.wasLie
            ? 'Có bài không đúng loại. Người đánh chịu phạt.'
            : 'Tất cả bài đều hợp lệ. Người tố cáo chịu phạt.'
          : result.reason === 'timeout'
            ? 'Không hành động trước hạn.'
            : 'Người chơi đã rời trận.'}{' '}
        {!awaitingPenalty && loser
          ? loser.lives === 0
            ? 'Đã bị loại.'
            : `Còn ${loser.lives} mạng.`
          : ''}
      </p>
    </section>
  );
}
