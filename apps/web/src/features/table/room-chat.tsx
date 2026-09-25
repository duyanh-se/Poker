'use client';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChatMessage } from '../../../../../packages/contracts/src';

export function useRoomChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const active = useRef<Socket | null>(null);
  const sending = useRef(false);
  const open = useRef(false);
  const seen = useRef(new Set<string>());
  const epoch = useRef(0);
  function merge(message: ChatMessage) {
    setMessages((current) =>
      current.some((m) => m.id === message.id) ? current : [...current, message].slice(-50),
    );
  }
  function bind(socket: Socket) {
    active.current = socket;
    seen.current.clear();
    epoch.current++;
    setMessages([]);
    setUnread(0);
    setError('');
    setPending(false);
    sending.current = false;
    socket.on('chat:history', (history: ChatMessage[]) => {
      if (active.current !== socket) return;
      seen.current = new Set(history.map((m) => m.id));
      setMessages(history.slice(-50));
    });
    socket.on('chat:message', (message: ChatMessage) => {
      if (active.current !== socket) return;
      if (seen.current.has(message.id)) return;
      seen.current.add(message.id);
      if (seen.current.size > 128) seen.current.delete(seen.current.values().next().value!);
      merge(message);
      if (!open.current) setUnread((n) => n + 1);
    });
    socket.on('disconnect', () => {
      epoch.current++;
      sending.current = false;
      setPending(false);
    });
    return () => {
      if (active.current === socket) active.current = null;
    };
  }
  function markOpen(value: boolean) {
    open.current = value;
    if (value) setUnread(0);
  }
  function send(text: string, complete: () => void) {
    const socket = active.current;
    if (!socket?.connected || sending.current) return;
    sending.current = true;
    setPending(true);
    setError('');
    const attempt = epoch.current;
    socket
      .timeout(8000)
      .emit(
        'chat:send',
        { commandId: crypto.randomUUID(), text },
        (failure: Error | null, result?: { ok: boolean; code?: string; message?: ChatMessage }) => {
          if (active.current !== socket || attempt !== epoch.current) return;
          sending.current = false;
          setPending(false);
          if (failure || !result?.ok) {
            setError(
              result?.code === 'CHAT_RATE_LIMIT'
                ? 'Bạn gửi quá nhanh. Hãy chờ vài giây.'
                : 'Chưa gửi được tin nhắn. Kiểm tra kết nối trước khi thử lại.',
            );
            return;
          }
          if (result.message) merge(result.message);
          complete();
        },
      );
  }
  return { messages, pending, error, unread, bind, markOpen, send };
}
export type RoomChatState = ReturnType<typeof useRoomChat>;

export function RoomChat({
  chat,
  connected,
  yourTurn,
}: {
  chat?: RoomChatState;
  connected: boolean;
  yourTurn: boolean;
}) {
  const [draft, setDraft] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const chatRef = useRef(chat);
  useEffect(() => {
    chatRef.current = chat;
  });
  useEffect(() => {
    chatRef.current?.markOpen(true);
    return () => chatRef.current?.markOpen(false);
  }, []);
  useEffect(() => {
    if (following.current && historyRef.current)
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [chat?.messages]);
  if (!chat) return null;
  return (
    <aside className="room-chat" aria-label="Chat phòng">
      <header>
        <strong>Chat phòng</strong>
        {yourTurn && <span>Đến lượt bạn</span>}
      </header>
      <div
        ref={historyRef}
        className="chat-history"
        role="log"
        aria-label="Tin nhắn phòng"
        aria-live="polite"
        onScroll={() => {
          const el = historyRef.current;
          if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
        }}
      >
        {chat.messages.length === 0 && <p>Chưa có tin nhắn.</p>}
        {chat.messages.map((m) => (
          <div className="chat-message" key={m.id}>
            <strong>{m.displayName}</strong>{' '}
            <time>
              {new Date(m.sentAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (connected && draft.trim() && [...draft.trim()].length <= 300)
            chat.send(draft, () => setDraft(''));
        }}
      >
        <label>
          Tin nhắn
          <input
            aria-label="Tin nhắn"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={600}
            disabled={chat.pending}
          />
        </label>
        <small>{[...draft.trim()].length}/300</small>
        <p role="status">
          {chat.error ||
            (!connected ? 'Mất kết nối. Chưa thể gửi tin.' : chat.pending ? 'Đang gửi…' : '')}
        </p>
        <button
          disabled={!connected || chat.pending || !draft.trim() || [...draft.trim()].length > 300}
        >
          Gửi tin
        </button>
      </form>
    </aside>
  );
}
