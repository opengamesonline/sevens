import { GameStatus, cardEquals, type Card } from '@opengamesonline/sevens';
import { selectOwnHand } from './selectors';
import type { SevensSessionSnapshot } from './types';

export type CardSelection = {
  card: Card;
  tableId: string | null;
  roundNumber: number;
  playerId: string;
};

export type GiveSelection = CardSelection & { requesterId: string };

export function canSelectHandCard(snapshot: SevensSessionSnapshot, actionPending: boolean): boolean {
  return !actionPending && snapshot.phase === 'started' && snapshot.state?.status === GameStatus.Active &&
    snapshot.self?.metadata.role === 'player' && selectOwnHand(snapshot) !== null;
}

/** A selection belongs to a player and round, not to a particular revision. */
export function createCardSelection(snapshot: SevensSessionSnapshot, card: Card): CardSelection | null {
  const game = snapshot.state;
  const self = snapshot.self;
  if (snapshot.phase !== 'started' || !game || game.status !== GameStatus.Active ||
    self?.metadata.role !== 'player' || !selectOwnHand(snapshot)?.some((held) => cardEquals(held, card))) return null;
  return { card, tableId: snapshot.tableId, roundNumber: game.roundNumber, playerId: self.id };
}

export function reconcileCardSelection(selection: CardSelection | null, snapshot: SevensSessionSnapshot): CardSelection | null {
  if (!selection || snapshot.tableId !== selection.tableId || snapshot.self?.id !== selection.playerId ||
    snapshot.state?.roundNumber !== selection.roundNumber || !createCardSelection(snapshot, selection.card)) return null;
  return selection;
}

/** A card chosen to give is specific to the current draw request. */
export function createGiveSelection(snapshot: SevensSessionSnapshot, card: Card): GiveSelection | null {
  const selection = createCardSelection(snapshot, card);
  const draw = snapshot.state?.pendingDraw;
  if (!selection || !draw || draw.donorId !== selection.playerId) return null;
  return { ...selection, requesterId: draw.requesterId };
}

export function reconcileGiveSelection(selection: GiveSelection | null, snapshot: SevensSessionSnapshot): GiveSelection | null {
  const draw = snapshot.state?.pendingDraw;
  if (!selection || !reconcileCardSelection(selection, snapshot) || !draw ||
    draw.donorId !== selection.playerId || draw.requesterId !== selection.requesterId) return null;
  return selection;
}
