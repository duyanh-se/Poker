import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
      data-concealed={hidden}
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
    <span className="liar-card" data-concealed={hidden} role="img" aria-label={label}>
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
function HandShape({ side }: { side: 'left' | 'right' }) {
  return (
    <g data-hand={side}>
      <path
        d={
          side === 'left'
            ? 'M0 55V31L42 9q10-5 15 4l12 23-12 19'
            : 'M220 55V31L178 9q-10-5-15 4l-12 23 12 19'
        }
        fill="#9d7155"
        stroke="#d5a67b"
        strokeWidth="2"
      />
      <path
        d={side === 'left' ? 'm40 55 9-26q3-9 9-5t1 15l-2 16' : 'm180 55-9-26q-3-9-9-5t-1 15l2 16'}
        fill="#bc8b65"
      />
    </g>
  );
}
export function HoldingHands() {
  return (
    <svg className="liar-holding-hands" viewBox="0 0 220 55" aria-hidden="true">
      <HandShape side="left" />
      <HandShape side="right" />
    </svg>
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
        <details className="liar-player-details">
          <summary title={player.displayName}>{player.displayName}</summary>
          <p>
            {player.displayName} · {player.lives} mạng · {player.cardCount} lá
          </p>
        </details>
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
      {player.cardCount > 0 && !player.eliminated && (
        <div className="liar-opponent-hand" aria-label={`${player.cardCount} lá bài úp`}>
          <div className="liar-held-backs" aria-hidden="true">
            {Array.from({ length: player.cardCount }, (_, i) => (
              <Card key={i} hidden />
            ))}
          </div>
          <HoldingHands />
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

export function TabletopCards({ table, source }: { table: LiarsTableSnapshot; source: string }) {
  const pileRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<CSSProperties>({});
  const cards = table.result?.revealedCards ?? table.challengeReveal?.cards;
  const count = cards?.length ?? table.lastPlay?.count ?? 0;
  useEffect(() => {
    const pile = pileRef.current;
    const stage = pile?.closest('.liar-stage');
    if (!pile || !stage || typeof ResizeObserver === 'undefined') return;
    const seat = stage.querySelector(
      source === 'self'
        ? '.liar-viewer-seat .liar-fan'
        : `.liar-seat-${source} .liar-opponent-hand`,
    );
    if (!seat) return;
    const measure = () => {
      const from = seat.getBoundingClientRect();
      const to = pile.getBoundingClientRect();
      setFlight({
        '--play-x': `${from.left + from.width / 2 - to.left - to.width / 2}px`,
        '--play-y': `${from.top + from.height / 2 - to.top - to.height / 2}px`,
      } as CSSProperties);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(seat);
    measure();
    return () => observer.disconnect();
  }, [source, count]);
  if (!count) return null;
  return (
    <div
      ref={pileRef}
      style={flight}
      className="liar-physical-pile"
      data-source={source}
      aria-label="Bài trên bàn"
    >
      {Array.from({ length: count }, (_, i) => {
        const card = cards?.[i];
        const valid = card?.rank === table.tableRank || card?.rank === 'JOKER';
        return (
          <div
            className="liar-table-leaf"
            key={`${table.roundId}:${i}`}
            style={{ '--leaf-index': i } as CSSProperties}
          >
            <Card rank={card?.rank} hidden={!card} />
            {card && table.result && (
              <small className={valid ? 'valid' : 'invalid'}>
                {valid ? '✓ Hợp lệ' : '✕ Sai loại'}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PenaltyShot({
  position,
  shooterPosition = position,
  name,
  motion,
  active = true,
}: {
  position: string;
  shooterPosition?: string;
  name: string;
  motion: boolean;
  active?: boolean;
}) {
  const gunRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1);
  const [handAnchor, setHandAnchor] = useState<[number, number] | null>(null);
  const [targetAnchor, setTargetAnchor] = useState<[number, number] | null>(null);
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const stage = gunRef.current?.parentElement;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setAspect(rect.width / rect.height);
      setStageSize({ width: rect.width, height: rect.height });
      const targetSeat = stage.querySelector(
        position === 'self' ? '.liar-viewer-seat' : `.liar-seat-${position}`,
      );
      const target = targetSeat?.querySelector('.liar-lives')?.getBoundingClientRect();
      setTargetAnchor(
        target
          ? [
              ((target.left + target.width / 2 - rect.left) / rect.width) * 100,
              ((target.top + target.height / 2 - rect.top) / rect.height) * 100,
            ]
          : null,
      );
      const seat =
        shooterPosition === 'self' ? '.liar-viewer-seat' : `.liar-seat-${shooterPosition}`;
      const hand = stage
        .querySelector(`${seat} .liar-holding-hands [data-hand="right"]`)
        ?.getBoundingClientRect();
      setHandAnchor(
        hand
          ? [
              ((hand.left + hand.width * 0.35 - rect.left) / rect.width) * 100,
              ((hand.top + hand.height * 0.55 - rect.top) / rect.height) * 100,
            ]
          : null,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    stage.querySelectorAll('.liar-seat, .liar-viewer-seat').forEach((el) => observer.observe(el));
    measure();
    return () => observer.disconnect();
  }, [shooterPosition, position, active]);
  const anchors: Record<string, [number, number]> = {
    self: [50, 70],
    top: [50, 22],
    left: [20, 43],
    right: [80, 43],
    'upper-left': [27, 25],
    'upper-right': [73, 25],
  };
  let [x, y] = handAnchor ?? anchors[shooterPosition] ?? anchors.self;
  const [targetX, targetY] = targetAnchor ?? anchors[position] ?? anchors.self;
  const selfPenalty = position === shooterPosition;
  const [seatX, seatY] = anchors[shooterPosition] ?? anchors.self;
  const outwardAngle = (Math.atan2(seatY - 45, (seatX - 50) * aspect) * 180) / Math.PI + 90;
  if (selfPenalty && targetAnchor) {
    // Bring the hand inward first, then aim back out toward its owner. The life
    // label can be above the hand in the UI; it must not determine seat facing.
    const outward = (outwardAngle * Math.PI) / 180;
    x = targetX - ((Math.sin(outward) * 200) / stageSize.width) * 100;
    y = targetY + ((Math.cos(outward) * 200) / stageSize.height) * 100;
  }
  // The top-down barrel points up; rotate around the palm, using actual table dimensions.
  const holdAngle = (Math.atan2(45 - y, (50 - x) * aspect) * 180) / Math.PI + 90;
  const rawAim = selfPenalty
    ? outwardAngle
    : (Math.atan2(targetY - y, (targetX - x) * aspect) * 180) / Math.PI + 90;
  const angle = holdAngle + ((((rawAim - holdAngle) % 360) + 540) % 360) - 180;
  const radians = (angle * Math.PI) / 180;
  // SVG palm is at y=177.6, muzzle at y=22; CSS renders at .8 scale, raised by 1.06.
  const barrelLength = (177.6 - 22) * 0.8 * 1.06;
  const muzzleX = (x * stageSize.width) / 100 + Math.sin(radians) * barrelLength;
  const muzzleY = (y * stageSize.height) / 100 - Math.cos(radians) * barrelLength;
  const impactX = (targetX * stageSize.width) / 100;
  const impactY = (targetY * stageSize.height) / 100;
  return (
    <>
      <div
        ref={gunRef}
        className={`liar-table-gun ${active ? `liar-penalty liar-penalty-${position}` : ''}`}
        data-fire={motion && active}
        data-shooter={shooterPosition}
        data-target={position}
        data-self-penalty={selfPenalty}
        style={
          {
            '--pickup-x': `${x}%`,
            '--pickup-y': `${y}%`,
            '--aim-angle': `${angle}deg`,
            '--hold-angle': `${holdAngle}deg`,
          } as CSSProperties
        }
        role={active ? 'status' : 'img'}
        aria-label={active ? `${name} mất 1 mạng` : 'Súng trên bàn'}
      >
        <svg
          className={`liar-table-gun-art ${motion && active ? 'liar-shot-art' : ''}`}
          viewBox="0 0 120 240"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="liar-steel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f8fafb" />
              <stop offset=".18" stopColor="#858e96" />
              <stop offset=".35" stopColor="#171e24" />
              <stop offset=".55" stopColor="#f3f7f8" />
              <stop offset=".7" stopColor="#697780" />
              <stop offset="1" stopColor="#151c23" />
            </linearGradient>
            <linearGradient id="liar-walnut">
              <stop stopColor="#311a16" />
              <stop offset=".5" stopColor="#a65a36" />
              <stop offset="1" stopColor="#42221c" />
            </linearGradient>
          </defs>
          <g className="liar-resting-profile">
            <g
              transform="translate(60 178) rotate(-80) scale(.85) translate(-40 -85)"
              stroke="#9da7ae"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <path
                d="M32 53 24 35 30 30 46 43 69 38 88 29H208v24H103l-15 21-28 8-16 15-24-13Z"
                fill="url(#liar-steel)"
              />
              <path d="M100 29h108v7H99M111 48h97M198 28v-6h8v6" fill="none" />
              <rect x="55" y="38" width="48" height="36" rx="8" fill="url(#liar-steel)" />
              <path d="M64 44v24m13-24v24m13-24v24" stroke="#374047" strokeWidth="4" />
              <path
                d="M59 77c35-13 43 23 20 30-15 4-28-4-27-16m17-14q-5 14 6 16"
                fill="none"
                strokeWidth="4"
              />
              <path d="M23 78q24-12 34 6l-9 20 8 23q-24 7-42-7l10-24Z" fill="url(#liar-walnut)" />
              <path d="m25 89 17 9-11 18m-10-9 23 12" fill="none" stroke="#542e21" />
              <circle cx="38" cy="87" r="4" fill="#bd9c60" />
              <circle cx="32" cy="116" r="2" fill="#bd9c60" />
            </g>
          </g>
          <g className="liar-held-profile">
            <g className="liar-gun" stroke="#bdc6cd" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M48 134q12-8 24 0l10 63q-21 14-43 0Z" fill="url(#liar-walnut)" />
              <path d="m48 154 23 33m-23-18 18 26m-13-44 19 25" stroke="#512d21" />
              <circle cx="60" cy="189" r="4" fill="#c6a365" />
              <path d="M48 24h24v70l10 12v27l-12 15H50l-12-15v-27l10-12Z" fill="url(#liar-steel)" />
              <rect x="38" y="94" width="44" height="39" rx="10" fill="url(#liar-steel)" />
              <path d="M43 101v24m34-24v24" stroke="#303b43" strokeWidth="4" />
              <path d="M56 28h8v110h-8Z" fill="#313c44" />
              <path d="M58 30v101" stroke="#f9ffff" />
              <path d="M57 22h6v9h-6Zm-1 116h8l3 13H53Z" fill="#87939c" />
              <g className="liar-gun-hand">
                <g transform="translate(-116 145)">
                  <HandShape side="right" />
                </g>
              </g>
            </g>
            <path className="liar-muzzle" d="m60 22-10-10 7 1 3-13 4 13 7-1Z" fill="#ffe2a1" />
          </g>
        </svg>
      </div>
      {active && motion && (
        <div
          className="liar-bullet-flight"
          aria-hidden="true"
          style={
            {
              '--bullet-start-x': `${muzzleX}px`,
              '--bullet-start-y': `${muzzleY}px`,
              '--bullet-end-x': `${impactX}px`,
              '--bullet-end-y': `${impactY}px`,
            } as CSSProperties
          }
        >
          <svg
            viewBox="0 0 12 32"
            style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
          >
            <defs>
              <linearGradient id="liar-bullet-gold">
                <stop stopColor="#6e3817" />
                <stop offset=".45" stopColor="#ffe8a0" />
                <stop offset="1" stopColor="#a96823" />
              </linearGradient>
            </defs>
            <path
              d="M6 1Q2 7 2 13v16h8V13Q10 7 6 1Z"
              fill="url(#liar-bullet-gold)"
              stroke="#fff0bf"
              strokeWidth=".7"
            />
            <path d="M2 13h8M2 26h8" stroke="#9b602a" />
          </svg>
        </div>
      )}
      {active && (
        <strong
          className="liar-minus-life"
          data-animated={motion}
          style={{
            position: 'absolute',
            left: `${targetX}%`,
            top: `${targetY}%`,
            transform: 'translate(-50%, 15px)',
            zIndex: 12,
            pointerEvents: 'none',
          }}
        >
          −1 ♥ mạng
        </strong>
      )}
    </>
  );
}
