import { randomBytes } from 'node:crypto';
import type { GameTransition } from '@poker/contracts';
export type { GameTransition } from '@poker/contracts';

export const PACING = {
  deal: 1800,
  action: 450,
  street: 900,
  showdownReveal: 600,
  showdownVerdict: 800,
  payout: 1000,
  foldWin: 1200,
  challenge: 450,
  challengeReveal: 750,
  challengeVerdict: 600,
  lifeLoss: 600,
  penalty: 1200,
} as const;

export interface PacedRoom {
  transition?: GameTransition;
  continueTransition?: () => void;
  actingMemberId?: string;
  turnId?: string;
  deadlineAt?: number;
  version: number;
}

export function beginTransition(
  room: PacedRoom,
  kind: GameTransition['kind'],
  duration: number,
  continuation: () => void,
  details: Pick<GameTransition, 'actorMemberId' | 'action'> = {},
): void {
  const startedAt = Date.now();
  room.transition = {
    id: randomBytes(12).toString('base64url'),
    kind,
    startedAt,
    endsAt: startedAt + duration,
    ...details,
  };
  room.continueTransition = continuation;
  room.actingMemberId = undefined;
  room.turnId = undefined;
  room.deadlineAt = undefined;
}

export function advancePacing(room: PacedRoom, id: string): boolean {
  if (!room.transition || room.transition.id !== id || Date.now() < room.transition.endsAt)
    return false;
  const continuation = room.continueTransition;
  room.transition = undefined;
  room.continueTransition = undefined;
  continuation?.();
  room.version++;
  return true;
}
