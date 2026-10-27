import { randomBytes, randomInt } from 'node:crypto';
import type {
  WhiteHatActionIds,
  WhiteHatBallotResult,
  WhiteHatRole,
  WhiteHatSetup,
  WhiteHatStage,
} from '@poker/contracts';
import { RoomError } from '../rooms/room-error';

export const whiteHatId = () => randomBytes(16).toString('base64url');
export const wordKey = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi');
export function whiteHatText(value: unknown): string {
  if (typeof value !== 'string') throw new RoomError('INVALID_TEXT', 'Cần nhập văn bản.');
  const text = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!text || [...text].length > 80)
    throw new RoomError('INVALID_TEXT', 'Nội dung cần từ 1 đến 80 ký tự.');
  return text;
}
export const automaticRoles = (count: number) => ({
  spyCount: count < 6 ? 1 : count < 9 ? 2 : 3,
  whiteCount: 1,
});
export function validateSetup(setup: WhiteHatSetup, count: number): WhiteHatSetup {
  const roles = setup.roleMode === 'auto' ? automaticRoles(count) : setup;
  if (
    !['auto', 'custom'].includes(setup.roleMode) ||
    !Number.isInteger(setup.eliminationsPerRound) ||
    setup.eliminationsPerRound < 1 ||
    setup.eliminationsPerRound >= count ||
    !Number.isInteger(roles.spyCount) ||
    !Number.isInteger(roles.whiteCount) ||
    roles.spyCount < 1 ||
    roles.whiteCount < 1 ||
    roles.spyCount + roles.whiteCount >= count ||
    roles.spyCount >= count - roles.spyCount
  )
    throw new RoomError('INVALID_CONFIG', 'Số role hoặc số người bị loại không hợp lệ.');
  const civilianWord = whiteHatText(setup.civilianWord);
  const spyWord = whiteHatText(setup.spyWord);
  if (wordKey(civilianWord) === wordKey(spyWord))
    throw new RoomError('INVALID_CONFIG', 'Hai từ phải khác nhau.');
  return {
    ...setup,
    spyCount: roles.spyCount,
    whiteCount: roles.whiteCount,
    civilianWord,
    spyWord,
  };
}

export interface WhiteHatParticipant {
  id: string;
  role: WhiteHatRole;
  alive: boolean;
  departed: boolean;
  revealed: boolean;
  guessed: boolean;
}

/** Pure match rules: no sessions, sockets or recipient-specific serialization. */
export class WhiteHatEngine {
  readonly setup: WhiteHatSetup;
  readonly matchId = whiteHatId();
  readonly participants: WhiteHatParticipant[];
  readonly descriptions: Array<{ roundNumber: number; memberId: string; text: string | null }> = [];
  readonly guesses: Array<{ memberId: string; text: string; correct: boolean }> = [];
  readonly ballotResults: WhiteHatBallotResult[] = [];
  readonly ballots = new Map<string, string[]>();
  stage: WhiteHatStage = 'description';
  roundId = '';
  turnId = '';
  roundNumber = 0;
  actingMemberId?: string;
  deadlineAt?: number;
  candidateIds: string[] = [];
  ballotSize = 0;
  selectedIds: string[] = [];
  lastEliminatedIds: string[] = [];
  notice?: string;
  result?: { winner: WhiteHatRole; winnerMemberIds: string[] };
  private readonly order: string[];
  private roundOrder: string[] = [];
  private starter = -1;
  private descriptionIndex = 0;
  private lastGuessIds = new Set<string>();
  private onlyWhiteFinal = false;

  constructor(
    memberIds: string[],
    setup: WhiteHatSetup,
    private readonly now = Date.now,
    private readonly pick: (max: number) => number = randomInt,
  ) {
    if (
      memberIds.length < 4 ||
      memberIds.length > 12 ||
      new Set(memberIds).size !== memberIds.length
    )
      throw new RoomError('NOT_ENOUGH_PLAYERS', 'Cần từ 4 đến 12 người chơi.');
    this.setup = validateSetup(setup, memberIds.length);
    const assignment = this.shuffle(memberIds);
    this.participants = assignment.map((id, i) => ({
      id,
      role:
        i < this.setup.spyCount
          ? 'spy'
          : i < this.setup.spyCount + this.setup.whiteCount
            ? 'white-hat'
            : 'civilian',
      alive: true,
      departed: false,
      revealed: false,
      guessed: false,
    }));
    this.order = this.shuffle(memberIds);
    this.nextRound();
  }

  assertCurrent(ids: WhiteHatActionIds): void {
    if (
      this.result ||
      ids.matchId !== this.matchId ||
      ids.roundId !== this.roundId ||
      ids.turnId !== this.turnId
    )
      throw new RoomError('STALE_ACTION', 'Giai đoạn đã thay đổi.');
    if (this.deadlineAt !== undefined && this.now() >= this.deadlineAt)
      throw new RoomError('TURN_EXPIRED', 'Đã hết thời gian.');
  }

