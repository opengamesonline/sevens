import { describe, expect, test } from "bun:test";
import {
  createEmptyBoard,
  GameStatus,
  Rank,
  SevensVariant,
  Suit,
  TurnActionType,
  validateTurn,
  type Card,
  type SevensGameObject,
} from "../src/index.js";

const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });
const sevenOfDiamonds = card(Suit.Diamonds, Rank.Seven);

function createGame(overrides: Partial<SevensGameObject> = {}): SevensGameObject {
  return {
    variant: SevensVariant.Standard,
    status: GameStatus.Active,
    board: createEmptyBoard(),
    players: [
      { id: "alice", hand: [sevenOfDiamonds, card(Suit.Clubs, Rank.Two)] },
      { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
      { id: "carol", hand: [card(Suit.Spades, Rank.Seven), card(Suit.Clubs, Rank.Ace)] },
    ],
    currentPlayerId: "alice",
    winnerId: null,
    ...overrides,
  };
}

describe("play actions", () => {
  test("plays a valid card and advances without mutating the game", () => {
    const game = createGame();
    const snapshot = structuredClone(game);
    const result = validateTurn(game, {
      type: TurnActionType.Play,
      playerId: "alice",
      card: sevenOfDiamonds,
    });

    expect(game).toEqual(snapshot);
    expect(result?.board[Suit.Diamonds]).toEqual({ min: Rank.Seven, max: Rank.Seven });
    expect(result?.players[0]?.hand).toEqual([card(Suit.Clubs, Rank.Two)]);
    expect(result?.currentPlayerId).toBe("bob");
  });

  test("wraps turn advancement from the final seat to the first", () => {
    const game = createGame({
      players: [
        { id: "alice", hand: [card(Suit.Clubs, Rank.Two)] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [sevenOfDiamonds, card(Suit.Spades, Rank.Seven)] },
      ],
      currentPlayerId: "carol",
    });
    const result = validateTurn(game, {
      type: TurnActionType.Play,
      playerId: "carol",
      card: sevenOfDiamonds,
    });

    expect(result?.currentPlayerId).toBe("alice");
  });

  test("expands suit bounds down to ace and up to king", () => {
    const game = createGame({
      board: {
        ...createEmptyBoard(),
        [Suit.Clubs]: { min: Rank.Two, max: Rank.Queen },
      },
      players: [
        { id: "alice", hand: [card(Suit.Clubs, Rank.Ace), card(Suit.Hearts, Rank.Two)] },
        { id: "bob", hand: [card(Suit.Clubs, Rank.King), card(Suit.Spades, Rank.Two)] },
        { id: "carol", hand: [card(Suit.Hearts, Rank.Three)] },
      ],
    });

    const afterAce = validateTurn(game, {
      type: TurnActionType.Play,
      playerId: "alice",
      card: card(Suit.Clubs, Rank.Ace),
    });
    const afterKing = validateTurn(afterAce!, {
      type: TurnActionType.Play,
      playerId: "bob",
      card: card(Suit.Clubs, Rank.King),
    });

    expect(afterAce?.board[Suit.Clubs]).toEqual({ min: Rank.Ace, max: Rank.Queen });
    expect(afterKing?.board[Suit.Clubs]).toEqual({ min: Rank.Ace, max: Rank.King });
  });

  test("rejects the wrong player, an unowned card, and an illegal card", () => {
    const game = createGame();

    expect(
      validateTurn(game, {
        type: TurnActionType.Play,
        playerId: "bob",
        card: card(Suit.Hearts, Rank.Seven),
      }),
    ).toBeNull();
    expect(
      validateTurn(game, {
        type: TurnActionType.Play,
        playerId: "alice",
        card: card(Suit.Diamonds, Rank.Six),
      }),
    ).toBeNull();
    expect(
      validateTurn(game, {
        type: TurnActionType.Play,
        playerId: "alice",
        card: card(Suit.Clubs, Rank.Two),
      }),
    ).toBeNull();
  });

  test("finishes when a player plays their final card", () => {
    const game = createGame({
      players: [
        { id: "alice", hand: [sevenOfDiamonds] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [card(Suit.Spades, Rank.Seven)] },
      ],
    });
    const result = validateTurn(game, {
      type: TurnActionType.Play,
      playerId: "alice",
      card: sevenOfDiamonds,
    });

    expect(result?.status).toBe(GameStatus.Finished);
    expect(result?.winnerId).toBe("alice");
    expect(
      validateTurn(result!, {
        type: TurnActionType.Draw,
        playerId: "alice",
        fromPlayerId: "carol",
        card: card(Suit.Spades, Rank.Seven),
      }),
    ).toBeNull();
  });
});

describe("draw actions", () => {
  test("keeps the forced opening after a draw on an empty board", () => {
    const drawnCard = card(Suit.Clubs, Rank.Ace);
    const game = createGame({
      players: [
        { id: "alice", hand: [card(Suit.Clubs, Rank.Two)] },
        { id: "bob", hand: [sevenOfDiamonds, card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [drawnCard, card(Suit.Spades, Rank.Seven)] },
      ],
    });
    const result = validateTurn(game, {
      type: TurnActionType.Draw,
      playerId: "alice",
      fromPlayerId: "carol",
      card: drawnCard,
    });

    expect(result?.board).toEqual(createEmptyBoard());
    expect(
      validateTurn(result!, {
        type: TurnActionType.Play,
        playerId: "bob",
        card: card(Suit.Hearts, Rank.Seven),
      }),
    ).toBeNull();
    expect(
      validateTurn(result!, {
        type: TurnActionType.Play,
        playerId: "bob",
        card: sevenOfDiamonds,
      })?.board[Suit.Diamonds],
    ).toEqual({ min: Rank.Seven, max: Rank.Seven });
  });

  test("draws from the player on the right even when a play is available", () => {
    const game = createGame();
    const snapshot = structuredClone(game);
    const drawnCard = card(Suit.Clubs, Rank.Ace);
    const result = validateTurn(game, {
      type: TurnActionType.Draw,
      playerId: "alice",
      fromPlayerId: "carol",
      card: drawnCard,
    });

    expect(game).toEqual(snapshot);
    expect(result?.players[0]?.hand).toContainEqual(drawnCard);
    expect(result?.players[2]?.hand).not.toContainEqual(drawnCard);
    expect(result?.currentPlayerId).toBe("bob");
    expect(result?.board).toEqual(game.board);
  });

  test("uses the previous seat as the right-hand player without wraparound", () => {
    const game = createGame({ currentPlayerId: "bob" });
    const result = validateTurn(game, {
      type: TurnActionType.Draw,
      playerId: "bob",
      fromPlayerId: "alice",
      card: sevenOfDiamonds,
    });

    expect(result?.players[0]?.hand).not.toContainEqual(sevenOfDiamonds);
    expect(result?.players[1]?.hand).toContainEqual(sevenOfDiamonds);
    expect(result?.currentPlayerId).toBe("carol");
  });

  test("rejects a non-right donor and a card the donor does not own", () => {
    const game = createGame();

    expect(
      validateTurn(game, {
        type: TurnActionType.Draw,
        playerId: "alice",
        fromPlayerId: "bob",
        card: card(Suit.Hearts, Rank.Seven),
      }),
    ).toBeNull();
    expect(
      validateTurn(game, {
        type: TurnActionType.Draw,
        playerId: "alice",
        fromPlayerId: "carol",
        card: card(Suit.Hearts, Rank.Ace),
      }),
    ).toBeNull();
  });

  test("finishes with the donor as winner when their final card is drawn", () => {
    const drawnCard = card(Suit.Spades, Rank.Seven);
    const game = createGame({
      players: [
        { id: "alice", hand: [sevenOfDiamonds] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [drawnCard] },
      ],
    });
    const result = validateTurn(game, {
      type: TurnActionType.Draw,
      playerId: "alice",
      fromPlayerId: "carol",
      card: drawnCard,
    });

    expect(result?.status).toBe(GameStatus.Finished);
    expect(result?.winnerId).toBe("carol");
    expect(result?.players[2]?.hand).toEqual([]);
  });
});
