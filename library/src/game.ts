import { createEmptyBoard } from "./board.js";
import { cardEquals } from "./cards.js";
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
  const rules = getVariantRules(variant);

  const deck = shuffleCards(rules.createDeck(), options.random ?? Math.random);
  const players = dealCards(deck, playerIds);
  const openingCard = { suit: Suit.Spades, rank: Rank.Seven };
  const openingPlayer = players.find(({ hand }) =>
    hand.some((card) => cardEquals(card, openingCard)),
  );

  if (openingPlayer === undefined) {
    throw new Error("Shuffled deck does not contain the seven of spades");
  }

  return {
    variant,
    status: GameStatus.Active,
    board: createEmptyBoard(),
    players,
    currentPlayerId: openingPlayer.id,
    pendingDraw: null,
    winnerId: null,
  };
}
