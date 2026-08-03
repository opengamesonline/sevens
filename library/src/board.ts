import { Rank, Suit, type BoardState, type Card } from "./types.js";

export function createEmptyBoard(): BoardState {
  return {
    [Suit.Clubs]: { min: null, max: null },
    [Suit.Diamonds]: { min: null, max: null },
    [Suit.Hearts]: { min: null, max: null },
    [Suit.Spades]: { min: null, max: null },
  };
}

export function isBoardEmpty(board: BoardState): boolean {
  return Object.values(board).every(({ min, max }) => min === null && max === null);
}

export function placeCard(board: BoardState, card: Card): BoardState {
  const suitState = board[card.suit];
  const nextSuitState =
    suitState.min === null || suitState.max === null
      ? { min: card.rank, max: card.rank }
      : {
          min: card.rank < suitState.min ? card.rank : suitState.min,
          max: card.rank > suitState.max ? card.rank : suitState.max,
        };

  return {
    ...board,
    [card.suit]: nextSuitState,
  };
}

export function isStandardPlayable(board: BoardState, card: Card): boolean {
  if (isBoardEmpty(board)) {
    return card.suit === Suit.Diamonds && card.rank === Rank.Seven;
  }

  const suitState = board[card.suit];
  if (suitState.min === null || suitState.max === null) {
    return card.rank === Rank.Seven;
  }

  return card.rank === suitState.min - 1 || card.rank === suitState.max + 1;
}
