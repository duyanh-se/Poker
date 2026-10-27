import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { WhiteHatSnapshot } from '../../../../../packages/contracts/src';
import { WhiteHatTable } from './white-hat-table';
import { Victory } from './white-hat-pieces';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
function snapshot(): WhiteHatSnapshot {
  return {
    gameType: 'white-hat',
    version: 1,
    serverTime: Date.now(),
    roomCode: 'ABCDEFGH',
    phase: 'running',
    stage: 'description',
    config: { eliminationsPerRound: 1, roleMode: 'auto', spyCount: 1, whiteCount: 1 },
    viewerMemberId: 'a',
    hostMemberId: 'host',
    matchStatus: 'active',
    matchId: 'match',
    roundId: 'round',
    turnId: 'turn',
    roundNumber: 1,
    actingMemberId: 'a',
    players: ['host', 'a', 'b', 'c', 'd'].map((id, i) => ({
      memberId: id,
      displayName: `Name ${id}`,
      seat: i,
      connected: true,
      isHost: id === 'host',
      isModerator: id === 'host',
      eliminated: false,
      departed: false,
    })),
    privateWord: 'Cà phê',
    descriptions: [],
    guesses: [],
    ballotResults: [],
    submittedMemberIds: [],
    candidateIds: [],
    ballotSize: 0,
    selectedIds: [],
    lastEliminatedIds: [],
    legalActions: { canDescribe: true, canVote: false, canGuess: false, canChat: true },
  };
}
function props(table = snapshot()) {
  return {
    table,
    hidden: true,
    setHidden: vi.fn(),
    pending: false,
    connection: 'connected' as const,
    send: vi.fn(),
    message: '',
    restore: vi.fn().mockResolvedValue(undefined),
  };
}
describe('Mũ Trắng controls', () => {
  it('clears a local candidate selection when the server advances to a new ballot', () => {
    const table = snapshot();
    table.stage = 'voting';
    table.candidateIds = ['a', 'b', 'c', 'd'];
    table.ballotSize = 1;
    table.legalActions = { canDescribe: false, canVote: true, canGuess: false, canChat: true };
    const p = props(table);
    const view = render(<WhiteHatTable {...p} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Name b' }));
    expect(screen.getByRole('button', { name: 'Gửi phiếu' })).toBeEnabled();
    view.rerender(
      <WhiteHatTable
        {...p}
        table={{ ...table, stage: 'revote', turnId: 'runoff', candidateIds: ['b', 'c'] }}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Name b' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Gửi phiếu' })).toBeDisabled();
  });
  it('keeps identity artwork unchanged when private word and guess permissions change', () => {
    const table = snapshot();
    const p = props(table);
    const view = render(<WhiteHatTable {...p} />);
    const identities = () =>
      [...view.container.querySelectorAll('.wh-player .wh-avatar')].map((node) =>
        node.getAttribute('data-avatar'),
      );
    const before = identities();
    view.rerender(
      <WhiteHatTable
        {...p}
        table={{
          ...table,
          stage: 'discussion',
          privateWord: null,
          legalActions: { ...table.legalActions, canDescribe: false, canGuess: true },
        }}
      />,
    );
    expect(identities()).toEqual(before);
    expect(new Set(before).size).toBe(4);
  });
  it('does not replay a restored victory when another live snapshot arrives', () => {
    const table = snapshot();
    table.result = {
      winner: 'civilian',
      winnerMemberIds: ['c', 'd'],
      civilianWord: 'Cà phê',
      spyWord: 'Trà',
    };
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    try {
      const view = render(<Victory table={table} animate={false} />);
      expect(screen.getByRole('status', { name: 'Kết quả ván' })).not.toHaveClass('wh-celebrate');
      view.rerender(<Victory table={{ ...table, version: 2 }} animate />);
      expect(screen.getByRole('status', { name: 'Kết quả ván' })).not.toHaveClass('wh-celebrate');
      view.rerender(<Victory table={{ ...table, matchId: 'another-match' }} animate />);
      expect(screen.getByRole('status', { name: 'Kết quả ván' })).toHaveClass('wh-celebrate');
    } finally {
      visibility.mockRestore();
    }
  });
  it('conceals the word from DOM/accessibility and never labels player roles', () => {
    const p = props();
    const view = render(<WhiteHatTable {...p} />);
    expect(screen.queryByText('Cà phê', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Gián điệp', { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem từ riêng' }));
    expect(p.setHidden).toHaveBeenCalledWith(false);
    view.rerender(<WhiteHatTable {...p} hidden={false} />);
    expect(screen.getByText('Cà phê', { exact: true })).toBeVisible();
    view.rerender(<WhiteHatTable {...p} hidden={false} connection="offline" />);
    expect(screen.queryByText('Cà phê', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi mô tả' })).toBeDisabled();
  });
  it('sends a description with the current generation', () => {
    const p = props();
    render(<WhiteHatTable {...p} />);
    fireEvent.change(screen.getByLabelText('Mô tả của bạn'), { target: { value: 'Buổi sáng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mô tả' }));
    expect(p.send).toHaveBeenCalledWith('white-hat:describe', {
      matchId: 'match',
      roundId: 'round',
      turnId: 'turn',
      text: 'Buổi sáng',
    });
  });
  it('requires exactly K choices and excludes self from the ballot', () => {
    const table = snapshot();
    table.stage = 'voting';
    table.candidateIds = ['a', 'b', 'c', 'd'];
    table.ballotSize = 2;
    table.legalActions = { canDescribe: false, canVote: true, canGuess: false, canChat: true };
    const p = props(table);
    render(<WhiteHatTable {...p} />);
    expect(screen.queryByRole('checkbox', { name: 'Name a' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi phiếu' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Name b' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Name c' }));
    expect(screen.getByRole('checkbox', { name: 'Name d' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phiếu' }));
    expect(p.send).toHaveBeenCalledWith('white-hat:vote', {
      matchId: 'match',
      roundId: 'round',
      turnId: 'turn',
      targetIds: ['b', 'c'],
    });
  });
  it('requires confirmation for the one irreversible guess and closes on a new phase', () => {
    const table = snapshot();
    table.stage = 'discussion';
    table.privateWord = null;
    table.legalActions = { canDescribe: false, canVote: false, canGuess: true, canChat: true };
    const p = props(table);
    const view = render(<WhiteHatTable {...p} hidden={false} />);
    expect(screen.getByText('Bạn không có từ')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Đoán từ dân thường'), { target: { value: 'Cà phê' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lộ diện và đoán' }));
    expect(p.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lộ diện và đoán' }));
    expect(p.send).toHaveBeenCalledWith('white-hat:guess', {
      matchId: 'match',
      roundId: 'round',
      turnId: 'turn',
      text: 'Cà phê',
    });
    view.rerender(
      <WhiteHatTable
        {...p}
        table={{
          ...table,
          turnId: 'next',
          stage: 'voting',
          legalActions: { ...table.legalActions, canGuess: false },
        }}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('saves moderator configuration without allocating the moderator a role', () => {
    const table = snapshot();
    table.phase = 'waiting';
    table.stage = 'lobby';
    table.matchStatus = 'waiting';
    table.viewerMemberId = 'host';
    table.privateWord = undefined;
    table.legalActions.canDescribe = false;
    table.moderator = { ...table.config, civilianWord: '', spyWord: '', roles: [] };
    const p = props(table);
    render(<WhiteHatTable {...p} />);
    fireEvent.change(screen.getByLabelText('Từ dân thường'), { target: { value: 'Cà phê' } });
    fireEvent.change(screen.getByLabelText('Từ gián điệp'), { target: { value: 'Trà sữa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình và từ' }));
    expect(p.send).toHaveBeenCalledWith('white-hat:configure', {
      setup: { ...table.config, civilianWord: 'Cà phê', spyWord: 'Trà sữa' },
    });
    expect(screen.getByRole('button', { name: 'Bắt đầu ván Mũ Trắng' })).toBeDisabled();
  });
});
