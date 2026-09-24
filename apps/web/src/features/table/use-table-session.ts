'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { type RoomSnapshot, useTableStore } from './store';

export type RoomInvite = { roomCode: string; password: string };
type RoomResult = { roomCode?: string; password?: string; snapshot?: RoomSnapshot };
type CommandResult = { ok: boolean; code?: string };
const inviteStorageKey = 'poker.room-invite';

const messages: Record<string, string> = {
  TRANSITION_IN_PROGRESS: 'Bàn đang chuyển tiếp. Hãy chờ hiệu ứng hiện tại kết thúc.',
  INVALID_INVITATION: 'Mã phòng hoặc mật khẩu không đúng.',
  DUPLICATE_NAME: 'Tên này đã được sử dụng trong phòng. Hãy chọn tên khác.',
  ROOM_FULL: 'Phòng đã đủ 9 người chơi.',
  ROOM_NOT_FOUND: 'Phòng không còn tồn tại. Bạn có thể tạo hoặc vào phòng khác.',
  NO_SESSION: 'Phiên chơi không còn tồn tại. Hãy vào phòng lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  HAND_IN_PROGRESS: 'Hãy đợi ván kết thúc trước khi quản lý phòng.',
  STALE_ACTION: 'Lượt chơi đã thay đổi. Bàn đang được cập nhật.',
  INVALID_ACTION: 'Hành động không hợp lệ ở lượt hiện tại.',
  INVALID_AMOUNT: 'Số chip không hợp lệ. Hãy kiểm tra giới hạn cược.',
  INVALID_STATE: 'Bàn chưa đủ điều kiện để thực hiện thao tác này.',
  NOT_YOUR_TURN: 'Chưa đến lượt của bạn.',
  MATCH_IN_PROGRESS: 'Trận Bài nói dối đang diễn ra. Hãy chờ trận kết thúc.',
  MUST_CHALLENGE: 'Bạn phải tố lượt đánh gần nhất.',
  INVALID_CARDS: 'Chọn từ một đến ba lá bài của bạn.',
  FOREIGN_CARD: 'Một lá bài không thuộc tay bạn.',
  TURN_EXPIRED: 'Lượt đã hết thời gian.',
  WRONG_GAME: 'Thao tác không thuộc game của phòng này.',
};

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    detail?: string,
  ) {
    super(messages[code ?? ''] ?? detail ?? 'Không thể thực hiện yêu cầu. Vui lòng thử lại.');
  }
}

async function request(path: string, body?: Record<string, unknown>): Promise<RoomResult> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(8_000),
    ...(body
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status >= 500) throw new Error('Máy chủ chưa sẵn sàng. Hãy thử kết nối lại.');
  const result = (await response.json()) as RoomResult & { code?: string; message?: string };
  if (!response.ok) throw new RequestError(response.status, result.code, result.message);
  return result;
}

function storedInvite(snapshot: RoomSnapshot): RoomInvite | undefined {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(inviteStorageKey) ?? 'null',
    ) as RoomInvite | null;
    if (
      value &&
      value.roomCode === snapshot.roomCode &&
      typeof value.password === 'string' &&
      snapshot.viewerMemberId === snapshot.hostMemberId
    )
      return value;
    window.sessionStorage.removeItem(inviteStorageKey);
  } catch {
    /* Storage may be unavailable or malformed. */
  }
  return undefined;
}

function removeInvite(): void {
  try {
    window.sessionStorage.removeItem(inviteStorageKey);
  } catch {
    /* Storage is optional. */
  }
}

