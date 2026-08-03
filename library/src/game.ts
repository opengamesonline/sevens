import { createEmptyBoard } from "./board.js";
import { cardEquals, createDeck } from "./cards.js";
import { dealCards, shuffleCards } from "./deck.js";
import {
  GameStatus,
  Rank,
  Suit,
  type InitializeOptions,
  type SevensGameObject,
  type SevensVariant,
} from "./types.js";
import { getVariantRules } from "./variants.js";

function validatePlayerIds(playerIds: readonly string[]): void {
  if (playerIds.length < 3 || playerIds.length > 7) {
    throw new RangeError("Sevens requires between 3 and 7 players");
  }

  if (playerIds.some((id) => id.trim().length === 0)) {
    throw new TypeError("Player IDs must not be empty");
  }

  if (new Set(playerIds).size !== playerIds.length) {
    throw new TypeError("Player IDs must be unique");
  }
}

export function initializeSevens(
  playerIds: readonly string[],
  variant: SevensVariant,
  options: InitializeOptions = {},
): SevensGameObject {
  validatePlayerIds(playerIds);
  getVariantRules(variant);

  const deck = shuffleCards(createDeck(), options.random ?? Math.random);
  const players = dealCards(deck, playerIds);
  const openingCard = { suit: Suit.Diamonds, rank: Rank.Seven };
  const openingPlayer = players.find(({ hand }) =>
    hand.some((card) => cardEquals(card, openingCard)),
  );

  if (openingPlayer === undefined) {
    throw new Error("Shuffled deck does not contain the seven of diamonds");
  }

  return {
    variant,
    status: GameStatus.Active,
    board: createEmptyBoard(),
    players,
    currentPlayerId: openingPlayer.id,
    winnerId: null,
  };
}
