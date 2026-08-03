import { isJokerCard } from "./cards.js";
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
  if (isJokerCard(card)) {
    throw new TypeError("The Joker cannot be placed on the board");
  }

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
  if (isJokerCard(card)) {
    return false;
  }

  if (isBoardEmpty(board)) {
    return card.suit === Suit.Spades && card.rank === Rank.Seven;
  }

  const spades = board[Suit.Spades];
  if (
    card.suit !== Suit.Spades &&
    (spades.min === null ||
      spades.max === null ||
      card.rank < spades.min ||
      card.rank > spades.max)
  ) {
    return false;
  }

  const suitState = board[card.suit];
  if (suitState.min === null || suitState.max === null) {
    return card.rank === Rank.Seven;
  }

  return card.rank === suitState.min - 1 || card.rank === suitState.max + 1;
}
