import type { TablePlayerSnapshot, TableSnapshot } from '../../../../../packages/contracts/src';

export function isPublicHand(table: TableSnapshot, player: TablePlayerSnapshot): boolean {
  return table.showdown === true && !player.folded;
}

export function canRenderHand(
  table: TableSnapshot,
  player: TablePlayerSnapshot,
  allHandsVisible = false,
): boolean {
  return (
    !player.folded ||
    (allHandsVisible && table.canViewAllHoleCards === true && !!player.holeCards?.length)
  );
}

export function isHandVisible(
  table: TableSnapshot,
  player: TablePlayerSnapshot,
  hidden: boolean,
  allHandsVisible = false,
): boolean {
  return (
    isPublicHand(table, player) ||
    (!hidden &&
      (player.memberId === table.viewerMemberId ||
        (allHandsVisible && table.canViewAllHoleCards === true)))
  );
}