export function useTableSession() {
  const table = useTableStore((state) => state.table);
  const message = useTableStore((state) => state.requestMessage);
  const [invite, setInvite] = useState<RoomInvite>();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>(
    'connecting',
  );
  const [pending, setPending] = useState(false);
  const [animate, setAnimate] = useState(false);
  const pendingRef = useRef(false);
  const needsSync = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const mounted = useRef(false);
  const syncVersion = useRef(0);
  const roomCode = table?.roomCode;

  const synchronize = useCallback(async (): Promise<boolean> => {
    const version = ++syncVersion.current;
    try {
      const result = await request('/rooms/current');
      if (!mounted.current || version !== syncVersion.current) return false;
      if (result.snapshot) {
        useTableStore.getState().setSnapshot(result.snapshot);
        setInvite(storedInvite(result.snapshot));
      } else {
        useTableStore.getState().clear();
        removeInvite();
        setInvite(undefined);
      }
      needsSync.current = false;
      return true;
    } catch (error) {
      if (!mounted.current || version !== syncVersion.current) return false;
      if (error instanceof RequestError && [401, 403, 404].includes(error.status)) {
        const hadRoom = Boolean(useTableStore.getState().table);
        useTableStore.getState().clear();
        removeInvite();
        setInvite(undefined);
        needsSync.current = false;
        if (hadRoom || error.code === 'ROOM_NOT_FOUND')
          useTableStore.getState().setRequestMessage(error.message);
        return true;
      }
      setConnection('offline');
      useTableStore
        .getState()
        .setRequestMessage(
          'Không kết nối được máy chủ. Thông tin bàn chưa được xác nhận; hãy thử kết nối lại.',
        );
      return false;
    } finally {
      if (mounted.current && version === syncVersion.current) setLoading(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setLoading(true);
    setAnimate(false);
    useTableStore.getState().setRequestMessage('');
    const synced = await synchronize();
    if (synced && mounted.current) {
      pendingRef.current = false;
      setPending(false);
      if (socketRef.current?.connected) setConnection('connected');
      else socketRef.current?.connect();
    }
  }, [synchronize]);

  useEffect(() => {
    mounted.current = true;
    const initialRestore = window.setTimeout(() => void synchronize(), 0);
    return () => {
      window.clearTimeout(initialRestore);
      mounted.current = false;
      syncVersion.current += 1;
    };
  }, [synchronize]);

  useEffect(() => {
    if (!roomCode) return;
    let firstSnapshot = true;
    let active = true;
    // The guest-session cookie belongs to the Web origin. Route Socket.IO
    // through the same-origin Next.js rewrite so it is included in the
    // polling and WebSocket upgrade requests.
    const socket = io('/game', { path: '/socket.io', withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => {
      firstSnapshot = true;
      setConnection('connecting');
      setAnimate(false);
    });
    socket.on('table:snapshot', (snapshot: RoomSnapshot) => {
      if (!active) return;
      const current = useTableStore.getState().table;
      if (
        snapshot.roomCode !== roomCode ||
        (current?.roomCode === roomCode && current.version > snapshot.version)
      )
        return;
      if (current?.version === snapshot.version && !firstSnapshot) return;
      setAnimate(!firstSnapshot && document.visibilityState === 'visible');
      firstSnapshot = false;
      useTableStore.getState().setSnapshot(snapshot);
      setInvite(storedInvite(snapshot));
      setConnection('connected');
      if (needsSync.current) {
        needsSync.current = false;
        pendingRef.current = false;
        setPending(false);
      }
    });
    socket.on('disconnect', (reason: string) => {
      firstSnapshot = true;
      setAnimate(false);
      setConnection('offline');
      useTableStore.getState().setPrivateCardsHidden(true);
      if (reason === 'io server disconnect') {
        useTableStore
          .getState()
          .setRequestMessage(
            'Kết nối đã kết thúc hoặc bàn đang mở ở tab khác. Chọn kết nối lại để kiểm tra phiên.',
          );
      }
    });
    socket.on('connect_error', () => {
      setConnection('offline');
      setAnimate(false);
    });
    socket.on('room:closed', () => {
      syncVersion.current += 1;
      useTableStore.getState().clear();
      useTableStore
        .getState()
        .setRequestMessage('Phòng đã đóng. Bạn có thể tạo hoặc vào phòng khác.');
      removeInvite();
      setInvite(undefined);
      pendingRef.current = false;
      setPending(false);
    });
    return () => {
      active = false;
      socket.removeAllListeners();
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [roomCode]);

  useEffect(() => {
    const conceal = () => useTableStore.getState().setPrivateCardsHidden(true);
    const visibility = () => {
      setAnimate(false);
      if (document.visibilityState !== 'visible') conceal();
    };
    window.addEventListener('blur', conceal);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', conceal);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  async function submitRoom(
    path: '/rooms' | '/rooms/join',
    body: Record<string, unknown>,
  ): Promise<void> {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    useTableStore.getState().setRequestMessage('');
    syncVersion.current += 1;
    try {
      const result = await request(path, body);
      if (!mounted.current) return;
      removeInvite();
      if (result.roomCode && result.password) {
        try {
          window.sessionStorage.setItem(
            inviteStorageKey,
            JSON.stringify({ roomCode: result.roomCode, password: result.password }),
          );
        } catch {
          /* Current invitation still works without storage. */
        }
      }
      if (result.snapshot) {
        useTableStore.getState().setSnapshot(result.snapshot);
        setInvite(
          result.password &&
            result.roomCode &&
            result.snapshot.viewerMemberId === result.snapshot.hostMemberId
            ? { roomCode: result.roomCode, password: result.password }
            : undefined,
        );
        setConnection('connecting');
      }
      setAnimate(false);
    } catch (error) {
      if (mounted.current)
        useTableStore
          .getState()
          .setRequestMessage(
            error instanceof RequestError
              ? error.message
              : 'Không kết nối được máy chủ. Hãy kiểm tra kết nối rồi thử lại.',
          );
    } finally {
      if (mounted.current) {
        pendingRef.current = false;
        setPending(false);
        setLoading(false);
      }
    }
  }

  function send(event: string, body: Record<string, unknown>): void {
    const socket = socketRef.current;
    if (pendingRef.current) return;
    if (useTableStore.getState().table?.transition) {
      useTableStore.getState().setRequestMessage(messages.TRANSITION_IN_PROGRESS);
      return;
    }
    if (!socket?.connected || connection !== 'connected') {
      useTableStore
        .getState()
        .setRequestMessage('Đang mất kết nối với bàn. Hãy kết nối lại trước khi thao tác.');
      return;
    }
    pendingRef.current = true;
    setPending(true);
    useTableStore.getState().setRequestMessage('');
    socket
      .timeout(8_000)
      .emit(
        event,
        { ...body, commandId: crypto.randomUUID() },
        async (error: Error | null, result?: CommandResult) => {
          if (!mounted.current || socketRef.current !== socket) return;
          if (error || !result?.ok) {
            needsSync.current = true;
            setAnimate(false);
            useTableStore
              .getState()
              .setRequestMessage(
                error
                  ? 'Chưa nhận được xác nhận. Đang kiểm tra trạng thái bàn; không gửi lại hành động.'
                  : (messages[result?.code ?? ''] ??
                      'Không thể thực hiện thao tác. Đang cập nhật bàn.'),
              );
            const synced = await synchronize();
            if (!synced) return;
          } else if (event === 'room:leave') {
            useTableStore.getState().clear();
            setInvite(undefined);
            removeInvite();
          }
          pendingRef.current = false;
          setPending(false);
        },
      );
  }

  const visibleInvite =
    table && table.viewerMemberId === table.hostMemberId && invite?.roomCode === table.roomCode
      ? invite
      : undefined;
  return {
    table,
    invite: visibleInvite,
    loading,
    connection,
    pending,
    message,
    animate,
    restore,
    submitRoom,
    send,
  };
}
