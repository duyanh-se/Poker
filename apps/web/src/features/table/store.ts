import { create } from 'zustand';

import type {
  RoomSnapshot as ContractRoomSnapshot,
  TableSnapshot as PokerTableSnapshot,
} from '../../../../../packages/contracts/src';
export type {
  GameTransition,
  PlayerActionKind as PlayerAction,
  LiarsTableSnapshot,
} from '../../../../../packages/contracts/src';
export type TableSnapshot = PokerTableSnapshot;
export type RoomSnapshot = ContractRoomSnapshot;

type TableStore = {
  table?: RoomSnapshot;
  hidePrivateCards: boolean;
  showAllHoleCards: boolean;
  requestMessage: string;
  setSnapshot: (snapshot: RoomSnapshot) => void;
  clear: () => void;
  setPrivateCardsHidden: (hidden: boolean) => void;
  revealAllHoleCards: () => void;
  setRequestMessage: (message: string) => void;
};

export const useTableStore = create<TableStore>((set) => ({
  hidePrivateCards: true,
  showAllHoleCards: false,
  requestMessage: '',
  setSnapshot: (snapshot) =>
    set((state) => {
      if (
        state.table &&
        state.table.roomCode === snapshot.roomCode &&
        snapshot.version < state.table.version
      ) {
        return state;
      }
      const sameScope =
        state.table?.gameType === 'poker' &&
        snapshot.gameType === 'poker' &&
        state.table.roomCode === snapshot.roomCode &&
        state.table.viewerMemberId === snapshot.viewerMemberId &&
        state.table.handId === snapshot.handId &&
        state.table.canViewAllHoleCards === snapshot.canViewAllHoleCards;
      return { table: snapshot, showAllHoleCards: sameScope && state.showAllHoleCards };
    }),
  clear: () => set({ table: undefined, hidePrivateCards: true, showAllHoleCards: false }),
  setPrivateCardsHidden: (hidePrivateCards) =>
    set((state) => ({
      hidePrivateCards,
      showAllHoleCards: !hidePrivateCards && state.showAllHoleCards,
    })),
  revealAllHoleCards: () =>
    set((state) =>
      state.table?.gameType === 'poker' &&
      state.table.canViewAllHoleCards === true &&
      state.table.players.some((player) => player.holeCards?.length)
        ? { hidePrivateCards: false, showAllHoleCards: true }
        : state,
    ),
  setRequestMessage: (requestMessage) => set({ requestMessage }),
}));