  participant(id: string): WhiteHatParticipant {
    const participant = this.participants.find((p) => p.id === id);
    if (!participant || participant.departed)
      throw new RoomError('NOT_MEMBER', 'Không còn trong ván.');
    return participant;
  }
  living(): WhiteHatParticipant[] {
    return this.participants.filter((p) => p.alive);
  }
  canGuess(id: string): boolean {
    const p = this.participants.find((p) => p.id === id);
    return Boolean(
      p &&
        !p.departed &&
        p.role === 'white-hat' &&
        !p.guessed &&
        !this.result &&
        (this.stage === 'last-guess'
          ? this.lastGuessIds.has(id)
          : p.alive && ['discussion', 'intermission'].includes(this.stage)),
    );
  }

  describe(id: string, value: unknown): void {
    this.alive(id);
    if (this.stage !== 'description' || this.actingMemberId !== id)
      throw new RoomError('NOT_YOUR_TURN', 'Chưa đến lượt mô tả của bạn.');
    this.descriptions.push({
      roundNumber: this.roundNumber,
      memberId: id,
      text: whiteHatText(value),
    });
    this.nextDescription();
  }

  advance(): void {
    if (this.stage === 'discussion') {
      this.candidateIds = this.living().map((p) => p.id);
      this.ballotSize = Math.min(this.setup.eliminationsPerRound, this.candidateIds.length - 1);
      this.selectedIds = [];
      this.ballots.clear();
      this.enter('voting', 60_000);
    } else if (this.stage === 'intermission') {
      this.nextRound();
    } else throw new RoomError('INVALID_STATE', 'Chưa thể chuyển giai đoạn.');
  }

  vote(id: string, targetIds: unknown): void {
    this.alive(id);
    if (!['voting', 'revote'].includes(this.stage) || this.ballots.has(id))
      throw new RoomError('INVALID_ACTION', 'Không thể gửi hoặc sửa phiếu lúc này.');
    const targets = this.targets(targetIds, this.ballotSize);
    if (targets.includes(id)) throw new RoomError('INVALID_VOTE', 'Không được bầu bản thân.');
    this.ballots.set(id, targets);
    if (this.living().every((p) => this.ballots.has(p.id))) this.closeBallot();
  }

  resolveTie(targetIds: unknown): void {
    if (this.stage !== 'tie-break')
      throw new RoomError('INVALID_STATE', 'Không có hòa cần phân xử.');
    this.eliminate([...this.selectedIds, ...this.targets(targetIds, this.ballotSize)]);
  }

  guess(id: string, value: unknown): void {
    if (!this.canGuess(id)) throw new RoomError('FORBIDDEN', 'Bạn không có quyền đoán lúc này.');
    const text = whiteHatText(value);
    const p = this.participant(id);
    p.guessed = true;
    p.revealed = true;
    const correct = wordKey(text) === wordKey(this.setup.civilianWord);
    this.guesses.push({ memberId: id, text, correct });
    if (correct) this.finish('white-hat', [id]);
    else {
      p.alive = false;
      if (this.stage !== 'last-guess') this.checkVictory();
    }
  }

  timeout(roundId: string, turnId: string): boolean {
    if (
      this.result ||
      this.roundId !== roundId ||
      this.turnId !== turnId ||
      this.deadlineAt === undefined ||
      this.now() < this.deadlineAt
    )
      return false;
    if (this.stage === 'description') {
      this.descriptions.push({
        roundNumber: this.roundNumber,
        memberId: this.actingMemberId!,
        text: null,
      });
      this.nextDescription();
    } else if (this.stage === 'voting' || this.stage === 'revote') this.closeBallot();
    else if (this.stage === 'last-guess') {
      for (const p of this.participants) {
        if (!this.lastGuessIds.has(p.id)) continue;
        p.guessed = true;
        p.alive = false;
      }
      this.lastGuessIds.clear();
      this.onlyWhiteFinal = false;
      this.enter('intermission');
      this.checkVictory();
    }
    return true;
  }

  depart(id: string): void {
    const p = this.participant(id);
    const wasAlive = p.alive;
    p.departed = true;
    p.alive = false;
    p.guessed = true;
    if (!wasAlive || this.result) return;
    this.notice = 'Một người đã bỏ cuộc. Danh sách người chơi được cập nhật.';
    if (this.stage === 'last-guess') return; // Preserve already-granted last guesses.
    this.checkVictory();
    if (this.result || this.onlyWhiteFinal) return;
    if (['voting', 'revote', 'tie-break'].includes(this.stage)) {
      this.ballots.clear();
      this.candidateIds = [];
      this.selectedIds = [];
      this.ballotSize = 0;
      this.enter('discussion');
      this.notice = 'Một người đã bỏ cuộc. Lượt bầu chưa chốt đã hủy; quản trò hãy mở bầu lại.';
    } else if (this.stage === 'description' && this.actingMemberId === id) this.nextDescription();
  }

