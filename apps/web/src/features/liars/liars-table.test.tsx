import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { LiarsTableSnapshot } from '../../../../../packages/contracts/src';
import { LiarsTable } from './liars-table';
import { PenaltyShot } from './liars-pieces';

const props = {
  hidden: false,
  setHidden: vi.fn(),
  pending: false,
  connection: 'connected',
  send: vi.fn(),
  message: '',
  restore: vi.fn(),
};
describe('upgraded Liars interactions', () => {
  it.each([
    ['self', 0, 1],
    ['top', 0, -1],
    ['left', -1, 0],
    ['right', 1, 0],
    ['upper-left', -1, -1],
    ['upper-right', 1, -1],
  ])('points self-penalty outward toward the owner at %s', (seat, dx, dy) => {
    const { container } = render(
      <PenaltyShot position={String(seat)} shooterPosition={String(seat)} name="Test" motion />,
    );
    const degrees = parseFloat(
      container
        .querySelector<HTMLElement>('.liar-table-gun')!
        .style.getPropertyValue('--aim-angle'),
    );
    const radians = (degrees * Math.PI) / 180;
    if (dx) expect(Math.sign(Math.sin(radians))).toBe(dx);
    if (dy) expect(Math.sign(-Math.cos(radians))).toBe(dy);
  });
  it.each([
    ['self', 'top', 0],
    ['top', 'self', 180],
    ['left', 'right', 90],
    ['right', 'left', 270],
  ])('aims the upright barrel from %s toward %s', (shooter, target, angle) => {
    const { container } = render(
      <PenaltyShot
        position={String(target)}
        shooterPosition={String(shooter)}
        name="Test"
        motion
      />,
    );
    const gun = container.querySelector<HTMLElement>('.liar-table-gun');
    expect(parseFloat(gun?.style.getPropertyValue('--aim-angle') ?? '')).toBeCloseTo(Number(angle));
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 120 240');
  });
  it.each([
    ['challenge', true, 'guest', 'host', 'self', 'top', 'false'],
    ['challenge', false, 'host', 'host', 'self', 'self', 'true'],
    ['timeout', undefined, 'guest', undefined, 'top', 'top', 'true'],
  ] as const)(
    'maps pickup and target for %s (lie=%s)',
    (reason, wasLie, loserMemberId, challengerMemberId, shooter, target, selfPenalty) => {
      const table = snapshot();
      table.result = { reason, wasLie, loserMemberId, challengerMemberId };
      table.transition = {
        id: 'shot',
        kind: reason === 'timeout' ? 'timeout' : 'life-loss',
        startedAt: Date.now(),
        endsAt: Date.now() + 2400,
      };
      const { container } = render(<LiarsTable {...props} table={table} />);
      const gun = container.querySelector('.liar-table-gun');
      expect(gun).toHaveAttribute('data-shooter', shooter);
      expect(gun).toHaveAttribute('data-target', target);
      expect(gun).toHaveAttribute('data-self-penalty', selfPenalty);
      expect(container.querySelectorAll('.liar-table-gun-art')).toHaveLength(1);
    },
  );
  it('keeps one tabletop gun mounted between idle and penalty states', () => {
    const table = snapshot();
    const { container, rerender } = render(<LiarsTable {...props} table={table} />);
    const gun = container.querySelector('.liar-table-gun-art');
    expect(screen.getByLabelText('Súng trên bàn')).toBeInTheDocument();
    expect(container.querySelector('.liar-shot-art')).toBeNull();
    table.result = { reason: 'challenge', loserMemberId: 'guest', wasLie: true };
    table.transition = {
      id: 'slow-loss',
      kind: 'life-loss',
      startedAt: Date.now(),
      endsAt: Date.now() + 2400,
    };
    rerender(<LiarsTable {...props} table={table} />);
    expect(container.querySelector('.liar-table-gun-art')).toBe(gun);
    expect(container.querySelectorAll('.liar-table-gun')).toHaveLength(1);
  });
  it('does not remount the shot when the same penalty snapshot is received again', async () => {
    const table = snapshot();
    table.serverTime = Date.now();
    table.result = { reason: 'timeout', loserMemberId: 'host' };
    table.players[0].lives = 2;
    table.transition = {
      id: 'timeout-shot',
      kind: 'timeout',
      startedAt: table.serverTime,
      endsAt: table.serverTime + 1200,
    };
    const { container, rerender } = render(<LiarsTable {...props} table={table} animate />);
    await waitFor(() =>
      expect(container.querySelector('.liar-penalty-self .liar-shot-art')).not.toBeNull(),
    );
    const shot = container.querySelector('.liar-shot-art');
    rerender(<LiarsTable {...props} table={{ ...table, version: 2 }} animate />);
    expect(container.querySelector('.liar-shot-art')).toBe(shot);
    expect(container.querySelectorAll('.liar-minus-life')).toHaveLength(1);
  });
  it('flips the same three tabletop leaves and removes private faces when concealed', () => {
    const table = snapshot();
    table.lastPlay = { memberId: 'guest', count: 3 };
    const { container, rerender } = render(<LiarsTable {...props} table={table} />);
    const leaves = Array.from(container.querySelectorAll('.liar-table-leaf'));
    expect(leaves).toHaveLength(3);
    table.challengeReveal = {
      cards: ['A', 'K', 'Q'].map((rank, i) => ({ id: `public-${i}`, rank: rank as 'A' })),
    };
    rerender(<LiarsTable {...props} table={table} hidden />);
    expect(Array.from(container.querySelectorAll('.liar-table-leaf'))).toEqual(leaves);
    expect(container.querySelector('.liar-viewer-seat [aria-label="Lá A"]')).toBeNull();
    expect(container.querySelector('.liar-opponent-hand [aria-label="Lá A"]')).toBeNull();
    expect(container.querySelectorAll('.liar-physical-pile [data-concealed="false"]')).toHaveLength(
      3,
    );
  });

  it('targets a single-life penalty at its loser and suppresses gunfire on restoration', () => {
    const table = snapshot();
    table.result = { reason: 'challenge', loserMemberId: 'guest', wasLie: true };
    table.transition = {
      id: 'loss',
      kind: 'life-loss',
      startedAt: Date.now(),
      endsAt: Date.now() + 600,
    };
    const { container, rerender } = render(<LiarsTable {...props} table={table} animate={false} />);
    expect(container.querySelectorAll('.liar-penalty-top')).toHaveLength(1);
    expect(container.querySelector('.liar-shot-art')).toBeNull();
    table.result = { reason: 'forfeit', loserMemberId: 'guest' };
    rerender(<LiarsTable {...props} table={table} />);
    expect(container.querySelector('.liar-penalty')).toBeNull();
  });
  it('locks a stale legal action and host start during a server transition', () => {
    const table = snapshot();
    table.transition = { id: 'deal-1', kind: 'deal', startedAt: 1000, endsAt: 2800 };
    const { rerender } = render(<LiarsTable {...props} table={table} />);
    expect(screen.getByText('Đang chia bài…')).toBeInTheDocument();
    expect(screen.getByLabelText('Lá A')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Đánh úp/ })).not.toBeInTheDocument();
    rerender(<LiarsTable {...props} table={{ ...table, phase: 'waiting' }} />);
    expect(screen.queryByRole('button', { name: /Bắt đầu vòng/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý' }));
    expect(screen.queryByRole('button', { name: 'Đóng phòng' })).not.toBeInTheDocument();
  });
  it('reveals only public challenge cards and postpones lost-life wording until settlement', () => {
    const table = snapshot();
    table.transition = { id: 'reveal', kind: 'challenge-reveal', startedAt: 1000, endsAt: 1750 };
    table.challengeReveal = { cards: [{ id: 'public', rank: 'JOKER' }] };
    const { rerender } = render(<LiarsTable {...props} hidden table={table} />);
    expect(screen.getByLabelText('Lá JOKER')).toBeInTheDocument();
    expect(screen.queryByLabelText('Lá A')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Kết quả vòng')).not.toBeInTheDocument();
    table.transition = { ...table.transition, id: 'verdict', kind: 'challenge-verdict' };
    table.result = { reason: 'challenge', loserMemberId: 'host', wasLie: false };
    rerender(<LiarsTable {...props} hidden table={table} />);
    expect(screen.getByText('Chủ phòng sẽ mất 1 mạng')).toBeInTheDocument();
    expect(screen.queryByText(/Còn 3 mạng/)).not.toBeInTheDocument();
    table.transition = { ...table.transition, id: 'penalty', kind: 'life-loss' };
    table.players[0].lives = 2;
    rerender(<LiarsTable {...props} hidden table={table} />);
    expect(screen.getByText('Chủ phòng mất 1 mạng')).toBeInTheDocument();
    expect(screen.getByText(/Còn 2 mạng/)).toBeInTheDocument();
  });
  it('caps selection, clears on turn change and keeps an open help panel', () => {
    const table = snapshot();
    table.players[0].cards = ['A', 'K', 'Q', 'JOKER'].map((rank, i) => ({
      id: String(i),
      rank: rank as 'A',
    }));
    const { rerender } = render(<LiarsTable {...props} table={table} />);
    for (const rank of ['A', 'K', 'Q', 'JOKER'])
      fireEvent.click(screen.getByLabelText(`Lá ${rank}`));
    expect(screen.getByText('Đã chọn 3/3 lá')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Luật chơi' }));
    rerender(<LiarsTable {...props} table={{ ...table, turnId: 'next' }} />);
    expect(screen.getByRole('dialog', { name: 'Cách chơi Bài nói dối' })).toBeInTheDocument();
    expect(screen.getByText('Đã chọn 0/3 lá')).toBeInTheDocument();
  });
  it('masks invitation on every open and confirms management without stale authority', () => {
    const send = vi.fn();
    const table = { ...snapshot(), phase: 'waiting' as const };
    const { rerender } = render(
      <LiarsTable
        {...props}
        send={send}
        table={table}
        invite={{ roomCode: table.roomCode, password: 'secret-test' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lời mời' }));
    expect(screen.queryByText('secret-test')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByText('secret-test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lời mời' }));
    expect(screen.queryByText('secret-test')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng phòng' }));
    expect(send).not.toHaveBeenCalled();
    rerender(<LiarsTable {...props} send={send} table={table} connection="offline" />);
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
  });
  it('labels invalid public cards, Joker and forfeit distinctly', () => {
    const table = snapshot();
    table.phase = 'waiting';
    table.result = {
      reason: 'challenge',
      loserMemberId: 'guest',
      wasLie: true,
      revealedCards: [
        { id: 'x', rank: 'K' },
        { id: 'j', rank: 'JOKER' },
      ],
    };
    const { rerender } = render(<LiarsTable {...props} hidden table={table} />);
    expect(screen.getByText('✕ Sai loại')).toBeInTheDocument();
    expect(screen.getByText('✓ Hợp lệ')).toBeInTheDocument();
    expect(screen.getByLabelText('Lá JOKER')).toBeInTheDocument();
    table.result = {
      reason: 'forfeit',
      loserMemberId: 'departed',
      loserDisplayName: 'Người đã rời',
    };
    rerender(<LiarsTable {...props} hidden table={table} />);
    expect(screen.getByText('Người đã rời mất toàn bộ mạng còn lại')).toBeInTheDocument();
    expect(screen.queryByText(/mất 1 mạng/)).not.toBeInTheDocument();
  });
  it('explains forced challenge and disables pending actions', () => {
    const table = snapshot();
    table.legalActions = { canPlay: false, canChallenge: true, mustChallenge: true };
    render(<LiarsTable {...props} pending table={table} />);
    expect(
      screen.getByText('Chỉ bạn còn bài. Hãy kiểm tra lượt đánh vừa rồi.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NÓI DỐI!' })).toBeDisabled();
    expect(screen.getByText('Đang xác nhận…')).toBeInTheDocument();
  });
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

function snapshot(): LiarsTableSnapshot {
  return {
    gameType: 'liars-deck',
    version: 1,
    roomCode: 'LIAR1234',
    phase: 'running',
    config: { startingLives: 3 },
    viewerMemberId: 'host',
    hostMemberId: 'host',
    matchId: 'match',
    roundId: 'round',
    turnId: 'turn',
    matchStatus: 'active',
    roundNumber: 1,
    tableRank: 'A',
    actingMemberId: 'host',
    deadlineAt: Date.now() + 180_000,
    players: [
      {
        memberId: 'host',
        displayName: 'Chủ phòng',
        seat: 0,
        connected: true,
        isHost: true,
        isActing: true,
        lives: 3,
        cardCount: 2,
        eliminated: false,
        cards: [
          { id: 'a', rank: 'A' },
          { id: 'k', rank: 'K' },
        ],
      },
      {
        memberId: 'guest',
        displayName: 'Khách',
        seat: 1,
        connected: true,
        isHost: false,
        isActing: false,
        lives: 3,
        cardCount: 2,
        eliminated: false,
      },
    ],
    legalActions: { canPlay: true, canChallenge: false, mustChallenge: false },
  };
}

describe('LiarsTable', () => {
  it('conceals private card values until the viewer chooses to reveal them', () => {
    const setHidden = vi.fn();
    render(
      <LiarsTable
        table={snapshot()}
        hidden
        setHidden={setHidden}
        pending={false}
        connection="connected"
        send={vi.fn()}
        message=""
        restore={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Lá A')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem bài' }));
    expect(setHidden).toHaveBeenCalledWith(false);
  });

  it('sends only the selected owner card IDs with the current turn identifiers', () => {
    const send = vi.fn();
    render(
      <LiarsTable
        table={snapshot()}
        hidden={false}
        setHidden={vi.fn()}
        pending={false}
        connection="connected"
        send={send}
        message=""
        restore={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Lá A'));
    fireEvent.click(screen.getByRole('button', { name: 'Đánh úp 1 lá — tuyên bố Át' }));
    expect(send).toHaveBeenCalledWith('liars:play', {
      matchId: 'match',
      roundId: 'round',
      turnId: 'turn',
      cardIds: ['a'],
    });
  });
});
