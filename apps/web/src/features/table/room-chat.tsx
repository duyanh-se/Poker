'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);
  const [floatingTop, setFloatingTop] = useState<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const chatRef = useRef(chat);
  useEffect(() => {
    chatRef.current = chat;
  });
  useEffect(() => {
    chatRef.current?.markOpen(!collapsed);
    return () => chatRef.current?.markOpen(false);
  }, [collapsed]);
  useEffect(() => {
    const aside = asideRef.current;
    const shell = aside?.parentElement;
    if (!aside || !shell || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const header = shell.querySelector('header');
      const top = Math.max(12, header?.getBoundingClientRect().bottom ?? 82) + 12;
      const left = window.innerWidth - 292;
      const bottom = top + aside.getBoundingClientRect().height;
      const obstacles = shell.querySelectorAll(
        '.seat, .liar-seat, .liar-center, .liar-viewer-seat, .play-dock, .liar-controls, .board-accessible',
      );
      const blocked = [...obstacles].some((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right + 16 > left &&
          rect.left < window.innerWidth - 12 &&
          rect.bottom + 16 > top &&
          rect.top - 16 < bottom
        );
      });
      setFloatingTop(
        window.innerWidth >= 1600 && bottom < window.innerHeight - 16 && !blocked ? top : null,
      );
    };
    const observer = new ResizeObserver(measure);
    const rosterObserver = new MutationObserver(measure);
    rosterObserver.observe(shell, { childList: true, subtree: true });
    observer.observe(shell);
    observer.observe(aside);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      rosterObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [collapsed, chat?.messages.length]);
  useEffect(() => {
    if (following.current && historyRef.current)
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [chat?.messages, collapsed]);
  if (!chat) return null;
  return (
    <aside
      ref={asideRef}
      className="room-chat"
      aria-label="Chat phòng"
      data-floating={floatingTop !== null}
      style={{ '--chat-top': `${floatingTop ?? 0}px` } as CSSProperties}
    >
      <header>
        <strong>Chat phòng</strong>
        {yourTurn && <span>Đến lượt bạn</span>}
        <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? `Mở chat${chat.unread ? ` (${chat.unread})` : ''}` : 'Thu gọn'}
        </button>
      </header>
      {collapsed && (
        <p className="chat-preview">
          {chat.messages.length
            ? `${chat.messages.at(-1)!.displayName}: ${chat.messages.at(-1)!.text}`
            : 'Chưa có tin nhắn.'}
        </p>
      )}
      <div
        hidden={collapsed}
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
        hidden={collapsed}
        onSubmit={(e) => {
          e.preventDefault();
          if (connected && draft.trim() && [...draft.trim()].length <= 300)
            chat.send(draft, () => setDraft(''));
        }}
      >
        <label>
          <span className="sr-only">Tin nhắn</span>
          <input
            aria-label="Tin nhắn"
            placeholder="Nhập tin nhắn…"
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
