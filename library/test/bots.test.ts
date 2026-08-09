import { describe, expect, test } from "bun:test";
import {
  BotPlaystyle,
  GameStatus,
  Rank,
  SevensVariant,
  Suit,
  TurnActionType,
  createBotStrategy,
  createEmptyBoard,
  placeCard,
  validateTurn,
  type BoardState,
  type Card,
  type SevensGameObject,
  type StandardCard,
} from "../src/index.js";

const card = (suit: Suit, rank: Rank): StandardCard => ({ suit, rank });

function placeCards(cards: readonly StandardCard[]): BoardState {
  return cards.reduce(placeCard, createEmptyBoard());
}

function createGame(overrides: Partial<SevensGameObject> = {}): SevensGameObject {
  return {
    variant: SevensVariant.Standard,
    status: GameStatus.Active,
    board: createEmptyBoard(),
    players: [
      { id: "bot", hand: [card(Suit.Spades, Rank.Seven), card(Suit.Clubs, Rank.Nine)] },
      { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
      { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
    ],
    currentPlayerId: "bot",
    pendingDraw: null,
    winnerId: null,
    ...overrides,
  };
}

describe("bot strategy factory", () => {
  test("creates fresh frozen strategies and rejects unsupported playstyles", () => {
    const strategy = createBotStrategy(BotPlaystyle.Random);

    expect(Object.isFrozen(strategy)).toBe(true);
    expect(strategy).not.toBe(createBotStrategy(BotPlaystyle.Random));
    expect(() => createBotStrategy("unsupported" as BotPlaystyle)).toThrow(RangeError);
  });

  test("randomly chooses a valid play and never draws while one exists", () => {
    const board = placeCards([
      card(Suit.Spades, Rank.Seven),
      card(Suit.Spades, Rank.Eight),
      card(Suit.Spades, Rank.Nine),
      card(Suit.Clubs, Rank.Seven),
      card(Suit.Clubs, Rank.Eight),
      card(Suit.Diamonds, Rank.Seven),
    ]);
    const game = createGame({
      board,
      players: [
        {
          id: "bot",
          hand: [card(Suit.Clubs, Rank.Nine), card(Suit.Diamonds, Rank.Eight)],
        },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Spades, Rank.Ten)] },
      ],
    });
    const action = createBotStrategy(BotPlaystyle.Random, { random: () => 0.75 })(
      game,
      "bot",
    );

    expect(action).toEqual({
      type: TurnActionType.Play,
      card: card(Suit.Diamonds, Rank.Eight),
    });
    expect(validateTurn(game, "bot", action!)).not.toBeNull();
  });

  test("requests a draw only when no card is playable", () => {
    const game = createGame({
      players: [
        { id: "bot", hand: [card(Suit.Clubs, Rank.Nine)] },
        { id: "bob", hand: [card(Suit.Spades, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });

    expect(createBotStrategy(BotPlaystyle.Random)(game, "bot")).toEqual({
      type: TurnActionType.RequestDraw,
    });
  });

  test("chooses an owned card when the bot is the pending donor", () => {
    const game = createGame({
      currentPlayerId: "bob",
      pendingDraw: { requesterId: "bob", donorId: "bot" },
      players: [
        {
          id: "bot",
          hand: [card(Suit.Clubs, Rank.Two), card(Suit.Clubs, Rank.Three)],
        },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });
    const action = createBotStrategy(BotPlaystyle.Random, { random: () => 0.9 })(game, "bot");

    expect(action).toEqual({
      type: TurnActionType.GiveCard,
      card: card(Suit.Clubs, Rank.Three),
    });
    expect(validateTurn(game, "bot", action!)).not.toBeNull();
  });

  test("returns no action for an actor who is not expected to decide", () => {
    const strategy = createBotStrategy(BotPlaystyle.Random);
    const game = createGame();
    const pending = createGame({ pendingDraw: { requesterId: "bot", donorId: "carol" } });

    expect(strategy(game, "bob")).toBeNull();
    expect(strategy(pending, "bot")).toBeNull();
    expect(strategy({ ...game, status: GameStatus.Finished }, "bot")).toBeNull();
  });
});

describe("cautious bot strategy", () => {
  test("prefers a play that advances its hand over an unnecessary extension", () => {
    const board = placeCards([
      card(Suit.Spades, Rank.Seven),
      card(Suit.Spades, Rank.Eight),
      card(Suit.Spades, Rank.Nine),
      card(Suit.Clubs, Rank.Seven),
      card(Suit.Clubs, Rank.Eight),
    ]);
    const game = createGame({
      board,
      players: [
        {
          id: "bot",
          hand: [
            card(Suit.Clubs, Rank.Nine),
            card(Suit.Diamonds, Rank.Seven),
            card(Suit.Diamonds, Rank.Eight),
          ],
        },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Spades, Rank.Ten)] },
      ],
    });
    const snapshot = structuredClone(game);
    const action = createBotStrategy(BotPlaystyle.Cautious, { random: () => 0 })(game, "bot");

    expect(action).toEqual({
      type: TurnActionType.Play,
      card: card(Suit.Diamonds, Rank.Seven),
    });
    expect(game).toEqual(snapshot);
  });

  test("falls back to a valid play when every move is unnecessary", () => {
    const board = placeCards([
      card(Suit.Spades, Rank.Seven),
      card(Suit.Spades, Rank.Eight),
      card(Suit.Spades, Rank.Nine),
      card(Suit.Clubs, Rank.Seven),
      card(Suit.Clubs, Rank.Eight),
    ]);
    const game = createGame({
      board,
      players: [
        { id: "bot", hand: [card(Suit.Clubs, Rank.Nine)] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Spades, Rank.Ten)] },
      ],
    });

    expect(createBotStrategy(BotPlaystyle.Cautious)(game, "bot")).toEqual({
      type: TurnActionType.Play,
      card: card(Suit.Clubs, Rank.Nine),
    });
  });

  test("validates random sources when a choice is required", () => {
    const hand: readonly Card[] = [card(Suit.Clubs, Rank.Two), card(Suit.Clubs, Rank.Three)];
    const game = createGame({
      currentPlayerId: "bob",
      pendingDraw: { requesterId: "bob", donorId: "bot" },
      players: [
        { id: "bot", hand },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Diamonds, Rank.Seven)] },
      ],
    });

    expect(() =>
      createBotStrategy(BotPlaystyle.Cautious, { random: () => 1 })(game, "bot"),
    ).toThrow(RangeError);
  });
});
