export type PlayerActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';
export type TablePhase = 'waiting' | 'running' | 'pause-pending' | 'paused' | 'closed';
export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export interface GameTransition {
  id: string;
  kind:
    | 'deal'
    | 'action'
    | 'street'
    | 'showdown-reveal'
    | 'showdown-verdict'
    | 'payout'
    | 'fold-win'
    | 'challenge'
    | 'challenge-reveal'
    | 'challenge-verdict'
    | 'life-loss'
    | 'timeout'
    | 'forfeit';
  startedAt: number;
  endsAt: number;
  actorMemberId?: string;
  action?: PlayerActionKind | 'play';
}

export interface RoomConfig {
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface CreateRoomRequest extends RoomConfig {
  gameType?: 'poker';
  displayName: string;
}

export interface JoinRoomRequest {
  roomCode: string;
  password: string;
  displayName: string;
}

export interface CommandEnvelope<T> {
  commandId: string;
  payload: T;
}

export interface GameActionPayload {
  handId: string;
  turnId: string;
  action: PlayerActionKind;
  amount?: number;
}

export interface TablePlayerSnapshot {
  memberId: string;
  displayName: string;
  seat: number;
  stack: number;
  contribution: number;
  connected: boolean;
  folded: boolean;
  allIn: boolean;
  sittingOut: boolean;
  isHost: boolean;
  isActing: boolean;
  holeCards?: string[];
}

export interface LegalActionsSnapshot {
  actions: PlayerActionKind[];
  callAmount: number;
  minRaiseTo?: number;
  maxRaiseTo?: number;
}

export interface PotSnapshot {
  amount: number;
  eligibleMemberIds?: string[];
  winnerMemberIds?: string[];
  payouts?: Array<{ memberId: string; amount: number }>;
}

export interface TableSnapshot {
  serverTime?: number;
  transition?: GameTransition;
  gameType: 'poker';
  version: number;
  roomCode: string;
  handId?: string;
  turnId?: string;
  phase: TablePhase;
  config: RoomConfig;
  viewerMemberId: string;
  hostMemberId: string;
  players: TablePlayerSnapshot[];
  board: string[];
  buttonSeat?: number;
  smallBlindSeat?: number;
  bigBlindSeat?: number;
  street?: Street;
  actingMemberId?: string;
  deadlineAt?: number;
  pots: PotSnapshot[];
  legalActions?: LegalActionsSnapshot;
  handInfo?: { name: string; cards: string[] };
}

export interface CommandResult {
  ok: boolean;
  code?: string;
  message?: string;
}

export type LiarsRank = 'A' | 'K' | 'Q' | 'JOKER';
export interface LiarsCard {
  id: string;
  rank: LiarsRank;
}
export interface CreateLiarsRoomRequest {
  gameType: 'liars-deck';
  displayName: string;
  startingLives?: number;
}
export interface LiarsTableSnapshot {
  serverTime?: number;
  transition?: GameTransition;
  gameType: 'liars-deck';
  version: number;
  roomCode: string;
  phase: 'waiting' | 'running' | 'closed';
  config: { startingLives: number };
  viewerMemberId: string;
  hostMemberId: string;
  matchId?: string;
  roundId?: string;
  turnId?: string;
  matchStatus: 'waiting' | 'active' | 'finished';
  roundNumber: number;
  tableRank?: 'A' | 'K' | 'Q';
  actingMemberId?: string;
  deadlineAt?: number;
  winnerMemberId?: string;
  players: Array<{
    memberId: string;
    displayName: string;
    seat: number;
    connected: boolean;
    isHost: boolean;
    isActing: boolean;
    lives: number;
    cardCount: number;
    eliminated: boolean;
    cards?: LiarsCard[];
  }>;
  lastPlay?: { memberId: string; count: number };
  challengeReveal?: { cards: LiarsCard[] };
  result?: {
    reason: 'challenge' | 'timeout' | 'forfeit';
    loserMemberId: string;
    loserDisplayName?: string;
    challengerMemberId?: string;
    playedByMemberId?: string;
    revealedCards?: LiarsCard[];
    wasLie?: boolean;
  };
  legalActions?: { canPlay: boolean; canChallenge: boolean; mustChallenge: boolean };
}
export type RoomSnapshot = TableSnapshot | LiarsTableSnapshot;
export type AnyCreateRoomRequest = CreateRoomRequest | CreateLiarsRoomRequest;
