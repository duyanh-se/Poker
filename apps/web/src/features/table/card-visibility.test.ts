import { describe, expect, it } from 'vitest';
import type { TablePlayerSnapshot, TableSnapshot } from '../../../../../packages/contracts/src';
import { canRenderHand, isHandVisible } from './card-visibility';

const player = (memberId: string, folded = false) =>
  ({ memberId, folded, holeCards: ['KS', 'KH'] }) as TablePlayerSnapshot;
const table = { viewerMemberId: 'host', canViewAllHoleCards: true } as TableSnapshot;

describe('independent Poker card visibility', () => {
  it('reveals only own cards on an ordinary activation despite received privileged cards', () => {
    expect(isHandVisible(table, player('host'), false, false)).toBe(true);
    expect(isHandVisible(table, player('guest'), false, false)).toBe(false);
    expect(canRenderHand(table, player('guest', true), false)).toBe(false);
  });

  it('reveals and renders folded opponents only after the separate all-hand gesture', () => {
    expect(isHandVisible(table, player('guest', true), false, true)).toBe(true);
    expect(canRenderHand(table, player('guest', true), true)).toBe(true);
    expect(isHandVisible(table, player('guest'), true, true)).toBe(false);
  });

  it('requires current server entitlement even with stale local all-hand state', () => {
    const ordinary = { ...table, canViewAllHoleCards: false };
    expect(isHandVisible(ordinary, player('guest'), false, true)).toBe(false);
    expect(canRenderHand(ordinary, player('guest', true), true)).toBe(false);
  });

  it('keeps public showdown hands visible while own-only folded hands stay hidden', () => {
    const showdown = { ...table, showdown: true };
    expect(isHandVisible(showdown, player('guest'), true, false)).toBe(true);
    expect(isHandVisible(showdown, player('guest', true), true, false)).toBe(false);
  });
});
