import { RoomChat } from './room-chat';

describe('bounded room chat', () => {
  afterEach(() => jest.useRealTimers());
  it('validates text, limits sends and deduplicates retries before charging rate limits', () => {
    jest.useFakeTimers();
    const chat = new RoomChat();
    expect(() => chat.send('A', 'm', 'Name', 'x', ' ')).toThrow();
    expect(() => chat.send('A', 'm', 'Name', 'x', 'a'.repeat(301))).toThrow();
    expect(() => chat.send('A', 'm', 'Name', {}, 'hello')).toThrow();
    for (let i = 0; i < 5; i++) chat.send('A', 'm', 'Name', `c${i}`, ' hello ');
    expect(chat.send('A', 'm', 'Name', 'c0', 'hello').duplicate).toBe(true);
    expect(() => chat.send('A', 'm', 'Name', 'c5', 'hello')).toThrow();
    expect(chat.history('A')[0].text).toBe('hello');
    expect(chat.history('B')).toEqual([]);
    jest.advanceTimersByTime(10000);
    expect(chat.send('A', 'm', 'Name', 'c5', '😀'.repeat(300)).duplicate).toBe(false);
  });
  it('caps history, retains retry receipts past history eviction and clears room data', () => {
    jest.useFakeTimers();
    const chat = new RoomChat();
    for (let i = 0; i < 51; i++) {
      chat.send('A', 'm', 'Name', `c${i}`, '<img src=x onerror=alert(1)>');
      jest.advanceTimersByTime(10000);
    }
    expect(chat.history('A')).toHaveLength(50);
    expect(chat.send('A', 'm', 'Name', 'c0', 'retry').duplicate).toBe(true);
    chat.close('A');
    expect(chat.history('A')).toEqual([]);
    expect(chat.send('A', 'm', 'Name', 'c0', 'new').duplicate).toBe(false);
  });
});