  private shuffle(ids: string[]): string[] {
    const result = [...ids];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.pick(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  private alive(id: string): WhiteHatParticipant {
    const p = this.participant(id);
    if (!p.alive) throw new RoomError('FORBIDDEN', 'Bạn đã bị loại.');
    return p;
  }
  private enter(stage: WhiteHatStage, duration?: number): void {
    this.stage = stage;
    this.turnId = whiteHatId();
    this.deadlineAt = duration === undefined ? undefined : this.now() + duration;
    this.actingMemberId = undefined;
  }
  private nextRound(): void {
    this.roundNumber++;
    this.roundId = whiteHatId();
    do this.starter = (this.starter + 1) % this.order.length;
    while (!this.living().some((p) => p.id === this.order[this.starter]));
    this.roundOrder = [
      ...this.order.slice(this.starter),
      ...this.order.slice(0, this.starter),
    ].filter((id) => this.living().some((p) => p.id === id));
    this.descriptionIndex = -1;
    this.lastEliminatedIds = [];
    this.selectedIds = [];
    this.candidateIds = [];
    this.ballotSize = 0;
    this.ballots.clear();
    this.notice = undefined;
    this.nextDescription();
  }
  private nextDescription(): void {
    let next: string | undefined;
    while (++this.descriptionIndex < this.roundOrder.length) {
      const id = this.roundOrder[this.descriptionIndex];
      if (this.living().some((p) => p.id === id)) {
        next = id;
        break;
      }
    }
    this.enter(next ? 'description' : 'discussion', next ? 60_000 : undefined);
    this.actingMemberId = next;
  }
  private targets(value: unknown, size: number): string[] {
    if (
      !Array.isArray(value) ||
      value.length !== size ||
      new Set(value).size !== size ||
      value.some((id) => typeof id !== 'string' || !this.candidateIds.includes(id))
    )
      throw new RoomError('INVALID_VOTE', 'Chọn đủ số người khác nhau trong danh sách hợp lệ.');
    return [...value] as string[];
  }
  private closeBallot(): void {
    const totals = this.candidateIds.map((memberId) => ({
      memberId,
      votes: [...this.ballots.values()].filter((targets) => targets.includes(memberId)).length,
    }));
    this.ballotResults.push({
      roundNumber: this.roundNumber,
      runoff: this.stage === 'revote',
      ballots: [...this.ballots].map(([memberId, targetIds]) => ({
        memberId,
        targetIds: [...targetIds],
      })),
      totals,
    });
    const sorted = [...totals].sort((a, b) => b.votes - a.votes);
    const cutoff = sorted[this.ballotSize - 1].votes;
    const above = sorted.filter((p) => p.votes > cutoff).map((p) => p.memberId);
    const tied = sorted.filter((p) => p.votes === cutoff).map((p) => p.memberId);
    const remaining = this.ballotSize - above.length;
    if (tied.length === remaining) this.eliminate([...this.selectedIds, ...above, ...tied]);
    else {
      const runoff = this.stage === 'voting';
      this.selectedIds = [...this.selectedIds, ...above];
      this.candidateIds = tied;
      this.ballotSize = remaining;
      this.ballots.clear();
      this.enter(runoff ? 'revote' : 'tie-break', runoff ? 60_000 : undefined);
    }
  }
  private eliminate(ids: string[]): void {
    for (const p of this.participants) if (ids.includes(p.id)) p.alive = false;
    this.selectedIds = [...ids];
    this.lastEliminatedIds = [...ids];
    this.lastGuessIds = new Set(
      this.participants
        .filter((p) => ids.includes(p.id) && p.role === 'white-hat' && !p.guessed && !p.departed)
        .map((p) => p.id),
    );
    this.onlyWhiteFinal = false;
    this.enter('last-guess', 30_000);
  }
  private checkVictory(): void {
    if (this.result) return;
    const living = this.living();
    const spies = living.filter((p) => p.role === 'spy').length;
    const whites = living.filter((p) => p.role === 'white-hat');
    if (spies === 0 && whites.length === 0) this.finish('civilian');
    else if (spies > 0 && spies >= living.length - spies) this.finish('spy');
    else if (whites.length === living.length && !this.onlyWhiteFinal) {
      this.lastGuessIds = new Set(whites.map((p) => p.id));
      this.onlyWhiteFinal = true;
      this.enter('last-guess', 30_000);
      this.notice = 'Cơ hội đoán cuối cùng trước khi công bố kết quả.';
    }
  }
  private finish(winner: WhiteHatRole, winnerMemberIds?: string[]): void {
    this.result = {
      winner,
      winnerMemberIds:
        winnerMemberIds ?? this.participants.filter((p) => p.role === winner).map((p) => p.id),
    };
    this.enter('finished');
  }
}
