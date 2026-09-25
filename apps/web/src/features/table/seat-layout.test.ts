import { describe, expect, it } from 'vitest';
import { seatPosition } from './seat-layout';
import type { TableSnapshot } from './store';

describe('portrait seat order', () => {
  it('rotates occupied seats around the viewer while preserving clockwise order', () => {
    const table = { players: [{ seat: 7 }, { seat: 1 }, { seat: 4 }] } as TableSnapshot;
    expect(seatPosition(table, 4, 4, true)).toEqual({ left: '50%', top: '91%' });
    expect(seatPosition(table, 7, 4, true)).toEqual({ left: '18%', top: '16%' });
    expect(seatPosition(table, 1, 4, true)).toEqual({ left: '82%', top: '16%' });
  });
  it('gives nine distinct positions inside narrow viewport bounds', () => {
    const table = { players: Array.from({ length: 9 }, (_, seat) => ({ seat })) } as TableSnapshot;
    const slots = table.players.map((p) => seatPosition(table, p.seat, 0, true));
    expect(new Set(slots.map((p) => `${p.left}/${p.top}`)).size).toBe(9);
    for (const p of slots) {
      expect(parseFloat(p.left)).toBeGreaterThanOrEqual(16);
      expect(parseFloat(p.left)).toBeLessThanOrEqual(84);
    }
  });
});
