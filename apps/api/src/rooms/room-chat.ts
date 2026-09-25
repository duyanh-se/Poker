import { randomUUID } from 'node:crypto';
import type { ChatMessage } from '@poker/contracts';
import { RoomError } from './room-error';

/** Bounded ephemeral history; authorization is performed by RoomService and Gateway. */
export class RoomChat {
  private readonly rooms = new Map<string, ChatMessage[]>();
  private readonly receipts = new Map<string, Map<string, ChatMessage>>();
  private readonly rates = new Map<string, Map<string, number[]>>();

  history(code: string): ChatMessage[] {
    return (this.rooms.get(code) ?? []).map((message) => ({ ...message }));
  }

  send(code: string, memberId: string, displayName: string, commandId: unknown, text: unknown) {
    if (
      typeof commandId !== 'string' ||
      !/^[\w-]{1,64}$/.test(commandId) ||
      typeof text !== 'string' ||
      text.length > 600
    )
      throw new RoomError('INVALID_CHAT', 'Tin nhắn không hợp lệ.');
    const content = text.trim();
    if (!content || [...content].length > 300)
      throw new RoomError('INVALID_CHAT', 'Tin nhắn cần từ 1 đến 300 ký tự.');
    const history = this.rooms.get(code) ?? [];
    const receipts = this.receipts.get(code) ?? new Map<string, ChatMessage>();
    const receiptKey = `${memberId}:${commandId}`;
    const duplicate = receipts.get(receiptKey);
    if (duplicate) return { message: { ...duplicate }, duplicate: true };
    const now = Date.now();
    const rates = this.rates.get(code) ?? new Map<string, number[]>();
    for (const [id, times] of rates) {
      const recent = times.filter((time) => now - time < 10000);
      if (recent.length) rates.set(id, recent);
      else rates.delete(id);
    }
    const recent = rates.get(memberId) ?? [];
    if (recent.length >= 5)
      throw new RoomError('CHAT_RATE_LIMIT', 'Bạn gửi quá nhanh. Hãy chờ vài giây.');
    const message: ChatMessage = {
      id: randomUUID(),
      commandId,
      memberId,
      displayName,
      text: content,
      sentAt: now,
    };
    history.push(message);
    if (history.length > 50) history.shift();
    this.rooms.set(code, history);
    receipts.set(receiptKey, message);
    if (receipts.size > 128) receipts.delete(receipts.keys().next().value!);
    this.receipts.set(code, receipts);
    rates.set(memberId, [...recent, now]);
    this.rates.set(code, rates);
    return { message: { ...message }, duplicate: false };
  }

  close(code: string) {
    this.rooms.delete(code);
    this.receipts.delete(code);
    this.rates.delete(code);
  }
}
