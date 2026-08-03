import { GameStatus, Suit, getPlayableCards, type Card } from '@opengamesonline/sevens';

import type { SevensSessionSnapshot } from './types';

const BOARD_SUIT_ORDER: readonly Suit[] = [
  Suit.Spades,
  Suit.Diamonds,
  Suit.Clubs,
  Suit.Hearts,
];

export type SevensOpponent = {
  id: string;
  name: string;
  cardCount: number;
  isCurrentPlayer: boolean;
};

export type SevensSuitRun = {
  suit: Suit;
  cards: readonly Card[];
};

export function selectParticipantNames(
  snapshot: SevensSessionSnapshot | null,
): Readonly<Record<string, string>> {
  if (!snapshot) return {};
  return Object.fromEntries(
    snapshot.participants.map(({ id, name }) => [id, name]),
  );
}

export function selectParticipantName(
  snapshot: SevensSessionSnapshot | null,
  participantId: string | null,
): string | null {
  if (!snapshot || !participantId) return null;
  return snapshot.participants.find(({ id }) => id === participantId)?.name ?? null;
}

export function selectOwnHand(snapshot: SevensSessionSnapshot | null): readonly Card[] | null {
  if (!snapshot?.state || snapshot.self?.metadata.role !== 'player') return null;
  return snapshot.state.players.find(({ id }) => id === snapshot.self?.id)?.hand ?? null;
}

export function selectOpponents(
  snapshot: SevensSessionSnapshot | null,
): readonly SevensOpponent[] {
  if (!snapshot?.state) return [];
  const names = selectParticipantNames(snapshot);
  const ownPlayerId = snapshot.self?.metadata.role === 'player' ? snapshot.self.id : null;

  return snapshot.state.players
    .filter(({ id }) => id !== ownPlayerId)
    .map(({ id, hand }) => ({
      id,
      name: names[id] ?? id,
      cardCount: hand.length,
      isCurrentPlayer: id === snapshot.state?.currentPlayerId,
    }));
}

export function selectPlayableCards(
  snapshot: SevensSessionSnapshot | null,
): readonly Card[] {
  const game = snapshot?.state;
  const hand = selectOwnHand(snapshot);
  if (
    !game ||
    !hand ||
    game.status !== GameStatus.Active ||
    game.pendingDraw !== null ||
    game.currentPlayerId !== snapshot?.self?.id
  ) {
    return [];
  }
  return getPlayableCards(game.board, hand, game.variant, {
    playerId: snapshot.self.id,
    players: game.players,
  });
}

export function selectSuitRuns(
  snapshot: SevensSessionSnapshot | null,
): readonly SevensSuitRun[] {
  const board = snapshot?.state?.board;
  return BOARD_SUIT_ORDER.map((suit) => {
    const bounds = board?.[suit];
    const cards: Card[] = [];
    if (bounds?.min !== null && bounds?.min !== undefined && bounds.max !== null) {
      for (let rank = bounds.min; rank <= bounds.max; rank += 1) {
        cards.push({ suit, rank });
      }
    }
    return { suit, cards };
  });
}
