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
  test("only allows the seven of diamonds on an empty board", () => {
    const hand = [
      card(Suit.Diamonds, Rank.Seven),
      card(Suit.Clubs, Rank.Seven),
      card(Suit.Diamonds, Rank.Six),
    ];

    expect(getPlayableCards(createEmptyBoard(), hand, SevensVariant.Standard)).toEqual([
      card(Suit.Diamonds, Rank.Seven),
    ]);
  });

  test("allows adjacent cards and sevens for unopened suits", () => {
    const board = placeCard(createEmptyBoard(), card(Suit.Diamonds, Rank.Seven));
    const hand = [
      card(Suit.Diamonds, Rank.Six),
      card(Suit.Diamonds, Rank.Eight),
      card(Suit.Diamonds, Rank.Five),
      card(Suit.Clubs, Rank.Seven),
      card(Suit.Clubs, Rank.Six),
    ];

    expect(getPlayableCards(board, hand, SevensVariant.Standard)).toEqual([
      card(Suit.Diamonds, Rank.Six),
      card(Suit.Diamonds, Rank.Eight),
      card(Suit.Clubs, Rank.Seven),
    ]);
  });

  test("does not move past ace or king", () => {
    const board: BoardState = {
      [Suit.Clubs]: { min: Rank.Ace, max: Rank.King },
      [Suit.Diamonds]: { min: Rank.Seven, max: Rank.Seven },
      [Suit.Hearts]: { min: null, max: null },
      [Suit.Spades]: { min: null, max: null },
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
      (rules as { getPlayableCards: () => readonly Card[] }).getPlayableCards = () => [];
    }).toThrow();
  });
});
