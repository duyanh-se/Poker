import type { TableSnapshot } from './store';

export function seatAngle(table: TableSnapshot, seat: number, viewer: number): number {
  const ordered = [...table.players].sort(
    (a, b) => ((a.seat - viewer + 9) % 9) - ((b.seat - viewer + 9) % 9),
  );
  return (
    (Math.max(
      0,
      ordered.findIndex((p) => p.seat === seat),
    ) /
      Math.max(1, ordered.length)) *
    Math.PI *
    2
  );
}

export function seatPosition(table: TableSnapshot, seat: number, viewer: number, portrait = false) {
  const angle = seatAngle(table, seat, viewer);
  if (portrait) {
    const count = table.players.length;
    const index = Math.round((angle / (Math.PI * 2)) * Math.max(1, count));
    const layouts: Record<number, number[][]> = {
      1: [[50, 91]],
      2: [
        [50, 91],
        [50, 9],
      ],
      3: [
        [50, 91],
        [18, 16],
        [82, 16],
      ],
      4: [
        [50, 91],
        [16, 42],
        [50, 9],
        [84, 42],
      ],
      5: [
        [50, 91],
        [16, 62],
        [18, 16],
        [82, 16],
        [84, 62],
      ],
      6: [
        [50, 91],
        [16, 67],
        [16, 32],
        [50, 9],
        [84, 32],
        [84, 67],
      ],
      7: [
        [50, 91],
        [16, 72],
        [16, 46],
        [18, 16],
        [82, 16],
        [84, 46],
        [84, 72],
      ],
      8: [
        [50, 91],
        [16, 73],
        [16, 48],
        [16, 24],
        [50, 8],
        [84, 24],
        [84, 48],
        [84, 73],
      ],
      9: [
        [50, 93],
        [16, 75],
        [16, 52],
        [16, 29],
        [34, 8],
        [66, 8],
        [84, 29],
        [84, 52],
        [84, 75],
      ],
    };
    const [left, top] = (layouts[count] ?? layouts[9])[index] ?? [50, 93];
    return { left: `${left}%`, top: `${top}%` };
  }
  return { left: `${50 - Math.sin(angle) * 40}%`, top: `${50 + Math.cos(angle) * 34}%` };
}
