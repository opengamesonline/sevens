import { describe, expect, test } from "bun:test";
import {
  cardEquals,
  createEmptyBoard,
  createFinalScores,
  GameStatus,
  getPlayableCards,
  getVariantRules,
  initializeSevens,
  isJokerCard,
  JOKER_CARD,
  placeCard,
  Rank,
  SevensVariant,
  Suit,
  TurnActionType,
  validateTurn,
  type BoardState,
  type SevensGameObject,
  type StandardCard,
  type VariantRules,
} from "../src/index.js";

const card = (suit: Suit, rank: Rank): StandardCard => ({ suit, rank });

function placeCards(cards: readonly StandardCard[]): BoardState {
  return cards.reduce(placeCard, createEmptyBoard());
}

function jokerGame(overrides: Partial<SevensGameObject> = {}): SevensGameObject {
  return {
    variant: SevensVariant.Joker,
    status: GameStatus.Active,
    board: placeCards([
      card(Suit.Spades, Rank.Seven),
      card(Suit.Spades, Rank.Eight),
      card(Suit.Spades, Rank.Nine),
      card(Suit.Spades, Rank.Ten),
      card(Suit.Hearts, Rank.Seven),
      card(Suit.Hearts, Rank.Eight),
    ]),
    players: [
      { id: "alice", hand: [JOKER_CARD, card(Suit.Hearts, Rank.Ten)] },
      { id: "bob", hand: [card(Suit.Hearts, Rank.Nine), card(Suit.Clubs, Rank.Two)] },
      { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
    ],
    currentPlayerId: "alice",
    pendingDraw: null,
    winnerId: null,
    ...overrides,
  };
}

describe("Joker variant deck and rules", () => {
  test("deals 52 standard cards and exactly one Joker", () => {
    const game = initializeSevens(
      ["alice", "bob", "carol"],
      SevensVariant.Joker,
      { random: () => 0 },
    );
    const deck = game.players.flatMap((player) => player.hand);
    const standardCards = deck.filter((candidate) => !isJokerCard(candidate));

    expect(String(SevensVariant.Joker)).toBe("joker");
    expect(deck).toHaveLength(53);
    expect(deck.filter(isJokerCard)).toHaveLength(1);
    expect(new Set(standardCards.map(({ suit, rank }) => `${suit}:${rank}`))).toHaveLength(52);
    expect(Object.isFrozen(JOKER_CARD)).toBe(true);
    expect(cardEquals(JOKER_CARD, { kind: "joker" })).toBe(true);
  });

  test("uses frozen factory-produced rules and rejects unsupported variants", () => {
    const standard = getVariantRules(SevensVariant.Standard);
    const joker = getVariantRules(SevensVariant.Joker);

    expect(Object.isFrozen(standard)).toBe(true);
    expect(Object.isFrozen(joker)).toBe(true);
    expect(standard).not.toBe(getVariantRules(SevensVariant.Standard));
    expect(joker.createDeck()).toHaveLength(53);
    expect(() => getVariantRules("unsupported" as SevensVariant)).toThrow(RangeError);
    expect(() => {
      (joker as unknown as { resolvePlay: VariantRules["resolvePlay"] }).resolvePlay = () => null;
    }).toThrow();
  });
});

describe("Joker plays", () => {
  test("keeps the seven of spades as the mandatory opener", () => {
    const game = jokerGame({
      board: createEmptyBoard(),
      players: [
        { id: "alice", hand: [JOKER_CARD, card(Suit.Spades, Rank.Eight)] },
        { id: "bob", hand: [card(Suit.Spades, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Clubs, Rank.Seven)] },
      ],
    });
    const context = { playerId: "alice", players: game.players };

    expect(getPlayableCards(game.board, game.players[0]!.hand, game.variant, context)).toEqual([]);
    expect(
      validateTurn(game, "alice", {
        type: TurnActionType.Play,
        card: card(Suit.Spades, Rank.Eight),
      }),
    ).toBeNull();
  });

  test("plays normal legal cards without consuming or moving the Joker", () => {
    const sevenOfSpades = card(Suit.Spades, Rank.Seven);
    const game = jokerGame({
      board: createEmptyBoard(),
      players: [
        { id: "alice", hand: [JOKER_CARD, sevenOfSpades] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });
    const result = validateTurn(game, "alice", {
      type: TurnActionType.Play,
      card: sevenOfSpades,
    });

    expect(result?.players[0]?.hand).toEqual([JOKER_CARD]);
    expect(result?.players[1]?.hand).toEqual(game.players[1]!.hand);
    expect(result?.currentPlayerId).toBe("bob");
    expect(result?.status).toBe(GameStatus.Active);
  });

  test("atomically bridges from another hand, transfers the Joker, advances, and does not mutate", () => {
    const extraCard = card(Suit.Clubs, Rank.Ace);
    const game = jokerGame({
      players: [
        { id: "alice", hand: [JOKER_CARD, card(Suit.Hearts, Rank.Ten), extraCard] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Nine), card(Suit.Clubs, Rank.Two)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });
    const snapshot = structuredClone(game);
    const context = { playerId: "alice", players: game.players };

    expect(getPlayableCards(game.board, game.players[0]!.hand, game.variant, context)).toContainEqual(
      card(Suit.Hearts, Rank.Ten),
    );
    const result = validateTurn(game, "alice", {
      type: TurnActionType.Play,
      card: card(Suit.Hearts, Rank.Ten),
    });

    expect(game).toEqual(snapshot);
    expect(result?.board[Suit.Hearts]).toEqual({ min: Rank.Seven, max: Rank.Ten });
    expect(result?.players[0]?.hand).toEqual([extraCard]);
    expect(result?.players[1]?.hand).toEqual([card(Suit.Clubs, Rank.Two), JOKER_CARD]);
    expect(result?.currentPlayerId).toBe("bob");
    expect(result?.status).toBe(GameStatus.Active);
  });

  test("supports a downward assisted play", () => {
    const game = jokerGame({
      board: placeCards([
        card(Suit.Spades, Rank.Seven),
        card(Suit.Spades, Rank.Six),
        card(Suit.Spades, Rank.Five),
        card(Suit.Spades, Rank.Four),
        card(Suit.Hearts, Rank.Seven),
        card(Suit.Hearts, Rank.Six),
      ]),
      players: [
        { id: "alice", hand: [JOKER_CARD, card(Suit.Hearts, Rank.Four)] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Five), card(Suit.Clubs, Rank.Two)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });

    const result = validateTurn(game, "alice", {
      type: TurnActionType.Play,
      card: card(Suit.Hearts, Rank.Four),
    });

    expect(result?.board[Suit.Hearts]).toEqual({ min: Rank.Four, max: Rank.Seven });
    expect(result?.players[1]?.hand).toEqual([card(Suit.Clubs, Rank.Two), JOKER_CARD]);
  });

  test("finishes when an assisted play empties the actor's hand", () => {
    const result = validateTurn(jokerGame(), "alice", {
      type: TurnActionType.Play,
      card: card(Suit.Hearts, Rank.Ten),
    });

    expect(result?.players[0]?.hand).toEqual([]);
    expect(result?.status).toBe(GameStatus.Finished);
    expect(result?.winnerId).toBe("alice");
    expect(result?.currentPlayerId).toBe("alice");
  });

  test("rejects assistance when the actor also holds the bridge", () => {
    const game = jokerGame({
      players: [
        {
          id: "alice",
          hand: [
            JOKER_CARD,
            card(Suit.Hearts, Rank.Nine),
            card(Suit.Hearts, Rank.Ten),
          ],
        },
        { id: "bob", hand: [card(Suit.Clubs, Rank.Two)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });

    expect(
      validateTurn(game, "alice", {
        type: TurnActionType.Play,
        card: card(Suit.Hearts, Rank.Ten),
      }),
    ).toBeNull();
  });

  test("rejects assistance when the selected card's spade gate is missing", () => {
    const game = jokerGame({
      board: placeCards([
        card(Suit.Spades, Rank.Seven),
        card(Suit.Spades, Rank.Eight),
        card(Suit.Spades, Rank.Nine),
        card(Suit.Hearts, Rank.Seven),
        card(Suit.Hearts, Rank.Eight),
      ]),
    });

    expect(
      validateTurn(game, "alice", {
        type: TurnActionType.Play,
        card: card(Suit.Hearts, Rank.Ten),
      }),
    ).toBeNull();
  });

  test("rejects assistance when the bridge card's spade gate is missing", () => {
    const game = jokerGame({
      board: placeCards([
        card(Suit.Spades, Rank.Seven),
        card(Suit.Spades, Rank.Eight),
        card(Suit.Hearts, Rank.Seven),
        card(Suit.Hearts, Rank.Eight),
      ]),
    });

    expect(
      validateTurn(game, "alice", {
        type: TurnActionType.Play,
        card: card(Suit.Hearts, Rank.Ten),
      }),
    ).toBeNull();
  });

  test("does not make a lone Joker playable but still permits RequestDraw", () => {
    const game = jokerGame({
      players: [
        { id: "alice", hand: [JOKER_CARD] },
        { id: "bob", hand: [card(Suit.Clubs, Rank.Two)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });

    expect(getPlayableCards(game.board, [JOKER_CARD], game.variant)).toEqual([]);
    expect(
      validateTurn(game, "alice", { type: TurnActionType.Play, card: JOKER_CARD }),
    ).toBeNull();
    expect(
      validateTurn(game, "alice", { type: TurnActionType.RequestDraw })?.pendingDraw,
    ).toEqual({ requesterId: "alice", donorId: "carol" });
  });
});

test("the Joker scores zero", () => {
  const game = jokerGame({
    status: GameStatus.Finished,
    players: [
      { id: "alice", hand: [] },
      { id: "bob", hand: [JOKER_CARD, card(Suit.Clubs, Rank.Ace)] },
      { id: "carol", hand: [card(Suit.Diamonds, Rank.Ten)] },
    ],
    winnerId: "alice",
  });

  expect(createFinalScores(game)).toEqual([
    { playerId: "alice", score: 0 },
    { playerId: "bob", score: 15 },
    { playerId: "carol", score: 10 },
  ]);
});
