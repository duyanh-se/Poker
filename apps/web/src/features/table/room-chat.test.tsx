import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { ChatButton, useRoomChat } from './room-chat';

const message = {
  id: 'm1',
  commandId: 'c1',
  memberId: 'p1',
  displayName: 'Guest',
  text: '<img src=x onerror=alert(1)>',
  sentAt: 1,
};
function transport() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    connected: true,
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    emit: vi.fn(),
    timeout: vi.fn(),
  };
  socket.timeout.mockReturnValue(socket);
  return { socket: socket as unknown as Socket, handlers };
}
describe('room chat', () => {
  it('deduplicates messages, resets room history and ignores old socket events', () => {
    const { result } = renderHook(() => useRoomChat());
    const first = transport();
    const next = transport();
    act(() => result.current.bind(first.socket));
    act(() => {
      first.handlers.get('chat:message')!(message);
      first.handlers.get('chat:message')!(message);
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.unread).toBe(1);
    act(() => result.current.markOpen(true));
    expect(result.current.unread).toBe(0);
    act(() => result.current.bind(next.socket));
    act(() => first.handlers.get('chat:message')!(message));
    expect(result.current.messages).toHaveLength(0);
    act(() => next.handlers.get('chat:history')!([message]));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.unread).toBe(0);
  });
  it('keeps pending local to chat and ignores acknowledgement after disconnect', () => {
    const { result } = renderHook(() => useRoomChat());
    const { socket, handlers } = transport();
    act(() => result.current.bind(socket));
    const done = vi.fn();
    act(() => result.current.send('hello', done));
    expect(result.current.pending).toBe(true);
    const callback = vi.mocked(socket.emit).mock.calls[0][2] as (
      error: null,
      result: unknown,
    ) => void;
    act(() => handlers.get('disconnect')!());
    act(() => callback(null, { ok: true, message }));
    expect(done).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
  it('renders markup as text with an independent panel and turn reminder', () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
    const chat = {
      messages: [message],
      pending: false,
      error: '',
      unread: 1,
      bind: vi.fn(),
      send: vi.fn(),
      markOpen: vi.fn(),
    };
    render(<ChatButton chat={chat} connected yourTurn />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat (1)' }));
    expect(screen.getByText(message.text)).toBeVisible();
    expect(document.querySelector('.chat-history img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Quay lại bàn' })).toBeVisible();
  });
});
