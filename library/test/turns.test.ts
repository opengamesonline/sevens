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
    pendingDraw: null,
    winnerId: null,
    ...overrides,
  };
}

describe("play actions", () => {
  test("plays a valid card and advances without mutating the game", () => {
    const game = createGame();
    const snapshot = structuredClone(game);
    const result = validateTurn(game, "alice", {
      type: TurnActionType.Play,
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
    const result = validateTurn(game, "carol", {
      type: TurnActionType.Play,
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

    const afterAce = validateTurn(game, "alice", {
      type: TurnActionType.Play,
      card: card(Suit.Clubs, Rank.Ace),
    });
    const afterKing = validateTurn(afterAce!, "bob", {
      type: TurnActionType.Play,
      card: card(Suit.Clubs, Rank.King),
    });

    expect(afterAce?.board[Suit.Clubs]).toEqual({ min: Rank.Ace, max: Rank.Queen });
    expect(afterKing?.board[Suit.Clubs]).toEqual({ min: Rank.Ace, max: Rank.King });
  });

  test("rejects the wrong player, an unowned card, and an illegal card", () => {
    const game = createGame();

    expect(
      validateTurn(game, "bob", {
        type: TurnActionType.Play,
        card: card(Suit.Hearts, Rank.Seven),
      }),
    ).toBeNull();
    expect(
      validateTurn(game, "alice", {
        type: TurnActionType.Play,
        card: card(Suit.Diamonds, Rank.Six),
      }),
    ).toBeNull();
    expect(
      validateTurn(game, "alice", {
        type: TurnActionType.Play,
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
    const result = validateTurn(game, "alice", {
      type: TurnActionType.Play,
      card: sevenOfDiamonds,
    });

    expect(result?.status).toBe(GameStatus.Finished);
    expect(result?.winnerId).toBe("alice");
    expect(
      validateTurn(result!, "alice", {
        type: TurnActionType.RequestDraw,
      }),
    ).toBeNull();
  });
});

describe("draw actions", () => {
  test("keeps the forced opening after a two-step draw on an empty board", () => {
    const drawnCard = card(Suit.Clubs, Rank.Ace);
    const game = createGame({
      players: [
        { id: "alice", hand: [card(Suit.Clubs, Rank.Two)] },
        { id: "bob", hand: [sevenOfDiamonds, card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [drawnCard, card(Suit.Spades, Rank.Seven)] },
      ],
    });
    const pending = validateTurn(game, "alice", { type: TurnActionType.RequestDraw });
    const result = validateTurn(pending!, "carol", {
      type: TurnActionType.GiveCard,
      card: drawnCard,
    });

    expect(result?.board).toEqual(createEmptyBoard());
    expect(
      validateTurn(result!, "bob", {
        type: TurnActionType.Play,
        card: card(Suit.Hearts, Rank.Seven),
      }),
    ).toBeNull();
    expect(
      validateTurn(result!, "bob", {
        type: TurnActionType.Play,
        card: sevenOfDiamonds,
      })?.board[Suit.Diamonds],
    ).toEqual({ min: Rank.Seven, max: Rank.Seven });
  });

  test("lets the current player request a draw even when a play is available", () => {
    const game = createGame();
    const snapshot = structuredClone(game);
    const pending = validateTurn(game, "alice", { type: TurnActionType.RequestDraw });

    expect(game).toEqual(snapshot);
    expect(pending?.pendingDraw).toEqual({ requesterId: "alice", donorId: "carol" });
    expect(pending?.currentPlayerId).toBe("alice");
    expect(pending?.players).toEqual(game.players);
  });

  test("uses the previous seat as the right-hand donor", () => {
    const game = createGame({ currentPlayerId: "bob" });
    const pending = validateTurn(game, "bob", { type: TurnActionType.RequestDraw });
    const result = validateTurn(pending!, "alice", {
      type: TurnActionType.GiveCard,
      card: sevenOfDiamonds,
    });

    expect(pending?.pendingDraw?.donorId).toBe("alice");
    expect(result?.players[0]?.hand).not.toContainEqual(sevenOfDiamonds);
    expect(result?.players[1]?.hand).toContainEqual(sevenOfDiamonds);
    expect(result?.currentPlayerId).toBe("carol");
  });

  test("rejects requests by other actors and play or new requests while pending", () => {
    const game = createGame();
    const pending = validateTurn(game, "alice", { type: TurnActionType.RequestDraw });

    expect(validateTurn(game, "bob", { type: TurnActionType.RequestDraw })).toBeNull();
    expect(
      validateTurn(game, "carol", {
        type: TurnActionType.GiveCard,
        card: card(Suit.Clubs, Rank.Ace),
      }),
    ).toBeNull();
    expect(
      validateTurn(pending!, "alice", {
        type: TurnActionType.Play,
        card: sevenOfDiamonds,
      }),
    ).toBeNull();
    expect(validateTurn(pending!, "alice", { type: TurnActionType.RequestDraw })).toBeNull();
  });

  test("only lets the derived donor give an owned card without mutating pending state", () => {
    const pending = validateTurn(createGame(), "alice", {
      type: TurnActionType.RequestDraw,
    })!;
    const snapshot = structuredClone(pending);

    expect(
      validateTurn(pending, "bob", {
        type: TurnActionType.GiveCard,
        card: card(Suit.Hearts, Rank.Seven),
      }),
    ).toBeNull();
    expect(
      validateTurn(pending, "carol", {
        type: TurnActionType.GiveCard,
        card: card(Suit.Hearts, Rank.Ace),
      }),
    ).toBeNull();
    expect(pending).toEqual(snapshot);
  });

  test("transfers the card, clears pending, and advances from the requester", () => {
    const game = createGame();
    const drawnCard = card(Suit.Clubs, Rank.Ace);
    const pending = validateTurn(game, "alice", { type: TurnActionType.RequestDraw })!;
    const result = validateTurn(pending, "carol", {
      type: TurnActionType.GiveCard,
      card: drawnCard,
    });

    expect(result?.players[0]?.hand).toContainEqual(drawnCard);
    expect(result?.players[2]?.hand).not.toContainEqual(drawnCard);
    expect(result?.pendingDraw).toBeNull();
    expect(result?.currentPlayerId).toBe("bob");
    expect(result?.board).toEqual(game.board);
  });

  test("finishes with the donor as winner when they give their final card", () => {
    const drawnCard = card(Suit.Spades, Rank.Seven);
    const game = createGame({
      players: [
        { id: "alice", hand: [sevenOfDiamonds] },
        { id: "bob", hand: [card(Suit.Hearts, Rank.Seven)] },
        { id: "carol", hand: [drawnCard] },
      ],
    });
    const pending = validateTurn(game, "alice", { type: TurnActionType.RequestDraw });
    const result = validateTurn(pending!, "carol", {
      type: TurnActionType.GiveCard,
      card: drawnCard,
    });

    expect(result?.status).toBe(GameStatus.Finished);
    expect(result?.winnerId).toBe("carol");
    expect(result?.players[2]?.hand).toEqual([]);
    expect(result?.pendingDraw).toBeNull();
    expect(result?.currentPlayerId).toBe("bob");
  });
});
