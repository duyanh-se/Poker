import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { WhiteHatSnapshot } from '../../../../../packages/contracts/src';
import { WhiteHatTable } from './white-hat-table';
import { History, Victory, WhiteChat } from './white-hat-pieces';

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
  it('counts Unicode descriptions and rejects duplicate clues from previous rounds inline', () => {
    const table = snapshot();
    table.descriptions = [{ roundNumber: 0, memberId: 'b', text: 'Buổi sáng' }];
    const p = props(table);
    render(<WhiteHatTable {...p} />);
    const input = screen.getByLabelText('Mô tả của bạn');
    fireEvent.change(input, { target: { value: '😀'.repeat(16) } });
    expect(screen.getByRole('button', { name: 'Gửi mô tả' })).toBeDisabled();
    expect(screen.getByText('Mô tả tối đa 15 ký tự.')).toBeVisible();
    fireEvent.change(input, { target: { value: ' BUỔI   SÁNG ' } });
    expect(screen.getByRole('button', { name: 'Gửi mô tả' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '😀'.repeat(15) } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mô tả' }));
    expect(p.send).toHaveBeenCalledWith(
      'white-hat:describe',
      expect.objectContaining({ text: '😀'.repeat(15) }),
    );
  });
  it('shows clues during voting and uses the public avatar selection', () => {
    const table = snapshot();
    table.stage = 'voting';
    table.candidateIds = ['b'];
    table.players.find((p) => p.memberId === 'b')!.avatarId = 11;
    table.descriptions = [{ memberId: 'b', roundNumber: 1, text: 'Buổi sáng' }];
    const view = render(<WhiteHatTable {...props(table)} />);
    expect(screen.getByText('Buổi sáng')).toBeVisible();
    expect(view.container.querySelector('[data-member="b"] .wh-avatar')).toHaveAttribute(
      'data-avatar',
      '11',
    );
  });
  it('saves a self-selected character without a target member or gameplay ids', () => {
    const p = props();
    render(<WhiteHatTable {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nhân vật' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nhân vật 12' }));
    expect(p.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhân vật' }));
    expect(p.send).toHaveBeenCalledWith('white-hat:set-avatar', { avatarId: 11 });
  });
  it('distinguishes the current avatar from a draft without committing a preview', () => {
    const table = snapshot();
    table.players.find((p) => p.memberId === 'a')!.avatarId = 2;
    const p = props(table);
    render(<WhiteHatTable {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nhân vật' }));
    expect(screen.getByRole('heading', { name: 'Nhân vật 03' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lưu nhân vật' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Nhân vật 12' }));
    expect(screen.getByRole('heading', { name: 'Nhân vật 12' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nhân vật 3' })).toHaveTextContent('Đang dùng');
    expect(screen.getByRole('button', { name: 'Nhân vật 12' })).toHaveTextContent('Đang chọn');
    expect(table.players.find((m) => m.memberId === 'a')!.avatarId).toBe(2);
    expect(p.send).not.toHaveBeenCalled();
  });
  it('separates own chat messages and renders real timestamps and plain text', () => {
    const table = snapshot();
    const setDraft = vi.fn();
    const view = render(
      <WhiteChat
        table={table}
        connected
        draft=""
        setDraft={setDraft}
        chat={{
          messages: [
            {
              id: 'm1',
              commandId: 'c1',
              memberId: 'a',
              displayName: 'Name a',
              text: 'Tin của bạn',
              sentAt: 1000,
            },
            {
              id: 'm2',
              commandId: 'c2',
              memberId: 'b',
              displayName: 'Name b',
              text: '<script>hello</script>',
              sentAt: 2000,
            },
          ],
          pending: false,
          error: '',
          unread: 0,
          bind: vi.fn(),
          markOpen: vi.fn(),
          send: vi.fn(),
        }}
      />,
    );
    expect(view.container.querySelector('[data-own="true"]')).toHaveTextContent('Name a · Bạn');
    expect(view.container.querySelector('[data-own="false"]')).toHaveTextContent('Name b');
    expect(view.container.querySelector('time')).toHaveAttribute(
      'datetime',
      '1970-01-01T00:00:01.000Z',
    );
    expect(screen.getByText('<script>hello</script>')).toBeVisible();
    expect(view.container.querySelector('script')).toBeNull();
  });
  it('opens the newest available history round and labels closed votes and guesses', () => {
    const table = snapshot();
    table.roundNumber = 3;
    table.descriptions = [
      { roundNumber: 1, memberId: 'a', text: null },
      { roundNumber: 2, memberId: 'b', text: 'Buổi sáng' },
    ];
    table.ballotResults = [
      {
        roundNumber: 2,
        runoff: false,
        totals: [{ memberId: 'c', votes: 1 }],
        ballots: [{ memberId: 'b', targetIds: ['c'] }],
      },
    ];
    table.guesses = [{ memberId: 'd', text: 'Sữa', correct: false }];
    render(<History table={table} />);
    expect(screen.getByText('Buổi sáng')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Phiếu bầu và lượt đoán' }));
    expect(screen.getByRole('heading', { name: 'Tổng phiếu' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ai đã bầu ai?' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Lượt lộ diện và đoán' })).toHaveTextContent(
      'Sai, đã bị loại.',
    );
    expect(screen.queryByText('Cà phê', { exact: true })).not.toBeInTheDocument();
  });
  it('keeps submission feedback and full ballot review alongside the white hat guess form', () => {
    const table = snapshot();
    table.stage = 'voting';
    table.ownBallot = ['b', 'c', 'd'];
    table.legalActions = { canDescribe: false, canVote: false, canGuess: true, canChat: true };
    render(<WhiteHatTable {...props(table)} />);
    expect(screen.getByRole('heading', { name: 'Phiếu đã gửi!' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Đoán từ dân thường' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Xem lựa chọn' }));
    const dialog = screen.getByRole('dialog', { name: 'Danh sách lựa chọn' });
    for (const name of ['Name b', 'Name c', 'Name d']) expect(dialog).toHaveTextContent(name);
  });
  it('confirms ending separately from room closure and renders cancellation without a winner', () => {
    const table = snapshot();
    table.viewerMemberId = 'host';
    table.privateWord = undefined;
    table.legalActions.canDescribe = false;
    const p = props(table);
    const view = render(<WhiteHatTable {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc ván' }));
    expect(p.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận kết thúc ván' }));
    expect(p.send).toHaveBeenCalledWith('white-hat:end-match', {
      matchId: 'match',
      roundId: 'round',
      turnId: 'turn',
    });
    view.rerender(
      <WhiteHatTable
        {...p}
        table={{
          ...table,
          stage: 'finished',
          matchStatus: 'finished',
          result: {
            outcome: 'cancelled',
            reason: 'moderator-ended',
            winner: null,
            winnerMemberIds: [],
            civilianWord: 'Cà phê',
            spyWord: 'Trà',
          },
        }}
        animate
      />,
    );
    expect(screen.getByRole('status', { name: 'Kết quả ván' })).toHaveTextContent(
      'Không có phe thắng',
    );
    expect(screen.getByRole('status', { name: 'Kết quả ván' })).not.toHaveClass('wh-celebrate');
  });
});
