import { describe, expect, test } from "bun:test";
import {
  CARD_SUITS,
  cardEquals,
  createDeck,
  dealCards,
  Rank,
  shuffleCards,
  Suit,
} from "../src/index.js";

describe("deck", () => {
  test("creates one of every standard card", () => {
    const deck = createDeck();
    const cardKeys = new Set(deck.map(({ suit, rank }) => `${suit}:${rank}`));

    expect(deck).toHaveLength(52);
    expect(cardKeys.size).toBe(52);
    expect(deck.some((card) => cardEquals(card, { suit: Suit.Diamonds, rank: Rank.Seven }))).toBe(
      true,
    );
  });

  test("shuffles without mutating or changing the cards", () => {
    const deck = createDeck();
    const original = [...deck];
    const shuffled = shuffleCards(deck, () => 0);

    expect(deck).toEqual(original);
    expect(shuffled).not.toEqual(deck);
    expect(new Set(shuffled.map(({ suit, rank }) => `${suit}:${rank}`))).toEqual(
      new Set(deck.map(({ suit, rank }) => `${suit}:${rank}`)),
    );
  });

  test("rejects an invalid random source", () => {
    expect(() => shuffleCards(createDeck(), () => 1)).toThrow(RangeError);
  });

  test("protects the exported suit registry from runtime mutation", () => {
    expect(Object.isFrozen(CARD_SUITS)).toBe(true);
    expect(() => (CARD_SUITS as Suit[]).pop()).toThrow();
    expect(createDeck()).toHaveLength(52);
  });
});

describe("dealing", () => {
  for (let playerCount = 3; playerCount <= 7; playerCount += 1) {
    test(`deals all cards fairly to ${playerCount} players`, () => {
      const ids = Array.from({ length: playerCount }, (_, index) => `player-${index + 1}`);
      const players = dealCards(createDeck(), ids);
      const handSizes = players.map(({ hand }) => hand.length);

      expect(players.flatMap(({ hand }) => hand)).toHaveLength(52);
      expect(Math.max(...handSizes) - Math.min(...handSizes)).toBeLessThanOrEqual(1);
      expect(players.map(({ id }) => id)).toEqual(ids);
    });
  }
});
