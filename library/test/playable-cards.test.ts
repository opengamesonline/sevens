import { describe, expect, test } from "bun:test";
import {
  createEmptyBoard,
  getPlayableCards,
  getVariantRules,
  placeCard,
  Rank,
  SevensVariant,
  Suit,
  type BoardState,
  type Card,
} from "../src/index.js";

const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });

describe("standard playable cards", () => {
  test("only allows the seven of spades on an empty board", () => {
    const hand = [
      card(Suit.Spades, Rank.Seven),
      card(Suit.Diamonds, Rank.Seven),
      card(Suit.Spades, Rank.Six),
    ];

    expect(getPlayableCards(createEmptyBoard(), hand, SevensVariant.Standard)).toEqual([
      card(Suit.Spades, Rank.Seven),
    ]);
  });

  test("allows adjacent spades and sevens for unopened suits", () => {
    const board = placeCard(createEmptyBoard(), card(Suit.Spades, Rank.Seven));
    const hand = [
      card(Suit.Spades, Rank.Six),
      card(Suit.Spades, Rank.Eight),
      card(Suit.Spades, Rank.Five),
      card(Suit.Clubs, Rank.Seven),
      card(Suit.Clubs, Rank.Six),
    ];

    expect(getPlayableCards(board, hand, SevensVariant.Standard)).toEqual([
      card(Suit.Spades, Rank.Six),
      card(Suit.Spades, Rank.Eight),
      card(Suit.Clubs, Rank.Seven),
    ]);
  });

  test("gates non-spade cards on the matching rank in the spade run", () => {
    const board = placeCard(
      placeCard(createEmptyBoard(), card(Suit.Spades, Rank.Seven)),
      card(Suit.Hearts, Rank.Seven),
    );
    const hand = [
      card(Suit.Hearts, Rank.Six),
      card(Suit.Hearts, Rank.Eight),
      card(Suit.Spades, Rank.Six),
      card(Suit.Spades, Rank.Eight),
    ];

    expect(getPlayableCards(board, hand, SevensVariant.Standard)).toEqual([
      card(Suit.Spades, Rank.Six),
      card(Suit.Spades, Rank.Eight),
    ]);

    const withSixOfSpades = placeCard(board, card(Suit.Spades, Rank.Six));
    expect(getPlayableCards(withSixOfSpades, hand, SevensVariant.Standard)).toEqual([
      card(Suit.Hearts, Rank.Six),
      card(Suit.Spades, Rank.Eight),
    ]);

    const withBothSpades = placeCard(withSixOfSpades, card(Suit.Spades, Rank.Eight));
    expect(getPlayableCards(withBothSpades, hand, SevensVariant.Standard)).toEqual([
      card(Suit.Hearts, Rank.Six),
      card(Suit.Hearts, Rank.Eight),
    ]);
  });

  test("does not move past ace or king", () => {
    const board: BoardState = {
      [Suit.Clubs]: { min: Rank.Ace, max: Rank.King },
      [Suit.Diamonds]: { min: Rank.Seven, max: Rank.Seven },
      [Suit.Hearts]: { min: null, max: null },
      [Suit.Spades]: { min: Rank.Ace, max: Rank.King },
    };
    const hand = [
      card(Suit.Clubs, Rank.Ace),
      card(Suit.Clubs, Rank.King),
      card(Suit.Diamonds, Rank.Six),
    ];

    expect(getPlayableCards(board, hand, SevensVariant.Standard)).toEqual([
      card(Suit.Diamonds, Rank.Six),
    ]);
  });

  test("protects variant rules from runtime mutation", () => {
    const rules = getVariantRules(SevensVariant.Standard);

    expect(Object.isFrozen(rules)).toBe(true);
    expect(() => {
      (rules as unknown as { getPlayableCards: () => readonly Card[] }).getPlayableCards = () => [];
    }).toThrow();
  });
});
