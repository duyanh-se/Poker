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
  requestMessage: string;
  setSnapshot: (snapshot: RoomSnapshot) => void;
  clear: () => void;
  setPrivateCardsHidden: (hidden: boolean) => void;
  setRequestMessage: (message: string) => void;
};

export const useTableStore = create<TableStore>((set) => ({
  hidePrivateCards: true,
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
      return { table: snapshot };
    }),
  clear: () => set({ table: undefined, hidePrivateCards: true }),
  setPrivateCardsHidden: (hidePrivateCards) => set({ hidePrivateCards }),
  setRequestMessage: (requestMessage) => set({ requestMessage }),
}));
