import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './page';
import { type TableSnapshot, useTableStore } from '../features/table/store';
import type { useTableSession } from '../features/table/use-table-session';

const sessionMock = vi.hoisted(() => ({ value: {} as ReturnType<typeof useTableSession> }));
vi.mock('../features/table/use-table-session', () => ({
  useTableSession: () => sessionMock.value,
}));
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="scene" /> }));

function table(viewerMemberId = 'host'): TableSnapshot {
  return {
    gameType: 'poker',
    version: 1,
    roomCode: 'ABCD2345',
    phase: 'waiting',
    config: { smallBlind: 5, bigBlind: 10, ante: 0 },
    hostMemberId: 'host',
    viewerMemberId,
    board: [],
    pots: [],
    players: ['host', 'guest'].map((memberId, seat) => ({
      memberId,
      displayName: memberId === 'host' ? 'Chủ phòng' : 'Người chơi',
      seat,
      stack: 100,
      contribution: 0,
      connected: true,
      folded: false,
      allIn: false,
      sittingOut: false,
      isHost: memberId === 'host',
      isActing: false,
    })),
  };
}

beforeAll(() => {
  // jsdom lacks native dialogs; browser checks exercise the real modal behavior.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

describe('Poker experience', () => {
  it('uses a portrait wager sheet and locks it when disconnected', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('portrait'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      sessionMock.value.table = {
        ...table(),
        phase: 'running',
        handId: 'h',
        turnId: 't',
        legalActions: {
          actions: ['fold', 'check', 'bet', 'all-in'],
          callAmount: 0,
          minRaiseTo: 10,
          maxRaiseTo: 100,
        },
      };
      const { rerender } = render(<HomePage />);
      expect(screen.queryByLabelText('Mức cược')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cược 10' }));
      expect(screen.getByRole('dialog', { name: 'Cược / Tăng' })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Mức cược'), { target: { value: '20' } });
      sessionMock.value.connection = 'offline';
      rerender(<HomePage />);
      expect(screen.getByRole('button', { name: 'Xác nhận cược' })).toBeDisabled();
      sessionMock.value.connection = 'connected';
      sessionMock.value.table = { ...table(), phase: 'running', handId: 'h', turnId: 'next' };
      rerender(<HomePage />);
      expect(screen.getByRole('dialog', { name: 'Cược / Tăng' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Xác nhận cược' })).toBeDisabled();
      expect(screen.getByText('Lượt đã thay đổi. Đóng bảng để trở lại bàn.')).toBeInTheDocument();
      expect(sessionMock.value.send).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  beforeEach(() => {
    useTableStore.getState().clear();
    sessionMock.value = {
      chat: {
        messages: [],
        pending: false,
        error: '',
        unread: 0,
        bind: vi.fn(),
        markOpen: vi.fn(),
        send: vi.fn(),
      },
      table: undefined,
      invite: undefined,
      loading: false,
      connection: 'connected',
      pending: false,
      message: '',
      animate: false,
      restore: vi.fn(),
      submitRoom: vi.fn().mockResolvedValue(undefined),
      send: vi.fn(),
    };
  });

  it('shows restoration before choosing the entry screen or table', () => {
    sessionMock.value.loading = true;
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Đang khôi phục bàn…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vào phòng' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
  });

  it('offers Vietnamese join/create forms and validates blinds', () => {
    render(<HomePage />);
    expect(screen.getByRole('button', { name: 'Vào bàn →' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng' }));
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'An' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Big blind/ }), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng →' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Big blind phải lớn hơn Small blind');
    expect(sessionMock.value.submitRoom).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('spinbutton', { name: /Big blind/ }), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng →' }));
    expect(sessionMock.value.submitRoom).toHaveBeenCalledWith('/rooms', {
      displayName: 'An',
      gameType: 'poker',
      smallBlind: 5,
      bigBlind: 10,
      ante: 0,
    });
  });

  it('shows host start and management only between hands', () => {
    sessionMock.value.table = table();
    const { rerender } = render(<HomePage />);
    expect(screen.getByRole('button', { name: 'Bắt đầu ván' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý' }));
    expect(screen.getByRole('button', { name: 'Cấp chip cho tôi' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đóng phòng' })).toBeEnabled();
    sessionMock.value.table = { ...table(), phase: 'running' };
    rerender(<HomePage />);
    for (const name of ['Bắt đầu ván', 'Cấp chip cho tôi', 'Đóng phòng', 'Rời bàn'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(
      screen.getByText('Chỉ quản lý bàn và rời bàn sau khi ván kết thúc.'),
    ).toBeInTheDocument();
  });

  it('tells guests to wait and does not offer host controls', () => {
    sessionMock.value.table = table('guest');
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Đang chờ chủ phòng bắt đầu' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bắt đầu ván' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thông tin' }));
    expect(screen.getByRole('button', { name: 'Rời bàn' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Cấp chip/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đóng phòng' })).not.toBeInTheDocument();
  });

  it('keeps private card labels and hand information absent until revealed', () => {
    const snapshot = table();
    snapshot.players[0].holeCards = ['AS', 'AH'];
    snapshot.handInfo = { name: 'Một đôi Át', cards: ['AS', 'AH', 'KD', 'QH', 'TC'] };
    sessionMock.value.table = snapshot;
    render(<HomePage />);
    expect(screen.queryByLabelText('AS')).not.toBeInTheDocument();
    expect(screen.queryByText('Một đôi Át')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem bài riêng' }));
    expect(screen.getAllByLabelText('AS')).toHaveLength(2);
    expect(screen.getByText('Lá tạo bộ: Át bích, Át cơ')).toBeInTheDocument();
    expect(screen.getByText('Một đôi Át')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Che bài riêng' }));
    expect(screen.queryByLabelText('AS')).not.toBeInTheDocument();
    expect(screen.queryByText('Một đôi Át')).not.toBeInTheDocument();
  });

  it('enforces raise bounds and requires all-in confirmation', () => {
    sessionMock.value.table = {
      ...table(),
      phase: 'running',
      handId: 'h1',
      turnId: 't1',
      legalActions: {
        actions: ['fold', 'call', 'raise', 'all-in'],
        callAmount: 5,
        minRaiseTo: 20,
        maxRaiseTo: 100,
      },
    };
    render(<HomePage />);
    expect(screen.getByRole('button', { name: 'Theo 5' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Check — không thêm chip' }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Mức cược' }), {
      target: { value: '19' },
    });
    expect(screen.getByRole('button', { name: 'Tăng lên 19' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Mức cược' }), {
      target: { value: '101' },
    });
    expect(screen.getByRole('button', { name: 'Tăng lên 101' })).toBeDisabled();
    fireEvent.change(screen.getByRole('slider', { name: 'Thanh mức cược' }), {
      target: { value: '40' },
    });
    expect(screen.getByRole('spinbutton', { name: 'Mức cược' })).toHaveValue(40);
    fireEvent.click(screen.getByRole('button', { name: 'Tăng lên 40' }));
    expect(sessionMock.value.send).toHaveBeenCalledWith('game:action', {
      handId: 'h1',
      turnId: 't1',
      action: 'raise',
      amount: 40,
    });
    vi.mocked(sessionMock.value.send).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Tất tay' }));
    expect(sessionMock.value.send).not.toHaveBeenCalled();
    const confirmation = screen.getByRole('dialog', { name: 'Xác nhận thao tác' });
    expect(within(confirmation).getByText('Tất tay 100 chip còn lại?')).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Xác nhận' }));
    expect(sessionMock.value.send).toHaveBeenCalledWith('game:action', {
      handId: 'h1',
      turnId: 't1',
      action: 'all-in',
    });
  });

  it('disables betting offline or while awaiting acknowledgement', () => {
    sessionMock.value.table = {
      ...table(),
      phase: 'running',
      legalActions: { actions: ['check', 'fold'], callAmount: 0 },
    };
    sessionMock.value.connection = 'offline';
    const { rerender } = render(<HomePage />);
    expect(screen.getByRole('button', { name: 'Check — không thêm chip' })).toBeDisabled();
    sessionMock.value.connection = 'connected';
    sessionMock.value.pending = true;
    rerender(<HomePage />);
    expect(screen.getByRole('button', { name: 'Bỏ bài' })).toBeDisabled();
  });

  it('conceals the invitation password until requested and again after closing', () => {
    sessionMock.value.table = table();
    sessionMock.value.invite = { roomCode: 'ABCD2345', password: 'secret-invite' };
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Lời mời' }));
    expect(screen.queryByText('secret-invite')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByText('secret-invite')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lời mời' }));
    expect(screen.queryByText('secret-invite')).not.toBeInTheDocument();
  });
});
